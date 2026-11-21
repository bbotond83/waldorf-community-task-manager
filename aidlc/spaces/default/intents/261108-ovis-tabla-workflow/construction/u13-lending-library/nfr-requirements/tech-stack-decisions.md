# Tech Stack Decisions: u13-lending-library

This Unit stays inside the stack in `technology-stack.md`, as the constraints in `requirements.md` require. It follows `functional-spec.md`, `rules.md` and `contract-summary.md`.

## Decisions

| Area | Decision | Reason |
|---|---|---|
| Rules | Named Postgres functions behind row-level security, in one new forward-only migration file | `team.md`; keeps every check on the database side |
| Structure | Three new tables (books, loans, return watches), with a partial unique index that allows one open loan per book | The database refuses a second open loan as a last guard (BR133.2) |
| Where a book is | Derived from the open loan, never stored on the book | One record cannot disagree with itself |
| Notices | Two kinds and one target registered in U5's registries by this Unit's migration; sent through `notice_send` | C8; U5's functions are not edited |
| Daily check | One registry row inserted by this Unit's migration; the function takes the moment of the run | C9; safe to run twice and testable without waiting |
| Text | Titles, authors and descriptions are plain text with database length checks, escaped on output | No markup support is needed (NFR1.3) |
| Search | The list function filters by title and authors in the database, ignoring case and accents. Accents are folded by a small immutable helper function in the migration (`translate` over the Hungarian accented letters, with the search text's `%`, `_` and escape character escaped), not by an extension; it names no schema, so it works with every function's pinned search path and the worker schemas | One read, no search of data already sent to the browser; no new extension |
| Time | The "until when" date, the reminder window and the changeover date are compared in Budapest dates inside the database | Matches the rest of the app and can be tested without waiting |
| Screens | The existing Next.js app and `app/globals.css`, with the `library-` class prefix (kebab-case) for the library cards, which sit beside the parent task card | `library-` is a new area prefix under the team rule that new areas get their own prefix; the mockups already name it |
| Tests | The existing database, Vitest and Playwright suites | No new tool is needed |

No new package, service or scheduler is added.
