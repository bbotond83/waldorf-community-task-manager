# Infrastructure Specification: U1 Local platform and audit

No hosted infrastructure is created or changed: deployment workflows stay disabled until a deployable application and a linked target project exist. The infrastructure of this unit is the local stack on the owner's machine and the same stack in CI. Source: the confirmed answers Q1 to Q4 in `infrastructure-design-questions.md`, the NFR requirements and the functional design. Where a detail depends on how the Supabase command-line tool behaves, it is marked **verify in code generation**, with the stated fallback; the first code step of this unit is a short spike that settles these items.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | Containers on Docker Desktop, started by the Supabase command-line tool, a pinned development dependency in `package.json` (exact version, no global install); the CLI's container images are the versions that CLI release ships, so pinning the CLI pins the images | Same pieces as the hosted application (Q1) |
| Networking | The start command publishes only the needed ports (database, data API, sign-in gateway, mail catcher web and SMTP) and, after start, **verifies** that each is reachable on 127.0.0.1 and not on the machine's other addresses; if the CLI cannot be configured to bind loopback only, the command fails with a message and the design falls back to a host firewall rule documented in the README (**verify in code generation**) | The stack uses the CLI's well-known default keys, so network reach is the main control (Q3) |
| Storage | Docker volumes owned by the stack; stop keeps data, reset drops and recreates it | NFR6.3 |
| Environments | Local development and CI only; staging and production are out of this unit | Team rule: no deployment workflows yet |
| Infrastructure as code | `supabase/config.toml` for the stack, migration files in `supabase/migrations/`, the migration runner and worker setup scripts in `scripts/`, and the CI workflow `.github/workflows/ci.yml` | One configuration read by both local runs and CI (Q4) |
| Resource sizing | Docker Desktop defaults; a documented minimum of 4 GB memory for Docker | Small data volumes (NFR3.3) |

## Keys

| Item | Decision |
|---|---|
| Database JWT secret, public (anon) key and service-role key | The CLI's well-known local defaults, printed by the CLI's status command. They are not secrets: anyone can find them, so they protect nothing on their own and loopback binding is the control |
| How the app and tooling get them | The start command writes the public key and the address to an ignored local environment file; the service-role key goes only to a second ignored file read by the tooling (never by the app, BR1.4) |
| Session secret | Not a stack key: generated per environment and per CI run, at least 32 characters (BR1.3) |
| Secret scan | The scan allows exactly the CLI's documented default values by an allowlist of their hashes in `scripts/verification/`; any other JWT-shaped value fails (NFR1.6) |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| Postgres | database | The stack's Postgres, one major version for local and CI; default schema `public` and four worker schemas `worker_1` to `worker_4`; one connection role per access level as the stack provides | Pinned search path on elevated functions (BR1.5) |
| Sign-in service (Auth) | identity provider | Email and password enabled; mail goes to the mail catcher; confirmation and signup settings are U2 decisions | Used by U2 |
| Data API (PostgREST) | database access for the app | `[api] schemas = ["public", "worker_1", "worker_2", "worker_3", "worker_4"]` in `config.toml`, so no runtime change of the exposed list is needed | See the worker schema row |
| Mail catcher | receives all outgoing mail locally | Local only; no real delivery | Out of scope: real email delivery |
| Disabled | Studio, storage, realtime, edge functions, analytics and the connection pooler | `[studio] enabled = false`, `[storage] enabled = false`, `[realtime] enabled = false`, `[edge_runtime] enabled = false`, `[analytics] enabled = false`, `[db.pooler] enabled = false` (**verify the exact key names in code generation**) | Q2 |

## Worker Schemas (BR10.1, BR10.3, NFR6.7)

| Step | Mechanism |
|---|---|
| Exposure | The four worker schemas are named in `[api] schemas` from the start, so the data API exposes them without a runtime change or reload (the in-database exposure setting would lose against the container's environment value, so it is not used) |
| Existence before the data API starts | A bootstrap migration in `supabase/migrations/` creates the empty schemas `worker_1` to `worker_4` and grants usage on them to the stack's API roles; it runs when the CLI starts the database, before the data API |
| Creating the tables | The runner applies the migration files to a worker schema inside one connection whose session search path is set to that schema and the system catalogue; functions use `SET search_path FROM CURRENT` so each pins exactly its own schema and the files contain no schema names (this keeps BR1.5 and the answer Q3 intent; the schema substitution is replaced by the session path, which is simpler and identical in effect) |
| Role grants | The runner grants the API roles the same table and function rights in a worker schema as in `public` (the policies themselves come from the migrations) |
| Confirmation | After setup, the tooling sends one request to the data API with the schema's profile header and waits up to 10 seconds for success; otherwise it fails naming the schema and the step |
| Selection by the app | One test server process uses one schema, taken from the validated schema setting; requests carry that schema's profile header |
| More than four workers | Not supported in this design (answer Q5); raising the limit means editing the config and the bootstrap migration |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| Local stack and its configuration file | U1 | U2, U3, U4, U5 | Loopback only; the service-role key is read only by the tooling (BR1.4) |
| Migration runner and worker-schema setup | U1 | U2, U3, U4, U5 | Each unit adds migration files; the runner applies them to the default and worker schemas |
| CI database step | U1 | U2, U3, U4, U5 | Starts the same stack with the same command; deployment workflows disabled |
| Audit write function and tables | U1 | U2, U3, U4 | Callable only by the named change functions (BR3.9) |

## Indexes and Pinning Checks (supports NFR3.3, BR1.5)

The migrations create the indexes named in `nfr-requirements/scalability-requirements.md` (audit: actor, target, time; idempotency: account, operation, key, expiry), and a catalogue test lists every elevated function and checks that it pins its search path, in the default schema and in a worker schema.
