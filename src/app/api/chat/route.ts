import { NextRequest, NextResponse } from 'next/server';
import "dotenv/config";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { getSessionTokens, decrementSessionTokens } from "@/lib/redis";

export async function POST(req: NextRequest) {
  try {
    const { question, sources } = await req.json();
    const sessionId = req.headers.get("x-session-id") || "default-session";

    /* 
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    } 
    */

    if (!question || !sources || sources.length === 0) {
      return NextResponse.json({ error: "Missing question or sources" }, { status: 400 });
    }

    // 🛑 Check Token Limit
    const tokens = await getSessionTokens(sessionId);
    if (tokens <= 0) {
      return NextResponse.json(
        { error: "Daily limit reached. Please try again tomorrow.", tokens: 0 },
        { status: 429 }
      );
    }

    // 📉 Decrement Token
    const remainingTokens = await decrementSessionTokens(sessionId);

    if (!process.env.QDRANT_URL || !process.env.QDRANT_KEY) {
      return NextResponse.json({ error: "Qdrant environment variables not set" }, { status: 500 });
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({ error: "Google API key not set" }, { status: 500 });
    }

    // Use Google's text embedding model
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      modelName: "text-embedding-004", // Latest embedding model
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_KEY,
      collectionName: "PDF_Indexing",
    });

    // Temporarily removing filter due to Qdrant compatibility issues
    const vectorRetriever = vectorStore.asRetriever({
      k: 4,
      // TODO: Fix filter syntax for tenant_id
      // filter: {
      //   must: [
      //     {
      //       key: "tenant_id",
      //       match: {
      //         value: sessionId,
      //       },
      //     },
      //   ],
      // },
    });

    const relevantChunks = await vectorRetriever.invoke(question);

    const context = relevantChunks
      .map(
        (doc, i) =>
          `Context #${i + 1} (Page ${doc.metadata?.page || "?"}):\n${doc.pageContent}`
      )
      .join("\n\n");

    const SYSTEM_PROMPT = `
You are an AI assistant who search the user query from the context available to you from the PDF file with content and page number.
Only answer based on the available context from file only.

Context:
${context}
`;

    console.log("📤 Streaming response with Gemini...");
    
    // Stream the text
    const result = streamText({
      model: google("gemini-2.0-flash-lite"),
      system: SYSTEM_PROMPT,
      prompt: `User Question: ${question}`,
    });

    // Create a custom stream that processes tokens slowly
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(chunk));
            // Slower delay for visible typewriter effect
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    // Return custom stream with headers
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-remaining-tokens": remainingTokens.toString(),
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error: any) {
    console.error("❌ Error in chat route:", error);
    console.error("Error details:", error.stack);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}











// import { NextRequest, NextResponse } from 'next/server';
// import "dotenv/config";
// import { OpenAIEmbeddings } from "@langchain/openai";
// import { QdrantVectorStore } from "@langchain/qdrant";
// import OpenAI from "openai";

// const client = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// export async function POST(req: NextRequest) {
//   try {
//     const { question, sources } = await req.json();

//     if (!question || !sources || sources.length === 0) {
//         return NextResponse.json({ error: "Missing question or sources" }, { status: 400 });
//     }

//     if (!process.env.QDRANT_URL || !process.env.QDRANT_KEY) {
//         return NextResponse.json({ error: "Qdrant environment variables not set" }, { status: 500 });
//     }

//     const embeddings = new OpenAIEmbeddings({
//         model: "text-embedding-3-large",
//     });

//     const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
//         url: process.env.QDRANT_URL,
//         apiKey: process.env.QDRANT_KEY,
//         collectionName: "PDF_Indexing",
//     });

//     const vectorRetriever = vectorStore.asRetriever({
//         k: 3,
//     });

//     const relevantChunks = await vectorRetriever.invoke(question);

//     const SYSTEM_PROMPT = `
//         You are an AI assistant who search the user query from the context avilable to you from the PDF file with content and page number.
//         Only answer based on the avilable context from file only.
        
//         Context: 
//         ${JSON.stringify(relevantChunks)}
//     `;

//     const response = await client.chat.completions.create({
//         model: process.env.OPENAI_MODEL || "gpt-4-turbo",
//         messages: [
//         { role: "system", content: SYSTEM_PROMPT },
//         { role: "user", content: question },
//         ],
//     });

//     return NextResponse.json({ text: response.choices[0].message.content });
//   } catch (error: any) {
//     console.error("Error in chat route:", error);
//     return NextResponse.json(
//       { error: error.message || "Internal server error" },
//       { status: 500 }
//     );
//   }
// }
