import type { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";

const secret = process.env.JWT_SECRET;

if (!secret) {
    throw new Error("JWT_SECRET is not configured");
}

const secretKey = new TextEncoder().encode(secret);

const roles = [
    "CANDIDATE",
    "AGENT",
    "SUPERVISOR",
    "ADMIN",
] as const;

export type UserRole = (typeof roles)[number];

export interface AuthenticatedUser {
    id: number;
    role: UserRole;
}

export interface AuthenticatedRequest extends Request {
    user: AuthenticatedUser;
}

function isUserRole(value: unknown): value is UserRole {
    return (
        typeof value === "string" &&
        roles.includes(value as UserRole)
    );
}

export async function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "UNAUTHORIZED",
        });
    }

    const token = authorization.slice("Bearer ".length);

    try {
        const { payload } = await jwtVerify(token, secretKey);

        if (
            !payload.sub ||
            !isUserRole(payload.role)
        ) {
            return res.status(401).json({
                error: "INVALID_TOKEN",
            });
        }

        const userId = Number(payload.sub);

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(401).json({
                error: "INVALID_TOKEN",
            });
        }

        (req as AuthenticatedRequest).user = {
            id: userId,
            role: payload.role,
        };

        next();
    } catch {
        return res.status(401).json({
            error: "INVALID_TOKEN",
        });
    }
}

export function requireRole(...allowedRoles: UserRole[]) {
    return (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        const user = (req as AuthenticatedRequest).user;

        if (!user) {
            return res.status(401).json({
                error: "UNAUTHORIZED",
            });
        }

        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({
                error: "FORBIDDEN",
            });
        }

        next();
    };
}