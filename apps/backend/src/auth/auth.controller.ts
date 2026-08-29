import type { Request, Response } from "express";

import { loginSchema, refreshSchema, registerSchema } from "./auth.schema";
import { loginUser, logoutUser, refreshAccessToken, registerUser } from "./auth.service";

export async function register(req: Request, res: Response) {
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: "INVALID_REQUEST",
            details: result.error.flatten(),
        });
    }

    try {
        const user = await registerUser(result.data);

        return res.status(201).json({
            user,
        });
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
        const user = await loginUser(result.data);

        return res.status(200).json({
            user,
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
    const result = refreshSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: "INVALID_REQUEST",
            details: result.error.flatten(),
        });
    }

    try {
        const tokens = await refreshAccessToken(
            result.data.refreshToken,
        );

        return res.status(200).json(tokens);
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "INVALID_REFRESH_TOKEN"
        ) {
            return res.status(401).json({
                error: "INVALID_REFRESH_TOKEN",
            });
        }

        console.error("Refresh token error:", error);

        return res.status(500).json({
            error: "INTERNAL_SERVER_ERROR",
        });
    }
}

export async function logout(req: Request, res: Response) {
    const result = refreshSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: "INVALID_REQUEST",
            details: result.error.flatten(),
        });
    }

    try {
        const deleted = await logoutUser(result.data.refreshToken);

        if (!deleted) {
            return res.status(401).json({
                error: "INVALID_REFRESH_TOKEN",
            });
        }

        return res.status(204).send();
    } catch (error) {
        console.error("Logout error:", error);

        return res.status(500).json({
            error: "INTERNAL_SERVER_ERROR",
        });
    }
}