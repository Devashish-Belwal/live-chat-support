import { Router } from "express";

import { login, logout, refresh, register } from "./auth.controller";
import { requireAuth, requireRole } from "./auth.middleware";

const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);

export default authRouter;