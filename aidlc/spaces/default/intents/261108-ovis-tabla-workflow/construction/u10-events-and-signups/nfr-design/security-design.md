# Security Design: u10-events-and-signups

How the targets in `security-requirements.md` are met, following `functional-spec.md`, `tech-stack-decisions.md` and contracts C1, C2, C6, C8, C13, C14 and C16 in `contract-summary.md`. Contains no names or contact details.

## Authorization Architecture

**Reads.** Every read function checks the session and `can_read_community` (C2) first. A teacher, parent, group administrator and super administrator read every event (BR104.1); anyone else gets the denied result, never an empty list (NFR3.1).

**Event commands.** Create, change, cancel, notices, tale and roles call one manager decision (BR100.1): a super admin, or the group's administrator for a group event. A parent marked as organiser gains no edit right (BR106.2); the mark only makes them an organiser for `event_organisers`. A teacher, an organiser-only parent and a manager of another group fail the same check with the denied code (NFR3.2, NFR3.4).

**Sign-ups and offers.** The change and withdraw functions look the row up only where its parent is the caller's own parent record, so a row of another family and a made-up id fail the same lookup with the same denied result (NFR3.3). A row already withdrawn answers not found to its owner, as BR110.1 says. A manager's removal uses its own function and rule (BR110.2) and gives the same denied result for a real row and a made-up id, as the owner functions do.

**Typed names.** `event_role_clear_name` calls U1's super-admin decision point before any lookup (NFR3.5).

**Internal functions.** `event_is_summer`, `event_deadline`, `event_organisers` and the removal pair are never granted to a signed-in role; they are called only by other database functions or by the owner (NFR3.6).

**Rights and grants.** Every function starts with `revoke all`, grants `execute` explicitly to the roles it needs, pins its search path and writes only through its own statements; tables stay read-only for signed-in accounts (NFR3.7). Rights are read from the database at each call, so a revoked grant or removed parent applies at the next request (NFR3.8). The authorization matrix gains the new rows (NFR3.9).

## Data Protection

| Requirement | Design |
|---|---|
| NFR1.1 | The seed and tests use invented people; test addresses go on the privacy allowlist. |
| NFR1.2 | Reads build people from the C6 display only, with exact field-list tests; a typed name is returned as text without a link. |
| NFR1.3 | The new tables hold no reference to a child, a family's health or a diet; the three ticks are columns of the offer only. A catalogue test lists the columns. |
| NFR1.4 | Notes, dishes and notices are stored as plain text with length checks and are never rendered as markup, so the page escapes them. |
| NFR10.1 | The `event` facts function returns title, dates and place only; notices are built from it and never from a sign-up, offer or note. |

## Audit

Each audited action of BR123.1 writes one entry in the same transaction through the existing audit helper, with the action name, the actor and opaque ids (NFR4.1). The idempotency record makes a repeated click return the stored result and write nothing more (NFR4.2). Denied attempts use the existing denied audit and rate limit (NFR4.3).

## Threat Handling

| Threat | Design |
|---|---|
| Direct call for another family's row | Lookup scoped to the caller's own parent record (NFR3.3) |
| Edit of another group's event | One manager decision inside every command (NFR3.2) |
| Markup in a note or dish | Plain text, escaped on output (NFR1.4) |
| Leak through a notice | Facts function limited to event fields (NFR10.1) |
| Allergen tick read as health data | No link to children or families (NFR1.3) |
