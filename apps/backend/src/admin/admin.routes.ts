import { Router } from "express";

import { requireAuth, requireRole } from "../auth/auth.middleware";
import { analytics, assignAgent } from "./admin.controller";

const adminRouter = Router();

adminRouter.get(
    "/analytics",
    requireAuth,
    requireRole("ADMIN"),
    analytics,
);

adminRouter.patch(
    "/agents/:agentId/supervisor",
    requireAuth,
    requireRole("ADMIN"),
    assignAgent,
);

export default adminRouter;
