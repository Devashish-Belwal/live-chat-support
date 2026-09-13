import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { jwtVerify } from "jose";

import { authorizeConversationAccess, closeConversation } from "../conversations/conversation.service";
import { db } from "../prisma/db";
import { rooms } from "../conversations/conversation.rooms";
import { withConversationLock } from "../conversations/conversation.lock";

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

type UserRole = (typeof roles)[number];

export interface WebSocketUser {
    id: number;
    role: UserRole;
}

interface SocketState {
    user: WebSocketUser;
    conversations: Set<number>;
}

interface InMemoryMessage {
    conversationId: number;
    senderId: number;
    senderRole: UserRole;
    content: string;
    createdAt: string;
}

const socketStates = new WeakMap<WebSocket, SocketState>();

function isUserRole(value: unknown): value is UserRole {
    return (
        typeof value === "string" &&
        roles.includes(value as UserRole)
    );
}

async function authenticateToken(
    token: string,
): Promise<WebSocketUser | null> {
    try {
        const { payload } = await jwtVerify(
            token,
            secretKey,
        );

        if (
            !payload.sub ||
            !isUserRole(payload.role)
        ) {
            return null;
        }

        const userId = Number(payload.sub);

        if (
            !Number.isInteger(userId) ||
            userId <= 0
        ) {
            return null;
        }

        return {
            id: userId,
            role: payload.role,
        };
    } catch {
        return null;
    }
}

function broadcast(
    conversationId: number,
    message: object,
) {
    const room = rooms.get(conversationId);

    if (!room) {
        return;
    }

    const payload = JSON.stringify(message);

    for (const socket of room.sockets) {
        if (socket.readyState === socket.OPEN) {
            socket.send(payload);
        }
    }
}

function sendError(
    socket: WebSocket,
    message: string,
) {
    socket.send(
        JSON.stringify({
            event: "ERROR",
            data: {
                message,
            },
        }),
    );
}

function joinRoom(
    socket: WebSocket,
    conversationId: number,
) {
    let room = rooms.get(conversationId);

    if (!room) {
        room = {
            sockets: new Set<WebSocket>(),
            messages: [],
        };

        rooms.set(conversationId, room);
    }

    room.sockets.add(socket);

    const state = socketStates.get(socket);

    if (state) {
        state.conversations.add(conversationId);
    }
}

async function handleJoinConversation(
    socket: WebSocket,
    data: unknown,
) {
    const state = socketStates.get(socket);

    if (!state) {
        sendError(socket, "Unauthenticated");
        return;
    }

    if (
        state.user.role !== "CANDIDATE" &&
        state.user.role !== "AGENT"
    ) {
        sendError(
            socket,
            "Only candidates and agents can join conversations",
        );
        return;
    }

    if (
        typeof data !== "object" ||
        data === null
    ) {
        sendError(
            socket,
            "Invalid conversation data",
        );
        return;
    }

    const rawConversationId = (
        data as {
            conversationId?: unknown;
        }
    ).conversationId;

    const conversationId = Number(
        rawConversationId,
    );

    if (
        !Number.isInteger(conversationId) ||
        conversationId <= 0
    ) {
        sendError(
            socket,
            "Invalid conversationId",
        );
        return;
    }

    try {
        const conversation =
            await authorizeConversationAccess(
                conversationId,
                state.user.id,
                state.user.role,
            );

        if (
            conversation.status !== "ACTIVE"
        ) {
            sendError(
                socket,
                "Conversation is closed",
            );
            return;
        }

        joinRoom(
            socket,
            conversationId,
        );

        // Send persisted message history
        const persistedMessages = await db.orm.public.Message
            .where({
                conversationId: conversationId,
            })
            .orderBy((message) =>
                message.createdAt.asc(),
            )
            .all();

        // Send in-memory messages
        const room = rooms.get(conversationId);
        const memoryMessages = room?.messages || [];

        // Combine and send all history
        const allMessages = [
            ...persistedMessages.map(msg => ({
                conversationId: msg.conversationId,
                senderId: msg.senderId,
                senderRole: msg.senderRole.toLowerCase(),
                content: msg.content,
                createdAt: msg.createdAt,
            })),
            ...memoryMessages.map(msg => ({
                conversationId: msg.conversationId,
                senderId: msg.senderId,
                senderRole: msg.senderRole.toLowerCase(),
                content: msg.content,
                createdAt: msg.createdAt,
            }))
        ];

        socket.send(
            JSON.stringify({
                event: "JOINED_CONVERSATION",
                data: {
                    conversationId,
                    messages: allMessages,
                },
            }),
        );

        console.log(
            `User ${state.user.id} joined conversation ${conversationId}`,
        );
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "CONVERSATION_NOT_FOUND"
        ) {
            sendError(
                socket,
                "Conversation not found",
            );
            return;
        }

        if (
            error instanceof Error &&
            error.message === "FORBIDDEN"
        ) {
            sendError(
                socket,
                "You are not allowed to join this conversation",
            );
            return;
        }

        console.error(
            "JOIN_CONVERSATION error:",
            error,
        );

        sendError(
            socket,
            "Internal server error",
        );
    }
}

async function handleSendMessage(
    socket: WebSocket,
    data: unknown,
) {
    const state = socketStates.get(socket);

    if (!state) {
        sendError(socket, "Unauthenticated");
        return;
    }

    if (
        state.user.role !== "CANDIDATE" &&
        state.user.role !== "AGENT"
    ) {
        sendError(
            socket,
            "Only candidates and agents can send messages",
        );
        return;
    }

    if (
        typeof data !== "object" ||
        data === null
    ) {
        sendError(socket, "Invalid message data");
        return;
    }

    const rawConversationId = (
        data as {
            conversationId?: unknown;
        }
    ).conversationId;

    const content = (
        data as {
            content?: unknown;
        }
    ).content;

    const conversationId = Number(
        rawConversationId,
    );

    if (
        !Number.isInteger(conversationId) ||
        conversationId <= 0
    ) {
        sendError(
            socket,
            "Invalid conversationId",
        );
        return;
    }

    if (
        typeof content !== "string" ||
        content.trim().length === 0 ||
        content.length > 2000
    ) {
        sendError(
            socket,
            "Message content cannot be empty",
        );
        return;
    }

    if (!state.conversations.has(conversationId)) {
        sendError(
            socket,
            "You have not joined this conversation",
        );
        return;
    }

    try {
        const result = await withConversationLock(
            conversationId,
            async () => {
                const conversation =
                    await authorizeConversationAccess(
                        conversationId,
                        state.user.id,
                        state.user.role,
                    );

                if (conversation.status !== "ACTIVE") {
                    throw new Error("CONVERSATION_CLOSED");
                }

                const room = rooms.get(conversationId);
                if (!room) {
                    throw new Error("ROOM_MISSING");
                }

                const message: InMemoryMessage = {
                    conversationId,
                    senderId: state.user.id,
                    senderRole: state.user.role,
                    content: content.trim(),
                    createdAt: new Date().toISOString(),
                };

                room.messages.push(message);

                return message;
            },
        );

        broadcast(
            conversationId,
            {
                event: "NEW_MESSAGE",
                data: {
                    conversationId: String(
                        result.conversationId,
                    ),
                    senderId: String(
                        result.senderId,
                    ),
                    senderRole:
                        result.senderRole.toLowerCase(),
                    content: result.content,
                    createdAt: result.createdAt,
                },
            },
        );
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "CONVERSATION_NOT_FOUND"
        ) {
            sendError(
                socket,
                "Conversation not found",
            );
            return;
        }

        if (
            error instanceof Error &&
            error.message === "FORBIDDEN"
        ) {
            sendError(
                socket,
                "You are not allowed to send messages in this conversation",
            );
            return;
        }

        if (
            error instanceof Error &&
            error.message === "CONVERSATION_CLOSED"
        ) {
            sendError(
                socket,
                "Conversation is closed",
            );
            return;
        }

        if (
            error instanceof Error &&
            error.message === "ROOM_MISSING"
        ) {
            sendError(
                socket,
                "Conversation room does not exist",
            );
            return;
        }

        console.error(
            "SEND_MESSAGE error:",
            error,
        );

        sendError(
            socket,
            "Internal server error",
        );
    }
}

function handleLeaveConversation(
    socket: WebSocket,
    data: unknown,
) {
    const state = socketStates.get(socket);

    if (!state) {
        sendError(socket, "Unauthenticated");
        return;
    }

    if (
        typeof data !== "object" ||
        data === null
    ) {
        sendError(socket, "Invalid conversation data");
        return;
    }

    const rawConversationId = (
        data as {
            conversationId?: unknown;
        }
    ).conversationId;

    const conversationId = Number(
        rawConversationId,
    );

    if (
        !Number.isInteger(conversationId) ||
        conversationId <= 0
    ) {
        sendError(
            socket,
            "Invalid conversationId",
        );
        return;
    }

    if (!state.conversations.has(conversationId)) {
        sendError(
            socket,
            "You have not joined this conversation",
        );
        return;
    }

    const room = rooms.get(conversationId);

    if (room) {
        room.sockets.delete(socket);
        // DO NOT delete room here - preserve messages until explicit close
        // Only clean up room when conversation is closed via service
    }

    state.conversations.delete(conversationId);

    socket.send(
        JSON.stringify({
            event: "LEFT_CONVERSATION",
            data: {
                conversationId,
            },
        }),
    );

    console.log(
        `User ${state.user.id} left conversation ${conversationId}`,
    );
}

async function handleCloseConversation(
    socket: WebSocket,
    data: unknown,
) {
    const state = socketStates.get(socket);

    if (!state) {
        sendError(socket, "Unauthenticated");
        return;
    }

    if (state.user.role !== "AGENT") {
        sendError(
            socket,
            "Only the assigned agent can close a conversation",
        );
        return;
    }

    if (
        typeof data !== "object" ||
        data === null
    ) {
        sendError(
            socket,
            "Invalid conversation data",
        );
        return;
    }

    const rawConversationId = (
        data as {
            conversationId?: unknown;
        }
    ).conversationId;

    const conversationId = Number(
        rawConversationId,
    );

    if (
        !Number.isInteger(conversationId) ||
        conversationId <= 0
    ) {
        sendError(
            socket,
            "Invalid conversationId",
        );
        return;
    }

    if (!state.conversations.has(conversationId)) {
        sendError(
            socket,
            "You have not joined this conversation",
        );
        return;
    }

    try {
        const conversation =
            await authorizeConversationAccess(
                conversationId,
                state.user.id,
                state.user.role,
            );

        if (conversation.status === "CLOSED") {
            sendError(
                socket,
                "Conversation is already closed",
            );
            return;
        }

        const room = rooms.get(conversationId);
        if (!room) {
            sendError(socket, "Conversation room does not exist");
            return;
        }
        const socketsToNotify = Array.from(room.sockets);

        await closeConversation(
            conversationId,
            state.user.id,
            state.user.role,
        );

        // Notify connected clients
        for (const s of socketsToNotify) {
            if (s.readyState === s.OPEN) {
                s.send(JSON.stringify({
                    event: "CONVERSATION_CLOSED",
                    data: { conversationId: String(conversationId) },
                }));
            }
        }

        // Clean up sockets tracking
        for (const s of socketsToNotify) {
            const roomState = socketStates.get(s);
            if (roomState) {
                roomState.conversations.delete(conversationId);
            }
        }

        console.log(
            `Agent ${state.user.id} closed conversation ${conversationId}`,
        );
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "CONVERSATION_NOT_FOUND"
        ) {
            sendError(
                socket,
                "Conversation not found",
            );
            return;
        }

        if (
            error instanceof Error &&
            error.message === "FORBIDDEN"
        ) {
            sendError(
                socket,
                "You are not allowed to close this conversation",
            );
            return;
        }

        console.error(
            "CLOSE_CONVERSATION error:",
            error,
        );

        sendError(
            socket,
            "Internal server error",
        );
    }
}

export function createWebSocketServer(
    server: Server,
) {
    const wss = new WebSocketServer({
        server,
        path: "/ws",
    });

    wss.on("connection", async (socket, request) => {
        const url = new URL(
            request.url ?? "",
            `http://${request.headers.host}`,
        );

        const token = url.searchParams.get("token");

        if (!token) {
            socket.close(1008, "Missing token");
            return;
        }

        const user = await authenticateToken(token);

        if (!user) {
            socket.close(1008, "Invalid token");
            return;
        }

        socketStates.set(socket, {
            user,
            conversations: new Set(),
        });

        console.log(
            `WebSocket connected: user=${user.id} role=${user.role}`,
        );

        socket.on("message", async (raw) => {
            let message: unknown;

            try {
                message = JSON.parse(raw.toString());
            } catch {
                sendError(socket, "Invalid JSON");
                return;
            }

            if (
                typeof message !== "object" ||
                message === null
            ) {
                sendError(socket, "Invalid message");
                return;
            }

            const event = (message as {
                event?: unknown;
            }).event;

            const data = (message as {
                data?: unknown;
            }).data;

            if (event === "JOIN_CONVERSATION") {
                await handleJoinConversation(socket, data);
                return;
            }

            if (event === "SEND_MESSAGE") {
                await handleSendMessage(socket, data);
                return;
            }

            if (event === "LEAVE_CONVERSATION") {
                handleLeaveConversation(socket, data);
                return;
            }

            if (event === "CLOSE_CONVERSATION") {
                await handleCloseConversation(
                    socket,
                    data,
                );
                return;
            }

            sendError(socket, "Unknown event");
        });

        socket.on("close", () => {
            const state = socketStates.get(socket);

            if (state) {
                for (const conversationId of state.conversations) {
                    const room = rooms.get(conversationId);

                    if (!room) {
                        continue;
                    }

                    room.sockets.delete(socket);
                    // DO NOT delete room here - let explicit close handle cleanup
                    // This preserves in-memory messages until agent closes conversation
                }
            }

            console.log(
                `WebSocket disconnected: user=${user.id}`,
            );
        });

        socket.send(
            JSON.stringify({
                event: "CONNECTED",
                data: {
                    userId: user.id,
                    role: user.role,
                },
            }),
        );
    });

    return wss;
}