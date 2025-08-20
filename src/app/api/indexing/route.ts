import { NextRequest, NextResponse } from 'next/server';
import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { writeFile } from 'fs/promises';

export const maxDuration = 60;
export const bodySizeLimit = "20mb";

export async function POST(req: NextRequest) {
  try {
    console.log("Indexing request received");

    if (!process.env.QDRANT_URL || !process.env.OPENAI_API_KEY || !process.env.QDRANT_KEY) {
      return NextResponse.json(
        { success: false, error: "Required environment variables (QDRANT_URL, QDRANT_KEY, OPENAI_API_KEY) are not set." },
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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.join(process.cwd(), "public", file.name);
    await writeFile(filePath, buffer);

    const loader = new PDFLoader(filePath);
    const docs = await loader.load();

    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-large",
    });

    await QdrantVectorStore.fromDocuments(docs, embeddings, {
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_KEY,
      collectionName: "PDF_Indexing",
    });

    return NextResponse.json(
      {
        success: true,
        source: {
          id: Date.now(),
          name: file.name,
          type: "Uploaded File",
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
