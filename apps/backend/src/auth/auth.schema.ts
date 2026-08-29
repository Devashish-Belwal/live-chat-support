import { z } from "zod";

export const registerSchema = z.object({
    email: z.email(),
    password: z.string().min(8),
    name: z.string().min(1).max(100),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(8),
});

export const refreshSchema = z.object({
    refreshToken: z.string().min(1),
});