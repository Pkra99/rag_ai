import { NextRequest, NextResponse } from 'next/server';
import "dotenv/config";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { getSessionTokens, decrementSessionTokens } from "@/lib/redis";
import { tavily } from "@tavily/core";

export async function POST(req: NextRequest) {
  try {
    const { question, sources, conversationHistory = [] } = await req.json();
    const sessionId = req.headers.get("x-session-id") || "default-session";

    /* 
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    } 
    */

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
      modelName: "text-embedding-004", // Latest embedding model
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_KEY,
      collectionName: "PDF_Indexing",
    });

    // Get embedding for the question
    const questionEmbedding = await embeddings.embedQuery(question);

    // Use native Qdrant client to search with tenant_id filter
    const { QdrantClient } = await import("@qdrant/js-client-rest");
    const qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_KEY,
    });

    // Search with session filter
    const searchResult = await qdrantClient.search("PDF_Indexing", {
      vector: questionEmbedding,
      limit: 4,
      with_payload: true,
      with_vector: false,
    });

    // Filter results in JS by tenant_id (since Qdrant filters don't work reliably)
    const sessionResults = searchResult.filter((point: any) => {
      const tenantId = point.payload?.metadata?.tenant_id || point.payload?.tenant_id;
      return tenantId === sessionId;
    }).slice(0, 4); // Take top 4 after filtering

    // Convert to LangChain Document format
    const relevantChunks = sessionResults.map((point: any) => ({
      pageContent: point.payload?.content || point.payload?.text || "",
      metadata: point.payload?.metadata || {},
    }));

    const context = relevantChunks
      .map(
        (doc, i) =>
          `Context #${i + 1} (Page ${doc.metadata?.page || "?"}):\n${doc.pageContent}`
      )
      .join("\n\n");

    // Check if user is confirming a web search request
    // Look for affirmative responses in short messages OR explicit web search requests
    const questionLower = question.toLowerCase().trim();
    const isShortConfirmation = question.length < 30 && (
      questionLower === 'yes' ||
      questionLower === 'yeah' ||
      questionLower === 'ok' ||
      questionLower === 'okay' ||
      questionLower === 'sure' ||
      questionLower === 'go ahead' ||
      questionLower === 'please' ||
      questionLower.startsWith('yes,') ||
      questionLower.startsWith('yes ')
    );

    const hasSearchKeywords = (
      questionLower.includes('search web') ||
      questionLower.includes('search the web') ||
      questionLower.includes('look it up') ||
      questionLower.includes('find online') ||
      questionLower.includes('google it')
    );

    const shouldPerformWebSearch = isShortConfirmation || hasSearchKeywords;

    // If user confirmed search, find the original question from conversation history
    let searchQuery = question;
    if (isShortConfirmation && conversationHistory.length > 0) {
      // Find the last user question (before "yes")
      const userMessages = conversationHistory.filter((msg: any) => msg.role === 'user');
      if (userMessages.length > 0) {
        searchQuery = userMessages[userMessages.length - 1].content;
        console.log("📝 Found original question from history:", searchQuery);
      }
    }

    // Perform web search if user confirmed
    let webSearchResults = "";
    let searchPerformed = false;
    if (shouldPerformWebSearch) {
      console.log("🔍 User confirmed web search, performing search for:", searchQuery);
      try {
        const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY || "tvly-demo" });
        const searchResult = await tavilyClient.search(searchQuery, {
          search_depth: "basic",
          max_results: 3,
        });

        webSearchResults = searchResult.results
          .map((r: any, i: number) => `Web Result #${i + 1}:\nTitle: ${r.title}\nContent: ${r.content}\nURL: ${r.url}`)
          .join("\n\n");

        searchPerformed = true;
        console.log("✅ Web search completed, found", searchResult.results.length, "results");
      } catch (error) {
        console.error("❌ Web search failed:", error);
        webSearchResults = "Web search failed. Please check your TAVILY_API_KEY in .env.local";
      }
    }

    const SYSTEM_PROMPT = `
You are an AI assistant. Your primary task is to answer the user's question using the provided Context from their uploaded documents.

${context ? `📄 DOCUMENT CONTEXT (from uploaded files):\n${context}\n` : '📄 DOCUMENT CONTEXT: No relevant information found in uploaded documents.\n'}
${searchPerformed && webSearchResults ? `🌐 WEB SEARCH RESULTS:\n${webSearchResults}\n` : ''}

INSTRUCTIONS:
1. **ALWAYS prioritize Document Context** - Check uploaded documents first
2. **Source Attribution** - ALWAYS indicate where information comes from:
   - If from documents: Start with "📄 From your documents:" or "Based on your uploaded files:"
   - If from web: Start with "🌐 From web search:" or "Based on web search results:"
3. **No Context Found** - If the answer is NOT in the Document Context AND no web search was performed:
   - Clearly state: "I couldn't find this information in your uploaded documents."
   - Then ask: "Would you like me to search the web for this information? Just reply 'yes' to search."
   - Do NOT answer from general knowledge without permission
4. **Web Search Performed** - If web search results are provided above, use them to answer the question and cite sources with URLs
5. **Be Clear and Concise** - Keep answers focused and well-formatted
`;

    console.log("📤 Streaming response with Gemini...");

    // Stream the text directly
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

