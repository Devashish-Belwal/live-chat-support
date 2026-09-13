import type { Request, Response } from "express";

import { getAdminAnalytics, assignAgentToSupervisor } from "./admin.service";

export async function assignAgent(req: Request, res: Response) {
    const agentId = Number(req.params.agentId);
    if (!Number.isInteger(agentId) || agentId <= 0) return res.status(400).json({ error: "INVALID_AGENT_ID" });
    const rawSupervisorId = req.body.supervisorId;
    let supervisorId: number | null = null;
    if (rawSupervisorId === null) {
        supervisorId = null;
    } else if (typeof rawSupervisorId === 'number' && Number.isInteger(rawSupervisorId) && rawSupervisorId > 0) {
        supervisorId = rawSupervisorId;
    } else if (typeof rawSupervisorId === 'string' && rawSupervisorId !== '' && !isNaN(Number(rawSupervisorId)) && Number.isInteger(Number(rawSupervisorId)) && Number(rawSupervisorId) > 0) {
        supervisorId = Number(rawSupervisorId);
    } else {
        return res.status(400).json({ error: "INVALID_SUPERVISOR_ID" });
    }
    try {
        const result = await assignAgentToSupervisor(agentId, supervisorId);
        return res.status(200).json({ agent: result });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '';
        if (msg === "AGENT_NOT_FOUND") return res.status(404).json({ error: "AGENT_NOT_FOUND" });
        if (msg === "SUPERVISOR_NOT_FOUND") return res.status(404).json({ error: "SUPERVISOR_NOT_FOUND" });
        console.error("Assign error:", e);
        return res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
    }
}

export async function analytics(
    _req: Request,
    res: Response,
) {
    try {
        const result = await getAdminAnalytics();
        return res.status(200).json({ supervisors: result.supervisors, agents: result.agents });
    } catch (error) {
        console.error("Admin analytics error:", error);

        return res.status(500).json({
            error: "INTERNAL_SERVER_ERROR",
        });
    }
}