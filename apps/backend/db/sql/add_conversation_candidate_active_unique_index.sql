-- Intentionally outside Prisma's migration graph.
-- Prisma's contract-first migration system (Prisma Next / Prisma 8) cannot represent
-- PostgreSQL partial unique indexes (WHERE "status" = 'ACTIVE') because the contract
-- language (contract.prisma / PSL) has no partial-constraint syntax, and the framework
-- requires either a contract hash transition or a documented providedInvariant for
-- same-contract DB-only edges — neither exists for this specific index.
-- This file is managed directly, not via `prisma db migrate`.

CREATE UNIQUE INDEX IF NOT EXISTS "conversation_candidate_id_active"
ON "public.conversation" ("candidateId")
WHERE "status" = 'ACTIVE';
