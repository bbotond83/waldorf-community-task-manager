# Logical Components: u13-lending-library

Sources: the five design files of this Unit, `functional-spec.md`, and C1, C8, C9, C16 and C17 in `contract-summary.md`. The Unit stays inside the existing app and local database; nothing new is deployed.

## Inventory

| Component | Kind | Where NFR patterns apply |
|---|---|---|
| Library tables: books, loans, return watches | Database tables, no direct right for signed-in accounts | Guards (NFR7.3), no history read (NFR1.4), partial unique index (NFR5.2) |
| Command functions: add, change, remove book; borrow; set until; return; watch add and remove | Named Postgres functions, C1 template | Caller check (NFR3), once key (NFR5.1), lock order (NFR5.6), atomic steps (NFR7.1, NFR7.2), audit (NFR4.1) |
| Read functions: book list, book get | Named Postgres functions returning one document | One call per page (NFR9.4), display names only (NFR1.2), accent-folding search (NFR9.1) |
| Search helper | Small immutable function | Search without an extension |
| Book facts function `book_notice_facts` | Postgres function named by the target's `facts_function` column; the only source of notice text | Names the book and, for the reminder, the changeover date only (NFR10.1); reads removed books; service-role safe |
| Notice kinds `book_returned`, `book_return_due` and target `book` | Rows in U5's registries, added by this Unit's migration | Names the book only (NFR10.1), failures on the delivery-problems screen (NFR4.6) |
| Timed check `library_return_due` | Registry row for U5's daily run | Budapest-date window (NFR7.4), once key (NFR5.7), recorded outcome (NFR4.7) |
| Removal pair | `library_removal_preview` and `_apply` for the C16 removal block | Zero counts for nothing held (NFR11.1), lock order (NFR5.6) |
| `migration_load_book` | Service-role function for the one-off load (C17) | Code-only result (NFR3.6, NFR7.3), idempotent by key |
| Screens | Next.js pages with the `library-` class prefix: list, book page, new book, edit book | Hungarian copy (NFR8.1), Stitch design, keyboard and phone width (NFR8.2) |
| Copy module entries and authorization entries | `authorization.ts`, `role-policy.ts`, navigation, `authorization-matrix.json`, copy | NFR3.9, NFR4.8 |
| Seed and test files | Large seed with 300 books; database test files in their script and the shuffled run | NFR6, NFR9 |

## Failure Domains and Blast Radius

- **All in one database transaction:** a command either completes or leaves nothing, so a fault has no partial effect beyond its own request.
- **Email is outside the transaction:** a failed email affects one notice and is listed on the delivery-problems screen; it never undoes a return.
- **Daily run:** one failing check is recorded and the others still run; the library check cannot stop the other checks.
- **Shared resources:** the book row lock (shared with every command on that book), U5's notice and run registries, and the audit table. None is edited by this Unit's code beyond registered rows.
- **Isolation:** the library functions touch only their own three tables plus the shared notice, audit and family helpers through existing functions. No other unit's function is changed.
