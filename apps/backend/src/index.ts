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

const wss = createWebSocketServer(server);

const PORT = 3001;

async function startServer() {
    await connectRedis();

    server.listen(PORT, () => {
        console.log(`Backend running on http://localhost:${PORT}`);
    });
}

let isShuttingDown = false;

async function shutdown() {
    if (isShuttingDown) return;

    isShuttingDown = true;
    console.log("Shutting down...");

    // 1. Stop accepting new HTTP connections
    server.close();

    // 2. Close existing WebSocket clients
    for (const socket of wss.clients) {
        socket.close(1001, "Server shutting down");
    }

    // Give clients 5 seconds to close
    const forceCloseTimer = setTimeout(() => {
        console.log("Forcefully closing remaining sockets...");

        for (const socket of wss.clients) {
            if (socket.readyState !== socket.CLOSED) {
                socket.terminate();
            }
        }
    }, 5000);

    // 3. Close the WebSocket server
    wss.close(async () => {
        clearTimeout(forceCloseTimer);
        console.log("WebSocket server closed");

        // 4. Disconnect Redis
        await disconnectRedis();

        console.log("Shutdown complete");
        process.exit(0);
    });

    // 5. Safety timeout
    setTimeout(() => {
        console.error("Shutdown timed out");
        process.exit(1);
    }, 10_000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startServer().catch((error) => {
    console.error("Failed to start backend:", error);
    process.exit(1);
});