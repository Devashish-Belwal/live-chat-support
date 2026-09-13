import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware";
import { getSupervisorAgents } from "./supervisor.controller";

const supervisorRouter = Router();

supervisorRouter.get("/agents", requireAuth, requireRole("SUPERVISOR"), getSupervisorAgents);

export default supervisorRouter;
