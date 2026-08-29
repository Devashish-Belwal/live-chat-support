import Redis from "ioredis";

export const redis = new Redis(process.env.REDIS_URL!, {
    lazyConnect: true,
});

redis.on("error", (error) => {
    console.error("Redis error:", error);
});

export async function connectRedis() {
    await redis.connect();
    console.log("Redis connected");
}

export async function disconnectRedis() {
    await redis.quit();
    console.log("Redis disconnected");
}