import { NextRequest, NextResponse } from 'next/server';
import "dotenv/config";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { logger } from "@/lib/logger";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { getSessionTokens, decrementSessionTokens } from "@/lib/redis";

export async function POST(req: NextRequest) {
  try {
    const { question, sources, targetSource } = await req.json();
    const sessionId = req.headers.get("x-session-id") || "default-session";

    if (!question || !sources || sources.length === 0) {
      return NextResponse.json({ error: "Missing question or sources" }, { status: 400 });
    }

    //  Check Token Limit
    const tokens = await getSessionTokens(sessionId);
    if (tokens <= 0) {
      return NextResponse.json(
        { error: "Daily limit reached. Please try again tomorrow.", tokens: 0 },
        { status: 429 }
      );
    }

    //  Decrement Token
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
      modelName: "text-embedding-004",
    });

    const questionEmbedding = await embeddings.embedQuery(question);

    const { QdrantClient } = await import("@qdrant/js-client-rest");
    const qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_KEY,
    });

    // Search Qdrant
    const searchResult = await qdrantClient.search("PDF_Indexing", {
      vector: questionEmbedding,
      limit: 15, // Increase limit to allow for filtering
      with_payload: true,
      with_vector: false,
    });

    const sessionResults = searchResult.filter((point: any) => {
      const payload = point.payload || {};
      const metadata = payload.metadata || {};

      const tenantId = metadata.tenant_id || payload.tenant_id;
      const sourceName = metadata.source || payload.source;

      // Filter by Session ID
      if (tenantId !== sessionId) return false;

      // Filter by Target Source (if provided)
      if (targetSource && sourceName !== targetSource) return false;

      return true;
    }).slice(0, 4);

    const relevantChunks = sessionResults.map((point: any) => ({
      pageContent: (point.payload as any)?.content || (point.payload as any)?.text || "",
      metadata: (point.payload as any)?.metadata || {},
    }));

    const context = relevantChunks
      .map((doc, i) => `Context #${i + 1} (Page ${doc.metadata?.page || "?"}):\n${doc.pageContent}`)
      .join("\n\n");

    logger.log("📊 Retrieved:", sessionResults.length, "chunks,", context.length, "chars");

    const hasContext = context.trim().length > 0;

    const SYSTEM_PROMPT = `
You are an AI assistant that answers ONLY using the information explicitly provided below.

${hasContext
        ? `📄 DOCUMENT CONTEXT (extracts from uploaded files):\n${context}\n`
        : '📄 DOCUMENT CONTEXT: None available.\n'}

===========================
RESPONSE RULES (STRICT)
===========================

1️⃣ If NO document context is available:
- You MUST reply with EXACTLY:
"I couldn't find this information in your uploaded documents."

- Do NOT provide general knowledge
- Do NOT attempt to answer the question

2️⃣ If document context exists:
- Use ONLY that context to answer
- Begin response with: "📄 From your documents:"
- If something is unclear or missing in context, say so — but do NOT invent facts

3️⃣ NEVER:
- Use general/world knowledge not provided in documents
- Mention web search or external information

All responses MUST follow these rules exactly.
`;

    logger.log("📤 Streaming response with Gemini...");

    const result = streamText({
      model: google("gemini-2.0-flash-lite"),
      system: SYSTEM_PROMPT,
      prompt: `User Question: ${question}`,
    });

    // Return the stream directly
    return result.toTextStreamResponse({
      headers: {
        "x-remaining-tokens": remainingTokens.toString(),
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

