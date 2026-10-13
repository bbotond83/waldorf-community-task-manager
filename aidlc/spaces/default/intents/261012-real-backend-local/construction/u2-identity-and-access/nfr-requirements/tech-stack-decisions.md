# Technology Decisions: U2 Identity and access

Existing stack kept (Next.js 16, React, strict TypeScript, Node 24, Vitest, Node test runner, Playwright, ESLint, Prettier) and U1's additions (Supabase CLI local stack, the database client wrapper, the migration runner). Source: the functional design and the confirmed answers.

| ID | Decision | Rationale |
|---|---|---|
| NFR2.1 | The sign-in service is the stack's own (GoTrue): password sign-in, recovery email, admin access for create, ban and the narrow functions; sessions are its sessions | One identity provider, as in the hosted app; no credentials stored by us (ADR-007) |
| NFR2.2 | Cookies carry the sign-in service's tokens through the Supabase server-side helper package at an exact pinned version, with the app owning the cookie attributes | The library already implements token refresh and cookie handling; the app sets httpOnly, sameSite lax and secure |
| NFR2.3 | Outgoing invitation email is sent over SMTP to the stack's mail server with a small, exactly pinned SMTP client library | The sign-in service's invitation email cannot carry the app's own token link (BR2.10); locally the mail catcher receives it |
| NFR2.4 | The stack configuration (`supabase/config.toml`) sets: open sign-up off in both places, 30-day inactivity timeout, about 1-hour access tokens, 1-hour one-time-code lifetime, the minimum password length of 8, the recovery email template, and the sign-in service's rate limits as far as the service offers them: the service limits sign-in and token requests per source address (not per account), so the setting is 30 sign-in or token requests per 5 minutes per source address (the owner's answer Q4, read as per address of the caller), emails per hour for the whole project at the service's setting (10 per hour per recipient is not available; the service's per-user gap between emails is set to 60 seconds); exact key names are confirmed in code generation, with the fallback in `functional-spec.md` | A read-back test (NFR2.9) |
| NFR2.9 | A configuration read-back test starts the real stack and checks every value NFR2.4 names, through the sign-in service's settings endpoint and the configuration file: open sign-up refused, password minimum, one-time-code lifetime, inactivity timeout, token lifetime, rate-limit values, email gap | Test against the real stack; a mismatch fails the unit |
| NFR2.5 | Database objects are plain SQL migrations applied by U1's runner: tables, partial unique index, policies, the named functions with `SET search_path FROM CURRENT`, privilege revokes for service_role | Same mechanism as U1 |
| NFR2.6 | Hashing for invitation tokens and for the email key is done in the database (SHA-256 for tokens, HMAC for the email key with a key derived from the session secret passed per call) or in the server with Node's built-in crypto; no new hashing library | Standard primitives |
| NFR2.7 | Screens are server components with small client form components and server actions; Hungarian copy is kept in one copy module | Matches the existing app structure |
| NFR2.8 | Checks before the unit completes: strict type check, lint, format check, all tests, production build, start smoke, the critical browser flows with the automated accessibility check, secret and privacy scans, dependency audit (high and critical block), coverage at or above 80% lines, branches and functions on all production source | Team rules |
| NFR8.1 | Identifiers, schema names, functions, logs and technical documents are English; all screen text is Hungarian | NFR8 |

New dependencies are added only as exact pinned versions and must pass the dependency audit.

Numbering: the requirement ids `NFRx.y` in this unit are scoped to this unit's directory; U1 has its own ids with the same prefixes, and each unit's traceability file refers only to its own.
