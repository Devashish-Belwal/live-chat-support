import express from "express";
import { createServer } from "node:http";

const app = express();

app.get("/", (_req, res) => {
    res.json({
        message: "Backend is running",
    });
});

const server = createServer(app);

const PORT = 3001;

server.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});