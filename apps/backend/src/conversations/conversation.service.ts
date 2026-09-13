import { db } from "../prisma/db";
import type { UserRole } from "../auth/auth.middleware";
import { rooms, type InMemoryMessage } from "./conversation.rooms";
import { withConversationLock } from "./conversation.lock";

interface CreateConversationInput {
    userId: number;
    role: UserRole;
}

export async function createConversation({
    userId,
    role,
}: CreateConversationInput) {
    if (role !== "CANDIDATE") {
        throw new Error("FORBIDDEN");
    }

    const resolvedCandidateId = userId;

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

    const activeConversation =
        await db.orm.public.Conversation
            .where({
                candidateId: resolvedCandidateId,
                status: "ACTIVE",
            })
            .first();

    if (activeConversation) {
        throw new Error("ACTIVE_CONVERSATION_EXISTS");
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

            const assigned = agentIds.length > 0
                ? await db.orm.public.Conversation
                    .where((conversation) =>
                        conversation.agentId.in(agentIds),
                    )
                    .include("agent")
                    .orderBy((conversation) =>
                        conversation.createdAt.desc(),
                    )
                    .all()
                : [];

            const unassigned = await db.orm.public.Conversation
                .where({ agentId: null })
                .include("agent")
                .orderBy((conversation) =>
                    conversation.createdAt.desc(),
                )
                .all();

            const seen = new Set<number>();
            const result = [];
            for (const c of [...assigned, ...unassigned]) {
                if (!seen.has(c.id)) {
                    seen.add(c.id);
                    result.push(c);
                }
            }
            return result;
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
        .include("messages")
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
                conversation.agentId !== null &&
                (!conversation.agent ||
                 conversation.agent.supervisorId !== userId)
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

    // Supervisor may only assign conversations in their scope
    if (role === "SUPERVISOR") {
        if (conversation.agentId !== null) {
            const currentAgent = await db.orm.public.User
                .where({ id: conversation.agentId })
                .first();
            if (!currentAgent || currentAgent.supervisorId !== userId) {
                throw new Error("AGENT_NOT_UNDER_SUPERVISOR");
            }
        }
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
    return withConversationLock(conversationId, async () => {
        if (role !== "AGENT") {
            throw new Error("FORBIDDEN");
        }

        const conversation = await db.orm.public.Conversation
            .where({
                id: conversationId,
            })
            .include("agent")
            .first();

        if (!conversation) {
            throw new Error("CONVERSATION_NOT_FOUND");
        }

        if (conversation.agentId !== userId) {
            throw new Error("FORBIDDEN");
        }

        // Idempotent: closing an already closed conversation is fine.
        if (conversation.status === "CLOSED") {
            return conversation;
        }

        // Persist any in-memory messages from the room to PostgreSQL.
        const room = rooms.get(conversationId);

        if (room && room.messages.length > 0) {
            await db.transaction(async (tx) => {
                for (const message of room.messages as InMemoryMessage[]) {
                    await tx.orm.public.Message.create({
                        conversationId: message.conversationId,
                        senderId: message.senderId,
                        senderRole: message.senderRole as "CANDIDATE" | "AGENT" | "SUPERVISOR" | "ADMIN",
                        content: message.content,
                        createdAt: message.createdAt,
                    });
                }

                await tx.orm.public.Conversation
                    .where({
                        id: conversationId,
                    })
                    .update({
                        status: "CLOSED",
                        closedAt: new Date().toISOString(),
                    });
            });
        } else {
            await db.orm.public.Conversation
                .where({
                    id: conversationId,
                })
                .update({
                    status: "CLOSED",
                    closedAt: new Date().toISOString(),
                });
        }

        // Clean up the in-memory room after persistence.
        if (room) {
            rooms.delete(conversationId);
        }

        return db.orm.public.Conversation
            .where({
                id: conversationId,
            })
            .include("agent")
            .first();
    });
}