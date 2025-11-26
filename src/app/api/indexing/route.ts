import { NextRequest, NextResponse } from "next/server";
import "dotenv/config";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { Document } from "@langchain/core/documents";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { addSessionFile, FileMetadata, removeSessionFile } from "@/lib/redis";
import { logger } from "@/lib/logger";

export const maxDuration = 60; // Prevent timeouts on Vercel

// Unified file handling function
async function handleFileUpload(file: File | null, docs: Document[], sessionId: string) {
  if (!file) return { words: 0, pages: 1, type: "" };

  const extension = file.name.toLowerCase().split(".").pop() || "";
  let totalWords = 0;
  let totalPages = 1;
  let fileType = "";

  try {
    logger.log(`📄 Processing file: ${file.name} (${extension})`);

    switch (extension) {
      case "pdf":
        logger.log("📥 Loading PDF with WebPDFLoader...");
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
            tenant_id: sessionId,
          };
        });

        docs.push(...pdfDocs);
        logger.log(`✅ PDF: ${pdfDocs.length} pages, ~${totalWords} words`);
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
            tenant_id: sessionId,
          },
        });

        docs.push(textDoc);
        logger.log(`✅ ${extension.toUpperCase()}: ~${totalWords} words`);
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
    logger.log("📄 Indexing request received");

    // Debug logging
    const headerSessionId = req.headers.get("x-session-id");
    const urlSessionId = req.nextUrl.searchParams.get("sessionId");

    logger.log("🔍 Headers:", Object.fromEntries(req.headers.entries()));
    logger.log("🔍 x-session-id:", headerSessionId);
    logger.log("🔍 Query sessionId:", urlSessionId);

    const sessionId = headerSessionId || urlSessionId || "default-session";


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
      fileMetrics = await handleFileUpload(file, docs, sessionId);
    }

    // ✅ Handle Website URL
    let webMetrics = { words: 0, docsCount: 0 };
    if (websiteUrl) {
      logger.log(`🌐 Fetching content from: ${websiteUrl}`);

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
          tenant_id: sessionId,
        };
      });

      docs.push(...webDocs);
      webMetrics = { words: totalWords, docsCount: webDocs.length };
      logger.log(
        `✅ Extracted ${webDocs.length} docs, ~${totalWords} words from ${websiteUrl}`
      );
    }

    // ✅ Handle Raw Text Input
    if (rawText) {
      logger.log("📝 Processing direct text input");
      const textDoc = new Document({
        pageContent: rawText,
        metadata: { source: "User Text", type: "text", tenant_id: sessionId },
      });
      docs.push(textDoc);
      logger.log("✅ Text input added as document");
    }

    if (docs.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid content found to index." },
        { status: 400 }
      );
    }
    // This improves retrieval by breaking large texts into semantically meaningful chunks
    // with overlap to preserve context across boundaries.
    const { RecursiveCharacterTextSplitter } = await import("@langchain/textsplitters");

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,       // Optimal size for most LLM contexts
      chunkOverlap: 200,     // Overlap to maintain context between chunks
      separators: ["\n\n", "\n", " ", ""], // Priority for splitting
    });

    logger.log("✂️ Splitting documents into optimized chunks...");
    const splitDocs = await splitter.splitDocuments(docs);
    logger.log(`✅ Split ${docs.length} original docs into ${splitDocs.length} chunks`);

    // ✅ Initialize Google embeddings
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: GOOGLE_GENERATIVE_AI_API_KEY,
      model: "text-embedding-004",
    });

    // ✅ Store embeddings in Qdrant
    logger.log("🚀 Generating embeddings and uploading to Qdrant...");
    await QdrantVectorStore.fromDocuments(splitDocs, embeddings, {
      url: QDRANT_URL,
      apiKey: QDRANT_KEY,
      collectionName: "PDF_Indexing",
    });

    logger.log("✅ Indexing completed successfully");

    // ✅ Unified success response
    let sourceType: "file" | "url" | "text" = "text";
    let extractedWords = 0;
    let extractedPages: number | undefined = undefined;
    let sourceName = "";
    let sourceSize = "";

    if (file) {
      sourceType = "file";
      extractedWords = fileMetrics.words;
      if (fileMetrics.type === "pdf") extractedPages = fileMetrics.pages;
      sourceName = file.name;
      sourceSize = `${(file.size / 1024).toFixed(1)} KB`;
    } else if (websiteUrl) {
      sourceType = "url";
      extractedWords = webMetrics.words;
      sourceName = websiteUrl;
      sourceSize = "URL";
    } else {
      sourceType = "text";
      extractedWords = rawText ? rawText.split(/\s+/).filter(w => w.length > 0).length : 0;
      sourceName = "User Text";
      sourceSize = `${Math.ceil((rawText?.length || 0) / 1024)} KB`;
    }

    // Store in Redis
    const newSource: FileMetadata = {
      id: Date.now().toString(),
      name: sourceName,
      type: fileMetrics.type || (sourceType === "url" ? "WEBSITE" : "TEXT"),
      size: sourceSize,
      sourceType: sourceType,
      uploadedAt: Date.now(),
    };
    await addSessionFile(sessionId, newSource);

    return NextResponse.json(
      {
        success: true,
        source: {
          id: newSource.id,
          name: newSource.name,
          type: newSource.type,
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

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get("fileName");

    if (!fileName) {
      return NextResponse.json(
        { success: false, error: "fileName required" },
        { status: 400 }
      );
    }

    logger.log(`\n🗑️  DELETE REQUEST for: "${fileName}"`);

    const { QDRANT_URL, QDRANT_KEY } = process.env;
    if (!QDRANT_URL || !QDRANT_KEY) {
      return NextResponse.json(
        { success: false, error: "Qdrant not configured" },
        { status: 500 }
      );
    }

    const { QdrantClient } = await import("@qdrant/js-client-rest");
    const client = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_KEY });

    // Get ALL points from collection with payload
    logger.log("📥 Fetching all points from Qdrant...");
    const result = await client.scroll("PDF_Indexing", {
      limit: 1000,
      with_payload: true,
      with_vector: false,
    });

    logger.log(`📊 Retrieved ${result.points.length} total points`);

    // Find matching points (LangChain stores metadata under payload.metadata)
    const toDelete: string[] = [];

    result.points.forEach((point: any) => {
      // LangChain Qdrant store uses nested metadata
      const pointSource = point.payload?.metadata?.source || point.payload?.source;

      // Match exact filename OR handle legacy "user_text" case
      const isMatch = pointSource === fileName ||
        (fileName === "User Text" && pointSource === "user_text");

      if (isMatch) {
        toDelete.push(point.id);
        logger.log(`✓ Match found: ID ${point.id}, source: "${pointSource}"`);
      }
    });

    logger.log(`\n🎯 Found ${toDelete.length} points to delete`);

    if (toDelete.length === 0) {
      logger.log(`\n⚠️  No matches found. Debugging first point:`);
      if (result.points.length > 0) {
        const firstPoint = result.points[0] as any;
        logger.log(`   payload.source: "${firstPoint.payload?.source}"`);
        logger.log(`   payload.metadata.source: "${firstPoint.payload?.metadata?.source}"`);
        logger.log(`   Full payload keys:`, Object.keys(firstPoint.payload || {}));
      }

      return NextResponse.json({
        success: true,
        deleted: 0,
        message: `No embeddings found for "${fileName}"`,
      });
    }

    // Delete points by ID
    logger.log(`\n🔥 Deleting ${toDelete.length} points from Qdrant...`);
    await client.delete("PDF_Indexing", { points: toDelete });

    // Also remove from Redis file list
    const sessionId = req.headers.get("x-session-id") || searchParams.get("sessionId") || "default-session";
    await removeSessionFile(sessionId, fileName);

    logger.log(`✅ Successfully deleted ${toDelete.length} embeddings and removed from Redis\n`);

    return NextResponse.json({
      success: true,
      deleted: toDelete.length,
      message: `Deleted ${toDelete.length} embeddings for "${fileName}"`,
    });

  } catch (error: any) {
    console.error("\n❌ DELETE ERROR:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}