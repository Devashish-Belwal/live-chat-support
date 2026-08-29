import { z } from "zod";

export const createConversationSchema = z.object({
    candidateId: z.number().int().positive().optional(),
});

export const assignConversationSchema = z.object({
    agentId: z.number().int().positive(),
});