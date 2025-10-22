import { NextRequest, NextResponse } from "next/server";
import "dotenv/config";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { Document } from "@langchain/core/documents";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";

export const maxDuration = 60; // Prevent timeouts on Vercel

// Unified file handling function
async function handleFileUpload(file: File | null, docs: Document[]) {
  if (!file) return { words: 0, pages: 1, type: "" };

  const extension = file.name.toLowerCase().split(".").pop() || "";
  let totalWords = 0;
  let totalPages = 1;
  let fileType = "";

  try {
    console.log(`📄 Processing file: ${file.name} (${extension})`);

    switch (extension) {
      case "pdf":
        console.log("📥 Loading PDF with WebPDFLoader...");
        const loader = new WebPDFLoader(file, { splitPages: true });
        const pdfDocs = await loader.load();

        totalPages = pdfDocs.length;
        
        // Calculate total words across all pages
        totalWords = pdfDocs.reduce(
          (sum, doc) => sum + (doc.pageContent.split(/\s+/).filter(w => w.length > 0).length),
          0
        );
        
        fileType = "pdf";

        // Enrich metadata for each page
        pdfDocs.forEach((doc, index) => {
          doc.metadata = {
            ...doc.metadata,
            source: file.name,
            type: "pdf",
            page: index + 1,
            totalPages,
            size: `${(file.size / 1024).toFixed(1)} KB`,
          };
        });

        docs.push(...pdfDocs);
        console.log(`✅ PDF: ${pdfDocs.length} pages, ~${totalWords} words`);
        break;

      case "md":
      case "txt":
      case "markdown":
        const textContent = await file.text();
        if (!textContent.trim()) throw new Error("Empty text file");

        totalWords = textContent.split(/\s+/).filter(w => w.length > 0).length;
        fileType = extension === "md" || extension === "markdown" ? "markdown" : "text";

        // Single Document for text files
        const textDoc = new Document({
          pageContent: textContent,
          metadata: {
            source: file.name,
            type: fileType,
            size: `${(file.size / 1024).toFixed(1)} KB`,
          },
        });

        docs.push(textDoc);
        console.log(`✅ ${extension.toUpperCase()}: ~${totalWords} words`);
        break;

      default:
        throw new Error(
          `Unsupported file type: ${extension}. Supported: PDF, MD, TXT.`
        );
    }

    return {
      words: totalWords,
      pages: totalPages,
      type: fileType,
    };
  } catch (error) {
    console.error(`❌ File parse error for ${file.name}:`, error);
    throw error;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    console.log("📄 Indexing request received");

    // ✅ Ensure required environment variables exist
    const { QDRANT_URL, QDRANT_KEY, GOOGLE_GENERATIVE_AI_API_KEY } =
      process.env;
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
          error: "Please upload a file, provide a URL, or enter text.",
        },
        { status: 400 }
      );
    }

    const docs: Document[] = [];

    // ✅ Unified file handling
    let fileMetrics = { words: 0, pages: 1, type: "" };
    if (file) {
      fileMetrics = await handleFileUpload(file, docs);
    }

    // ✅ Handle Website URL
    let webMetrics = { words: 0, docsCount: 0 };
    if (websiteUrl) {
      console.log(`🌐 Fetching content from: ${websiteUrl}`);

      // Server-side validation
      try {
        new URL(websiteUrl);
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid URL format" },
          { status: 400 }
        );
      }

      const webLoader = new CheerioWebBaseLoader(websiteUrl);
      const webDocs = await webLoader.load();

      // Estimate word count
      const totalWords = webDocs.reduce(
        (sum, doc) => sum + (doc.pageContent.match(/\b\w+\b/g) || []).length,
        0
      );

      // Enrich web metadata
      webDocs.forEach((doc, index) => {
        doc.metadata = {
          ...doc.metadata,
          source: websiteUrl,
          type: "web",
          title: doc.metadata.title || new URL(websiteUrl).hostname,
          section: `Section ${index + 1}`,
        };
      });

      docs.push(...webDocs);
      webMetrics = { words: totalWords, docsCount: webDocs.length };
      console.log(
        `✅ Extracted ${webDocs.length} docs, ~${totalWords} words from ${websiteUrl}`
      );
    }

    // ✅ Handle Raw Text Input
    if (rawText) {
      console.log("📝 Processing direct text input");
      const textDoc = new Document({
        pageContent: rawText,
        metadata: { source: "user_text", type: "text" },
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

    // ✅ Unified success response
    let sourceType = "";
    let extractedWords = 0;
    let extractedPages: number | undefined = undefined;

    if (file) {
      sourceType =
        fileMetrics.type === "pdf"
          ? "PDF File"
          : fileMetrics.type === "markdown"
          ? "Markdown File"
          : "Text File";
      extractedWords = fileMetrics.words;
      if (fileMetrics.type === "pdf") extractedPages = fileMetrics.pages;
    } else if (websiteUrl) {
      sourceType = "Website URL";
      extractedWords = webMetrics.words;
    } else {
      sourceType = "Direct Text Input";
      extractedWords = rawText ? rawText.split(/\s+/).filter(w => w.length > 0).length : 0;
    }

    return NextResponse.json(
      {
        success: true,
        source: {
          id: Date.now(),
          name: file?.name || websiteUrl || "User Text",
          type: sourceType,
          documentsIndexed: docs.length,
          extractedWords,
          extractedPages,
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