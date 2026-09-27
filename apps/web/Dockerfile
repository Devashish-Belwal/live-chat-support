FROM oven/bun:1.3.13-alpine AS deps

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN bun install --frozen-lockfile


FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared ./packages/shared
COPY --from=deps /app/apps/web ./apps/web
COPY --from=deps /app/package.json ./package.json

WORKDIR /app/apps/web

ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* variables are evaluated at build time.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN bun run build


FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./public

COPY --from=builder \
    --chown=nextjs:nodejs \
    /app/apps/web/.next/standalone ./

COPY --from=builder \
    --chown=nextjs:nodejs \
    /app/apps/web/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
