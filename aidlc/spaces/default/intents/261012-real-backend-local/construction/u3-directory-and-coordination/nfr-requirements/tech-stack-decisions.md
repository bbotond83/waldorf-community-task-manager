# Technology Decisions: U3 Directory, settings and coordination

Existing stack kept (Next.js 16, React, strict TypeScript, Node 24, Vitest, Node test runner, Playwright, ESLint, Prettier) with U1's local stack and migration runner and U2's identity additions. Source: the functional design and the answers in `nfr-requirements-questions.md`.

| ID | Decision | Rationale |
|---|---|---|
| NFR2.10 | Tables, policies and the named use-case functions are plain SQL migrations applied by U1's runner, with `SET search_path FROM CURRENT` and privilege revokes, like U1 and U2 | One mechanism; ADR-001 and ADR-011 |
| NFR2.11 | Cross-block reads and writes are the named kernel functions (the list in rules.md), never foreign keys or direct table access from other blocks | ADR-001; keeps blocks independent |
| NFR2.12 | Race safety uses a row lock on the task (and on both tasks in ascending id order for swaps) plus a unique constraint for one non-removed assignment per family and task | The database is the single place where capacity is decided; no application-level locks |
| NFR2.13 | The teacher schedule is a function returning rows, not a table or materialized view | Always current; no refresh logic for 1500 assignments |
| NFR2.14 | The parent and admin ports keep their TypeScript shapes; the adapters call the functions through U1's database client wrapper and map results once (BR32.4, BR32.8) | Screens stay on the same facades |
| NFR2.15 | Screens stay server components with small client forms and server actions; Hungarian copy in the existing copy modules | Matches the existing structure |
| NFR2.16 | Checks before the unit completes: strict type check, lint, format check, all tests, production build, start smoke, the critical browser flows with the accessibility scan, secret and privacy scans, dependency audit (high and critical block), and at least 80% line, branch and function coverage across all production source, measured after the old modules are deleted (BR34.1) | Team practice and NFR2 |
| NFR2.17 | These proofs run on every build and block the unit: the code-by-code contract test for the result codes (BR32.8), the search test that the old constants are gone (ledger D22), and the rule that an old module is deleted only when every one of its ledger rows has a proof (BR34.1) | Makes the carry-over rules enforceable |
| NFR8.2 | Identifiers, schema names, functions, logs and technical documents are English; all screen text is Hungarian | NFR8 |

No new dependencies. Numbering: ids in this unit are scoped to this unit's directory; U1 and U2 have their own with the same prefixes.
