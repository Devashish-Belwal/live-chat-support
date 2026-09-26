FROM oven/bun:1.2-alpine AS builder
WORKDIR /app

# Copy root workspace configurations
COPY package.json bun.lock tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# Install dependencies for workspace
RUN bun install --frozen-lockfile

# Generate Prisma contract
WORKDIR /app/apps/backend
RUN bun run contract:emit

FROM oven/bun:1.2-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy necessary workspace files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/backend ./apps/backend

WORKDIR /app/apps/backend

EXPOSE 3001
CMD ["bun", "src/index.ts"]
