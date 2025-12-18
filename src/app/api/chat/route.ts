import { NextRequest, NextResponse } from 'next/server';
import "dotenv/config";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { logger } from "@/lib/logger";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { getSessionTokens, decrementSessionTokens } from "@/lib/redis";

export async function POST(req: NextRequest) {
  let selectedModel = "gemini-2.5-flash-lite"; // Default model

  try {
    const { question, sources, targetSource, model = "gemini-2.5-flash-lite" } = await req.json();
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

    // Validate model against allowed list
    const allowedModels = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
    selectedModel = allowedModels.includes(model) ? model : "gemini-2.5-flash-lite";

    logger.log(`🤖 Using model: ${selectedModel}`);

    const result = streamText({
      model: google(selectedModel),
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

    // Detect specific error types from Google API
    const errorMessage = error.message || "";
    const errorString = JSON.stringify(error).toLowerCase();

    // Check for quota exhaustion
    if (
      errorMessage.includes("quota") ||
      errorMessage.includes("QUOTA_EXCEEDED") ||
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorString.includes("quota") ||
      errorString.includes("resource_exhausted")
    ) {
      return NextResponse.json(
        {
          error: `Quota exhausted for ${selectedModel} model. Please try again later.`,
          errorType: "quota_exceeded",
          modelName: selectedModel
        },
        { status: 429 }
      );
    }

    // Check for rate limiting
    if (
      errorMessage.includes("rate limit") ||
      errorMessage.includes("RATE_LIMIT_EXCEEDED") ||
      errorMessage.includes("429") ||
      errorString.includes("rate") ||
      error.status === 429
    ) {
      return NextResponse.json(
        {
          error: "Too many requests. Please wait a moment and try again.",
          errorType: "rate_limited",
          modelName: selectedModel
        },
        { status: 429 }
      );
    }

    // Check for API key issues
    if (
      errorMessage.includes("API key") ||
      errorMessage.includes("INVALID_ARGUMENT") ||
      errorMessage.includes("authentication") ||
      error.status === 401 ||
      error.status === 403
    ) {
      return NextResponse.json(
        {
          error: "API authentication issue. Please contact support.",
          errorType: "auth_error"
        },
        { status: 500 }
      );
    }

    // Check for model-specific errors
    if (
      errorMessage.includes("model") ||
      errorMessage.includes("not found") ||
      error.status === 404
    ) {
      return NextResponse.json(
        {
          error: "The AI model is currently unavailable. Please try again later.",
          errorType: "model_error",
          modelName: selectedModel
        },
        { status: 503 }
      );
    }

    // Generic error fallback
    return NextResponse.json(
      {
        error: errorMessage || "An unexpected error occurred. Please try again.",
        errorType: "generic_error"
      },
      { status: 500 }
    );
  }
}

