import { db } from "../prisma/db";

export async function getAdminAnalytics() {
    const supervisors = await db.orm.public.User
        .where({
            role: "SUPERVISOR",
        })
        .select("id", "name")
        .all();

    const analytics = await Promise.all(
        supervisors.map(async (supervisor) => {
            const agents = await db.orm.public.User
                .where({
                    supervisorId: supervisor.id,
                    role: "AGENT",
                })
                .select("id")
                .all();

            const agentIds = agents.map((agent) => agent.id);

            let conversationsHandled = 0;

            if (agentIds.length > 0) {
                const result = await db.orm.public.Conversation
                    .where((conversation) =>
                        conversation.agentId.in(agentIds),
                    )
                    .aggregate((aggregate) => ({
                        total: aggregate.count(),
                    }));

                conversationsHandled = result.total;
            }

            return {
                id: supervisor.id,
                name: supervisor.name,
                agentCount: agents.length,
                conversationsHandled,
            };
        }),
    );

    const agents = await db.orm.public.User
        .where({ role: "AGENT" })
        .select("id", "name", "email", "supervisorId")
        .all();

    return { supervisors: analytics, agents };
}
export async function assignAgentToSupervisor(agentId: number, supervisorId: number | null) {
    const agent = await db.orm.public.User.where({ id: agentId, role: "AGENT" }).first();
    if (!agent) throw new Error("AGENT_NOT_FOUND");
    if (supervisorId !== null) {
        const sup = await db.orm.public.User.where({ id: supervisorId, role: "SUPERVISOR" }).first();
        if (!sup) throw new Error("SUPERVISOR_NOT_FOUND");
    }
    await db.orm.public.User.where({ id: agentId, role: "AGENT" }).update({ supervisorId: supervisorId === null ? null : supervisorId });
    return await db.orm.public.User.select("id", "name", "email", "supervisorId").where({ id: agentId }).first();
}
