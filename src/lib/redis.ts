import Redis from 'ioredis';
import { logger } from "@/lib/logger";

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL);

const SESSION_TTL = 86400; // 24 hours in seconds
const DEFAULT_TOKENS = 10;

export interface FileMetadata {
    id: string;
    name: string;
    type: string;
    size: string;
    sourceType: "file" | "url" | "text";
    uploadedAt: number;
}

export async function getSessionTokens(sessionId: string): Promise<number> {
    const key = `session:${sessionId}:tokens`;
    const tokens = await redis.get(key);

    if (tokens === null) {
        // Initialize new session with default tokens
        await redis.set(key, DEFAULT_TOKENS, 'EX', SESSION_TTL);
        return DEFAULT_TOKENS;
    }

    return parseInt(tokens, 10);
}

export async function decrementSessionTokens(sessionId: string): Promise<number> {
    const key = `session:${sessionId}:tokens`;
    const tokens = await redis.decr(key);

    // Refresh TTL on activity
    await redis.expire(key, SESSION_TTL);

    return tokens;
}

export async function resetSessionTokens(sessionId: string): Promise<void> {
    const key = `session:${sessionId}:tokens`;
    await redis.set(key, DEFAULT_TOKENS, 'EX', SESSION_TTL);
}

export async function addSessionFile(sessionId: string, file: FileMetadata): Promise<void> {
    const key = `session:${sessionId}:files`;
    await redis.rpush(key, JSON.stringify(file));
    await redis.expire(key, SESSION_TTL);
}

export async function getSessionFiles(sessionId: string): Promise<FileMetadata[]> {
    const key = `session:${sessionId}:files`;
    const files = await redis.lrange(key, 0, -1);
    return files.map(f => JSON.parse(f));
}

export async function removeSessionFile(sessionId: string, fileName: string): Promise<void> {
    const key = `session:${sessionId}:files`;
    const files = await redis.lrange(key, 0, -1);

    logger.log(`🗑️ Redis: Removing "${fileName}" from session ${sessionId}`);
    logger.log(`📊 Redis: Found ${files.length} files in list`);

    // Find and remove the file with matching name
    for (const fileJson of files) {
        const file: FileMetadata = JSON.parse(fileJson);
        logger.log(`   Checking: "${file.name}"`);
        if (file.name === fileName) {
            await redis.lrem(key, 1, fileJson);
            logger.log(`   ✅ Removed "${fileName}" from Redis`);
            break;
        }
    }
}

export async function clearSession(sessionId: string): Promise<void> {
    const tokenKey = `session:${sessionId}:tokens`;
    const filesKey = `session:${sessionId}:files`;
    await redis.del(tokenKey, filesKey);
}
