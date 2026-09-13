import type { WebSocket } from "ws";

export interface InMemoryMessage {
    conversationId: number;
    senderId: number;
    senderRole: string;
    content: string;
    createdAt: string;
}

export interface ConversationRoom {
    sockets: Set<WebSocket>;
    messages: InMemoryMessage[];
}

export const rooms = new Map<number, ConversationRoom>();
