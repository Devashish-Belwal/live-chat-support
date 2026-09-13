import { Router } from "express";

import { requireAuth, requireRole } from "../auth/auth.middleware";
import {
    create,
    list,
    get,
    assign,
    close,
} from "./conversation.controller";

const conversationRouter = Router();

conversationRouter.post("/", requireAuth, requireRole("CANDIDATE"), create);
conversationRouter.get("/", requireAuth, list);
conversationRouter.get("/:id", requireAuth, get);
conversationRouter.post("/:id/assign", requireAuth, assign);
conversationRouter.post("/:id/close", requireAuth, requireRole("AGENT"), close);

export default conversationRouter;