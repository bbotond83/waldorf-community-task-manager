# Tech Stack Decisions: u14-removal-and-anonymisation

Sources: `technology-stack.md`, `functional-spec.md` and `rules.md` of this Unit, and the constraints in `requirements.md`. Contains no names or contact details.

Everything stays in the existing stack; this Unit adds no technology.

| Area | Decision | Why |
|---|---|---|
| Business rules | Postgres functions in a new forward-only migration, behind row-level security, following the use-case template | Team rule; every earlier removal step is built this way |
| Screens | The existing Next.js admin area and its form and state components | The two changed pages already use them |
| Ending sessions | The existing server-side step used by U3's parent removal, called with every returned account | It already ends the sign-in service's sessions |
| Tests | Database tests in `tests/database/` on the local stack; Vitest for application code; Playwright for the removal pages | Team testing posture |
| Design | Stitch for the new and changed pages before building | Team rule |

No new library, service or setting is needed.
