import { NextRequest, NextResponse } from 'next/server';
import "dotenv/config";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { question, sources } = await req.json();

    if (!question || !sources || sources.length === 0) {
        return NextResponse.json({ error: "Missing question or sources" }, { status: 400 });
    }

    if (!process.env.QDRANT_URL || !process.env.QDRANT_KEY) {
        return NextResponse.json({ error: "Qdrant environment variables not set" }, { status: 500 });
    }

    const embeddings = new OpenAIEmbeddings({
        model: "text-embedding-3-large",
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_KEY,
        collectionName: "PDF_Indexing",
    });

    const vectorRetriever = vectorStore.asRetriever({
        k: 3,
    });

    const relevantChunks = await vectorRetriever.invoke(question);

    const SYSTEM_PROMPT = `
        You are an AI assistant who search the user query from the context avilable to you from the PDF file with content and page number.
        Only answer based on the avilable context from file only.
        
        Context: 
        ${JSON.stringify(relevantChunks)}
    `;

    const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4-turbo",
        messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: question },
        ],
    });

    return NextResponse.json({ text: response.choices[0].message.content });
  } catch (error: any) {
    console.error("Error in chat route:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
