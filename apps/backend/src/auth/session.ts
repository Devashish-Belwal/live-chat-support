import { redis } from "../redis";
import { hashRefreshToken } from "./refresh-token";

const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days

function sessionKey(refreshToken: string): string {
    return `auth:session:${hashRefreshToken(refreshToken)}`;
}

interface Session {
    userId: number;
    role: string;
}

export async function createSession(
    refreshToken: string,
    session: Session,
): Promise<void> {
    await redis.set(
        sessionKey(refreshToken),
        JSON.stringify(session),
        "EX",
        REFRESH_TOKEN_TTL,
    );
}

export async function getSession(
    refreshToken: string,
): Promise<Session | null> {
    const value = await redis.get(sessionKey(refreshToken));

    if (!value) {
        return null;
    }

    return JSON.parse(value) as Session;
}

export async function deleteSession(
    refreshToken: string,
): Promise<boolean> {
    const deleted = await redis.del(sessionKey(refreshToken));

    return deleted === 1;
}

export async function consumeSession(
    refreshToken: string,
): Promise<Session | null> {
    const key = sessionKey(refreshToken);

    const value = await redis.getdel(key);

    if (!value) {
        return null;
    }

    return JSON.parse(value) as Session;
}