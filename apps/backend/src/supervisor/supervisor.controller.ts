import type { Request, Response } from "express";

import { listSupervisorAgents } from "./supervisor.service";

export async function getSupervisorAgents(req: Request, res: Response) {
    const user = (req as any).user as { id: number };
    try {
        const agents = await listSupervisorAgents(user.id);
        return res.status(200).json({ agents });
    } catch (error) {
        console.error("List supervisor agents error:", error);
        return res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
    }
}
