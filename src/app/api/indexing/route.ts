import { NextRequest, NextResponse } from 'next/server';
import "dotenv/config";
// 💡 No longer need 'path' or 'writeFile'
// import path from "path";
// import { writeFile } from 'fs/promises';

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    console.log("Indexing request received");

    // Check for required environment variables
    if (!process.env.QDRANT_URL || !process.env.GOOGLE_GENERATIVE_AI_API_KEY || !process.env.QDRANT_KEY) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Required environment variables (QDRANT_URL, QDRANT_KEY, GOOGLE_GENERATIVE_AI_API_KEY) are not set." 
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

    // ✅ CRITICAL FIX 1: Process the file in memory
    // LangChain's PDFLoader can accept a Blob directly (a File is a type of Blob).
    // This avoids saving to disk, preventing race conditions and issues with serverless filesystems.
    console.log("Loading PDF from memory...");
    const loader = new PDFLoader(file);
    const docs = await loader.load();

    console.log(`Loaded ${docs.length} pages from PDF`);

    // ✅ CRITICAL FIX 2: Add metadata to each document
    // This adds the filename to each chunk's metadata, allowing you to filter
    // results for this specific document during the retrieval step.
    docs.forEach(doc => {
      doc.metadata = { ...doc.metadata, source: file.name };
    });

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      // 💡 Switched to `model` for consistency with latest library versions
      model: "text-embedding-004",
    });

    console.log("Creating embeddings and storing in Qdrant...");

    // Store documents in Qdrant. The metadata will be indexed alongside the vectors.
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
          // 💡 Changed to pages for clarity
          pagesIndexed: docs.length,
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