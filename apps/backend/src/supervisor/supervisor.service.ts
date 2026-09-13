import { db } from "../prisma/db";

export async function listSupervisorAgents(supervisorId: number) {
    return db.orm.public.User
        .where({
            role: "AGENT",
            supervisorId: supervisorId,
        })
        .select("id", "name", "email", "supervisorId")
        .all();
}
