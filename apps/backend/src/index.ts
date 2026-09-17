import cookieParser from 'cookie-parser';
import express from "express";
import cors from 'cors';
import { createServer } from "node:http";

import {
    connectRedis,
    disconnectRedis
} from "./redis";
import authRouter from "./auth/auth.routes";
import conversationRouter from "./conversations/conversation.routes";
import adminRouter from "./admin/admin.routes";
import supervisorRouter from "./supervisor/supervisor.routes";
import { createWebSocketServer } from "./ws/ws.server";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({ credentials: true, origin: true }));

app.use("/auth", authRouter);
app.use("/conversations", conversationRouter);
app.use("/admin", adminRouter);
app.use("/supervisor", supervisorRouter);

app.get("/", (_req, res) => {
    res.json({
        message: "Backend is running",
    });
});

const server = createServer(app);

createWebSocketServer(server);

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