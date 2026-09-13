import type { Request, Response } from "express";

import { loginSchema, refreshSchema, registerSchema } from "./auth.schema";
import { getCurrentUser, loginUser, logoutUser, refreshAccessToken, registerUser } from "./auth.service";
import type { AuthenticatedRequest } from "./auth.middleware";

export async function register(req: Request, res: Response) {
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: "INVALID_REQUEST",
            details: result.error.flatten(),
        });
    }

    try {
        const tokens = await registerUser(result.data);

        return res.status(201).json(tokens);
    } catch (error) {
        if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
            return res.status(409).json({
                error: "EMAIL_ALREADY_EXISTS",
            });
        }

        console.error("Registration error:", error);

        return res.status(500).json({
            error: "INTERNAL_SERVER_ERROR",
        });
    }
}

export async function login(req: Request, res: Response) {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: "INVALID_REQUEST",
            details: result.error.flatten(),
        });
    }

    try {
        const tokens = await loginUser(result.data);

        res.cookie('refreshToken', tokens.refreshToken, { httpOnly: true, sameSite: 'lax', path: '/' });
        return res.status(200).json({
            accessToken: tokens.accessToken,
            user: tokens.user,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "INVALID_CREDENTIALS"
        ) {
            return res.status(401).json({
                error: "INVALID_CREDENTIALS",
            });
        }

        console.error("Login error:", error);

        return res.status(500).json({
            error: "INTERNAL_SERVER_ERROR",
        });
    }
}

export async function refresh(req: Request, res: Response) {
    const refreshToken = (req as any).cookies?.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ error: 'INVALID_REFRESH_TOKEN' });
    }
    try {
        const tokens = await refreshAccessToken(refreshToken);
        res.cookie('refreshToken', tokens.refreshToken, { httpOnly: true, sameSite: 'lax', path: '/' });
        return res.status(200).json({ accessToken: tokens.accessToken });
    } catch (error) {
        if (error instanceof Error && error.message === 'INVALID_REFRESH_TOKEN') {
            return res.status(401).json({ error: 'INVALID_REFRESH_TOKEN' });
        }
        console.error('Refresh token error:', error);
        return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
}

export async function logout(req: Request, res: Response) {
    const refreshToken = (req as any).cookies?.refreshToken;
    try {
        if (refreshToken) {
            await logoutUser(refreshToken);
        }
        res.clearCookie('refreshToken', { path: '/' });
        return res.status(204).send();
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
}

export async function me(
    req: Request,
    res: Response,
) {
    try {
        const userId = (req as AuthenticatedRequest).user.id;

        const user = await getCurrentUser(userId);

        return res.status(200).json({
            user,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "USER_NOT_FOUND"
        ) {
            return res.status(404).json({
                error: "USER_NOT_FOUND",
            });
        }

        console.error("Get current user error:", error);

        return res.status(500).json({
            error: "INTERNAL_SERVER_ERROR",
        });
    }
}