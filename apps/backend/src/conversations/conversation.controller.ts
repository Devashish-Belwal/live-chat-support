import type { Request, Response } from "express";

import type { AuthenticatedRequest } from "../auth/auth.middleware";
import { assignConversationSchema, createConversationSchema } from "./conversation.schema";
import { assignConversation, closeConversation, createConversation, getConversation, listConversations } from "./conversation.service";

export async function create(
    req: Request,
    res: Response,
) {
    const user = (req as AuthenticatedRequest).user;

    const result = createConversationSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: "INVALID_REQUEST",
            details: result.error.flatten(),
        });
    }

    try {
        const conversation = await createConversation({
            userId: user.id,
            role: user.role,
            candidateId: result.data.candidateId,
        });

        return res.status(201).json({
            conversation,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "CANDIDATE_ID_REQUIRED"
        ) {
            return res.status(400).json({
                error: "CANDIDATE_ID_REQUIRED",
            });
        }

        if (
            error instanceof Error &&
            error.message === "CANDIDATE_NOT_FOUND"
        ) {
            return res.status(404).json({
                error: "CANDIDATE_NOT_FOUND",
            });
        }

        if (
            error instanceof Error &&
            error.message === "INVALID_CANDIDATE"
        ) {
            return res.status(400).json({
                error: "INVALID_CANDIDATE",
            });
        }

        console.error("Create conversation error:", error);

        return res.status(500).json({
            error: "INTERNAL_SERVER_ERROR",
        });
    }
}

export async function list(
    req: Request,
    res: Response,
) {
    const user = (req as AuthenticatedRequest).user;

    try {
        const conversations = await listConversations(
            user.id,
            user.role,
        );

        return res.status(200).json({
            conversations,
        });
    } catch (error) {
        console.error("List conversations error:", error);

        return res.status(500).json({
            error: "INTERNAL_SERVER_ERROR",
        });
    }
}

export async function get(
    req: Request,
    res: Response,
) {
    const user = (req as AuthenticatedRequest).user;

    const conversationId = Number(req.params.id);

    if (
        !Number.isInteger(conversationId) ||
        conversationId <= 0
    ) {
        return res.status(400).json({
            error: "INVALID_CONVERSATION_ID",
        });
    }

    try {
        const conversation = await getConversation(
            conversationId,
            user.id,
            user.role,
        );

        return res.status(200).json({
            conversation,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "CONVERSATION_NOT_FOUND"
        ) {
            return res.status(404).json({
                error: "CONVERSATION_NOT_FOUND",
            });
        }

        if (
            error instanceof Error &&
            error.message === "FORBIDDEN"
        ) {
            return res.status(403).json({
                error: "FORBIDDEN",
            });
        }

        console.error("Get conversation error:", error);

        return res.status(500).json({
            error: "INTERNAL_SERVER_ERROR",
        });
    }
}

export async function assign(
    req: Request,
    res: Response,
) {
    const user = (req as AuthenticatedRequest).user;

    const conversationId = Number(req.params.id);

    if (
        !Number.isInteger(conversationId) ||
        conversationId <= 0
    ) {
        return res.status(400).json({
            error: "INVALID_CONVERSATION_ID",
        });
    }

    const result = assignConversationSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: "INVALID_REQUEST",
            details: result.error.flatten(),
        });
    }

    try {
        const conversation = await assignConversation(
            conversationId,
            result.data.agentId,
            user.id,
            user.role,
        );

        return res.status(200).json({
            conversation,
        });
    } catch (error) {
        if (!(error instanceof Error)) {
            return res.status(500).json({
                error: "INTERNAL_SERVER_ERROR",
            });
        }

        switch (error.message) {
            case "FORBIDDEN":
                return res.status(403).json({
                    error: "FORBIDDEN",
                });

            case "CONVERSATION_NOT_FOUND":
                return res.status(404).json({
                    error: "CONVERSATION_NOT_FOUND",
                });

            case "AGENT_NOT_FOUND":
                return res.status(404).json({
                    error: "AGENT_NOT_FOUND",
                });

            case "INVALID_AGENT":
                return res.status(400).json({
                    error: "INVALID_AGENT",
                });

            case "AGENT_NOT_UNDER_SUPERVISOR":
                return res.status(403).json({
                    error: "AGENT_NOT_UNDER_SUPERVISOR",
                });

            default:
                console.error("Assign conversation error:", error);

                return res.status(500).json({
                    error: "INTERNAL_SERVER_ERROR",
                });
        }
    }
}

export async function close(
    req: Request,
    res: Response,
) {
    const user = (req as AuthenticatedRequest).user;

    const conversationId = Number(req.params.id);

    if (
        !Number.isInteger(conversationId) ||
        conversationId <= 0
    ) {
        return res.status(400).json({
            error: "INVALID_CONVERSATION_ID",
        });
    }

    try {
        const conversation = await closeConversation(
            conversationId,
            user.id,
            user.role,
        );

        return res.status(200).json({
            conversation,
        });
    } catch (error) {
        if (!(error instanceof Error)) {
            return res.status(500).json({
                error: "INTERNAL_SERVER_ERROR",
            });
        }

        switch (error.message) {
            case "CONVERSATION_NOT_FOUND":
                return res.status(404).json({
                    error: "CONVERSATION_NOT_FOUND",
                });

            case "FORBIDDEN":
                return res.status(403).json({
                    error: "FORBIDDEN",
                });

            default:
                console.error("Close conversation error:", error);

                return res.status(500).json({
                    error: "INTERNAL_SERVER_ERROR",
                });
        }
    }
}