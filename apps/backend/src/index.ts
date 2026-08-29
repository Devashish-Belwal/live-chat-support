import express from "express";
import { createServer } from "node:http";

import {
    connectRedis,
    disconnectRedis,
} from "./redis";
import authRouter from "./auth/auth.routes";
import conversationRouter from "./conversations/conversation.routes";
import { type AuthenticatedRequest, requireAuth } from "./auth/auth.middleware";
import { createWebSocketServer } from "./ws/ws.server";

const app = express();

app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/conversations", conversationRouter);

app.get("/", (_req, res) => {
    res.json({
        message: "Backend is running",
    });
});



app.get("/api/auth/me", requireAuth, (req, res) => {
    const user = (req as AuthenticatedRequest).user;

    res.json({
        user,
    });
});




const server = createServer(app);

const wss = createWebSocketServer(server);

const PORT = 3001;

async function startServer() {
    await connectRedis();

    server.listen(PORT, () => {
        console.log(`Backend running on http://localhost:${PORT}`);
    });
}

async function shutdown() {
    console.log("Shutting down...");

    server.close(async () => {
        await disconnectRedis();
        process.exit(0);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startServer().catch((error) => {
    console.error("Failed to start backend:", error);
    process.exit(1);
});