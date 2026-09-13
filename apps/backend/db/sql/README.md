# PostgreSQL Partial Unique Index — External DB Management

Why outside Prisma migration graph:
- The required constraint is `CREATE UNIQUE INDEX ... ON conversation (candidateId) WHERE status = 'ACTIVE'`.
- Prisma 8 contract.prisma / PSL has no syntax for partial unique constraints (`@@unique` applies to full column, no `WHERE`).
- The framework's same-contract (`from == to`) data-only edge requires `providedInvariants` describing the DB change, but no framework-documented invariant exists for asserting partial unique index existence.
- The framework's `migrationHash` mechanism validates package integrity over `ops.json` + `migration.json`; attempting to represent this as a self-edge fails framework validation (MIGRATION.CONTRACT_SPACE_VIOLATION / sameSourceAndTarget).

Management mechanism:
- SQL file: `db/sql/add_conversation_candidate_active_unique_index.sql`
- Idempotent (`IF NOT EXISTS`).
- Apply directly to PostgreSQL when needed (e.g., via psql, deployment pipeline, or DB init script).
- Not referenced by `prisma db migrate`; does not affect migration graph.
