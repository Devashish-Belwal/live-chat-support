import { db } from "../prisma/db";
import { hashPassword, verifyPassword } from "./password";
import type { RegisterInput } from "./auth.schema";
import { createAccessToken } from "./jwt";
import { generateRefreshToken } from "./refresh-token";
import { consumeSession, createSession, deleteSession, getSession } from "./session";

export async function registerUser(input: RegisterInput) {
    const existingUser = await db.orm.public.User
        .where({ email: input.email })
        .first();

    if (existingUser) {
        throw new Error("EMAIL_ALREADY_EXISTS");
    }

    const passwordHash = await hashPassword(input.password);

    const user = await db.orm.public.User.create({
        email: input.email,
        passwordHash,
        role: "CANDIDATE",
        name: input.name,
    });

    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
    };
}

export async function loginUser(input: {
    email: string;
    password: string;
}) {
    const user = await db.orm.public.User
        .where({ email: input.email })
        .first();

    if (!user) {
        throw new Error("INVALID_CREDENTIALS");
    }

    const validPassword = await verifyPassword(
        input.password,
        user.passwordHash,
    );

    if (!validPassword) {
        throw new Error("INVALID_CREDENTIALS");
    }

    const accessToken = await createAccessToken({
        id: user.id,
        role: user.role,
    });

    const refreshToken = generateRefreshToken();

    await createSession(refreshToken, {
        userId: user.id,
        role: user.role,
    });

    return {
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        },
    };
}

export async function refreshAccessToken(refreshToken: string) {
    const session = await consumeSession(refreshToken);

    if (!session) {
        throw new Error("INVALID_REFRESH_TOKEN");
    }

    const newRefreshToken = generateRefreshToken();

    await createSession(newRefreshToken, {
        userId: session.userId,
        role: session.role,
    });

    const accessToken = await createAccessToken({
        id: session.userId,
        role: session.role,
    });

    return {
        accessToken,
        refreshToken: newRefreshToken,
    };
}

export async function logoutUser(refreshToken: string) {
    return deleteSession(refreshToken);
}