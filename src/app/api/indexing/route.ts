import { NextRequest, NextResponse } from 'next/server';
import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { writeFile } from 'fs/promises';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    console.log("Indexing request received");

    // Check for required environment variables
    if (!process.env.QDRANT_URL || !process.env.GOOGLE_GENERATIVE_AI_API_KEY || !process.env.QDRANT_KEY) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Required environment variables (QDRANT_URL, QDRANT_KEY, GOOGLE_API_KEY) are not set." 
        },
        { status: 500 }
      );
    }

    const data = await req.formData();
    const file = data.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Save the file temporarily
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.join(process.cwd(), "public", file.name);
    await writeFile(filePath, buffer);

    console.log("PDF file saved, loading documents...");

    // Load PDF documents
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();

    console.log(`Loaded ${docs.length} documents from PDF`);

    // Use Google's embedding model
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      modelName: "text-embedding-004", // Latest Google embedding model
    });

    console.log("Creating embeddings and storing in Qdrant...");

    // Store documents in Qdrant with Google embeddings
    await QdrantVectorStore.fromDocuments(docs, embeddings, {
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_KEY,
      collectionName: "PDF_Indexing",
    });

    console.log("Indexing completed successfully");

    return NextResponse.json(
      {
        success: true,
        source: {
          id: Date.now(),
          name: file.name,
          type: "Uploaded File",
          documentsIndexed: docs.length,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in indexing route:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}