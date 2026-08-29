import { Router } from "express";

import { requireAuth } from "../auth/auth.middleware";
import {
    create,
    list,
    get,
    assign,
    close,
} from "./conversation.controller";

const conversationRouter = Router();

conversationRouter.post("/", requireAuth, create);
conversationRouter.get("/", requireAuth, list);
conversationRouter.get("/:id", requireAuth, get);
conversationRouter.post("/:id/assign", requireAuth, assign);
conversationRouter.patch("/:id/close", requireAuth, close);

export default conversationRouter;