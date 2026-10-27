# Build Instructions: B3 denied-call audit rate limit

## Dependencies

- Node 24 and npm. Install with `npm ci` from the repository root. This change adds no dependency.
- Docker and the Supabase CLI for the local database stack.

## Environment setup

- Start the local stack: `npm run db:start` (loopback-only check and acknowledgement as the start command requires).
- Apply migrations: `npm run db:migrate`. The runner applies `supabase/migrations/20261046_audit_denied_rate_limit.sql` to `public` and to each worker schema; it refuses an edited, already-applied file.
- When several Node versions are installed, put `export PATH=<node 24 bin>:$PATH` before a chained command, not a leading `PATH=...` assignment.

## Build and verification commands

| Purpose | Command |
|---------|---------|
| Type check | `npm run typecheck` |
| Lint | `npm run lint` |
| Formatting | `npm run format:check` |
| Production build | `npm run build` |
| Full local verification (CI equivalent: static checks, unit and delivery tests, every database group, shuffled database run, coverage, build, start smoke, browser suite, scans) | `npm run verify:local` |

## Build verification

- `npm run db:migrate` reports `20261046_audit_denied_rate_limit.sql` as applied once per schema, and a second run applies nothing.
- `npm run verify:local` exits 0.

## Troubleshooting

- "file changed after it was applied": a merged migration was edited. Restore it; changes go in a new file.
- "hard-coded schema name": the new migration must stay schema-neutral.
- Database tests hang on locks: another run holds the schema lock; wait for it or stop it.
