import { db } from "../prisma/db";
import type { UserRole } from "../auth/auth.middleware";

interface CreateConversationInput {
    userId: number;
    role: UserRole;
    candidateId?: number;
}

export async function createConversation({
    userId,
    role,
    candidateId,
}: CreateConversationInput) {
    let resolvedCandidateId: number;

    if (role === "CANDIDATE") {
        resolvedCandidateId = userId;
    } else {
        if (!candidateId) {
            throw new Error("CANDIDATE_ID_REQUIRED");
        }

        resolvedCandidateId = candidateId;
    }

    const candidate = await db.orm.public.User
        .where({
            id: resolvedCandidateId,
        })
        .first();

    if (!candidate) {
        throw new Error("CANDIDATE_NOT_FOUND");
    }

    if (candidate.role !== "CANDIDATE") {
        throw new Error("INVALID_CANDIDATE");
    }

    return db.orm.public.Conversation.create({
        candidateId: resolvedCandidateId,
    });
}

export async function listConversations(
    userId: number,
    role: UserRole,
) {
    switch (role) {
        case "CANDIDATE":
            return db.orm.public.Conversation
                .where({
                    candidateId: userId,
                })
                .orderBy((conversation) =>
                    conversation.createdAt.desc(),
                )
                .all();

        case "AGENT":
            return db.orm.public.Conversation
                .where({
                    agentId: userId,
                })
                .orderBy((conversation) =>
                    conversation.createdAt.desc(),
                )
                .all();

        case "SUPERVISOR": {
            const agents = await db.orm.public.User
                .where({
                    supervisorId: userId,
                    role: "AGENT",
                })
                .select("id")
                .all();

            const agentIds = agents.map((agent) => agent.id);

            if (agentIds.length === 0) {
                return [];
            }

            return db.orm.public.Conversation
                .where((conversation) =>
                    conversation.agentId.in(agentIds),
                )
                .orderBy((conversation) =>
                    conversation.createdAt.desc(),
                )
                .all();
        }

        case "ADMIN":
            return db.orm.public.Conversation
                .orderBy((conversation) =>
                    conversation.createdAt.desc(),
                )
                .all();
    }
}

export async function authorizeConversationAccess(
    conversationId: number,
    userId: number,
    role: UserRole,
) {
    const conversation = await db.orm.public.Conversation
        .where({
            id: conversationId,
        })
        .include("agent")
        .first();

    if (!conversation) {
        throw new Error("CONVERSATION_NOT_FOUND");
    }

    switch (role) {
        case "CANDIDATE":
            if (conversation.candidateId !== userId) {
                throw new Error("FORBIDDEN");
            }
            break;

        case "AGENT":
            if (conversation.agentId !== userId) {
                throw new Error("FORBIDDEN");
            }
            break;

        case "SUPERVISOR":
            if (
                !conversation.agent ||
                conversation.agent.supervisorId !== userId
            ) {
                throw new Error("FORBIDDEN");
            }
            break;

        case "ADMIN":
            break;
    }

    return conversation;
}

export async function getConversation(
    conversationId: number,
    userId: number,
    role: UserRole,
) {
    return authorizeConversationAccess(
        conversationId,
        userId,
        role,
    );
}

export async function assignConversation(
    conversationId: number,
    agentId: number,
    userId: number,
    role: UserRole,
) {
    if (role !== "SUPERVISOR" && role !== "ADMIN") {
        throw new Error("FORBIDDEN");
    }

    const conversation = await db.orm.public.Conversation
        .where({ id: conversationId })
        .first();

    if (!conversation) {
        throw new Error("CONVERSATION_NOT_FOUND");
    }

    const agent = await db.orm.public.User
        .where({
            id: agentId,
        })
        .first();

    if (!agent) {
        throw new Error("AGENT_NOT_FOUND");
    }

    if (agent.role !== "AGENT") {
        throw new Error("INVALID_AGENT");
    }

    if (
        role === "SUPERVISOR" &&
        agent.supervisorId !== userId
    ) {
        throw new Error("AGENT_NOT_UNDER_SUPERVISOR");
    }

    return db.orm.public.Conversation
        .where({
            id: conversationId,
        })
        .update({
            agentId,
        });
}

export async function closeConversation(
    conversationId: number,
    userId: number,
    role: UserRole,
) {
    const conversation = await db.orm.public.Conversation
        .where({
            id: conversationId,
        })
        .include("agent")
        .first();

    if (!conversation) {
        throw new Error("CONVERSATION_NOT_FOUND");
    }

    switch (role) {
        case "CANDIDATE":
            throw new Error("FORBIDDEN");

        case "AGENT":
            if (conversation.agentId !== userId) {
                throw new Error("FORBIDDEN");
            }
            break;

        case "SUPERVISOR":
            if (
                !conversation.agent ||
                conversation.agent.supervisorId !== userId
            ) {
                throw new Error("FORBIDDEN");
            }
            break;

        case "ADMIN":
            break;
    }

    // Idempotent: closing an already closed conversation is fine.
    if (conversation.status === "CLOSED") {
        return conversation;
    }

    return db.orm.public.Conversation
        .where({
            id: conversationId,
        })
        .update({
            status: "CLOSED",
            closedAt: new Date().toISOString(),
        });
}