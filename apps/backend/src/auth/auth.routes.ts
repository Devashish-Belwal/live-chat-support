import { Router } from "express";

import { login, logout, me, refresh, register } from "./auth.controller";
import { requireAuth, requireRole, type AuthenticatedRequest } from "./auth.middleware";

const authRouter = Router();

authRouter.post("/signup", register);
authRouter.post("/login", login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);
authRouter.get("/me", requireAuth, me);

export default authRouter;