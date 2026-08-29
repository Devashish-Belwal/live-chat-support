import { SignJWT } from "jose";

const secret = process.env.JWT_SECRET;

if (!secret) {
    throw new Error("JWT_SECRET is not configured");
}

const secretKey = new TextEncoder().encode(secret);

export async function createAccessToken(user: {
    id: number;
    role: string;
}) {
    return new SignJWT({
        role: user.role,
    })
        .setProtectedHeader({
            alg: "HS256",
        })
        .setSubject(String(user.id))
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(secretKey);
}