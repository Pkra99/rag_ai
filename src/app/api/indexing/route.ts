import { NextRequest, NextResponse } from "next/server";
import "dotenv/config";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { Document } from "@langchain/core/documents";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";

export const maxDuration = 60; // Prevent timeouts on Vercel

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    console.log("📄 Indexing request received");

    // ✅ Ensure required environment variables exist
    const { QDRANT_URL, QDRANT_KEY, GOOGLE_GENERATIVE_AI_API_KEY } = process.env;
    if (!QDRANT_URL || !QDRANT_KEY || !GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing environment variables: QDRANT_URL, QDRANT_KEY, GOOGLE_GENERATIVE_AI_API_KEY",
        },
        { status: 500 }
      );
    }

    // ✅ Parse multipart/form-data request
    const data = await req.formData();
    const file = data.get("file") as File | null;
    const websiteUrl = (data.get("url") as string | null)?.trim();
    const rawText = (data.get("text") as string | null)?.trim();

    if (!file && !websiteUrl && !rawText) {
      return NextResponse.json(
        {
          success: false,
          error: "Please upload a PDF, provide a URL, or enter text.",
        },
        { status: 400 }
      );
    }

    const docs: Document[] = [];

    // ✅ Handle PDF Upload
    if (file) {
      console.log(`📥 Received PDF: ${file.name}`);
      const loader = new WebPDFLoader(file, { splitPages: true });
      const pdfDocs = await loader.load();
      docs.push(...pdfDocs);
      console.log(`✅ Loaded ${pdfDocs.length} pages from PDF`);
    }

    // ✅ Handle Website URL
    if (websiteUrl) {
      console.log(`🌐 Fetching content from: ${websiteUrl}`);
      const webLoader = new CheerioWebBaseLoader(websiteUrl);
      const webDocs = await webLoader.load();
      docs.push(...webDocs);
      console.log(`✅ Extracted ${webDocs.length} web document(s)`);
    }

    // ✅ Handle Raw Text Input
    if (rawText) {
      console.log("📝 Processing direct text input");
      const textDoc = new Document({
        pageContent: rawText,
        metadata: { source: "user_text" },
      });
      docs.push(textDoc);
      console.log("✅ Text input added as document");
    }

    if (docs.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid content found to index." },
        { status: 400 }
      );
    }

    // ✅ Initialize Google embeddings
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: GOOGLE_GENERATIVE_AI_API_KEY,
      model: "text-embedding-004",
    });

    // ✅ Store embeddings in Qdrant
    console.log("🚀 Generating embeddings and uploading to Qdrant...");
    await QdrantVectorStore.fromDocuments(docs, embeddings, {
      url: QDRANT_URL,
      apiKey: QDRANT_KEY,
      collectionName: "PDF_Indexing",
    });

    console.log("✅ Indexing completed successfully");

    return NextResponse.json(
      {
        success: true,
        source: {
          id: Date.now(),
          name: file?.name || websiteUrl || "User Text",
          type: file
            ? "Uploaded PDF"
            : websiteUrl
            ? "Website URL"
            : "Direct Text Input",
          documentsIndexed: docs.length,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("❌ Error in indexing route:", error);
    return NextResponse.json(
      { success: false, error: error.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
