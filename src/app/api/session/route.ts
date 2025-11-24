import { NextRequest, NextResponse } from "next/server";
import { getSessionTokens, getSessionFiles, clearSession, resetSessionTokens } from "@/lib/redis";
import { QdrantClient } from "@qdrant/js-client-rest";
import "dotenv/config";

export async function GET(req: NextRequest) {
    const sessionId = req.headers.get("x-session-id");

    if (!sessionId) {
        return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    try {
        const tokens = await getSessionTokens(sessionId);
        const files = await getSessionFiles(sessionId);

        return NextResponse.json({ tokens, files });
    } catch (error) {
        console.error("Error fetching session:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const sessionId = req.headers.get("x-session-id");

    if (!sessionId) {
        return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    try {
        // 1. Clear Redis Data
        await clearSession(sessionId);

        // 2. Clear Qdrant Data - delete all embeddings for this session
        if (process.env.QDRANT_URL && process.env.QDRANT_KEY) {
            try {
                const qdrantClient = new QdrantClient({
                    url: process.env.QDRANT_URL,
                    apiKey: process.env.QDRANT_KEY,
                });

                console.log(`🗑️ Clearing all embeddings for session: ${sessionId}`);

                // Scroll to get all points for this session
                const result = await qdrantClient.scroll("PDF_Indexing", {
                    limit: 1000,
                    with_payload: true,
                    with_vector: false,
                });

                // Find points matching this session's tenant_id
                const toDelete: string[] = [];
                result.points.forEach((point: any) => {
                    const tenantId = point.payload?.metadata?.tenant_id || point.payload?.tenant_id;
                    if (tenantId === sessionId) {
                        toDelete.push(point.id);
                    }
                });

                if (toDelete.length > 0) {
                    await qdrantClient.delete("PDF_Indexing", { points: toDelete });
                    console.log(`✅ Deleted ${toDelete.length} embeddings for session: ${sessionId}`);
                } else {
                    console.log(`⚠️ No embeddings found for session: ${sessionId}`);
                }
            } catch (qdrantError) {
                console.error("❌ Error clearing Qdrant data:", qdrantError);
                // Don't fail the whole request if Qdrant cleanup fails, but log it
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error clearing session:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
