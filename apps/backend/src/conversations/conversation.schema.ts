import { z } from "zod";

export const createConversationSchema = z.object({});

export const assignConversationSchema = z.object({
    agentId: z.number().int().positive(),
});