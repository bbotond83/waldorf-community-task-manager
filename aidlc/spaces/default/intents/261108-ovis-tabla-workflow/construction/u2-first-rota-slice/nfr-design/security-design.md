# Security Design: u2-first-rota-slice

How the targets in `security-requirements.md` are met, following `functional-spec.md`, `rules.md`, `tech-stack-decisions.md` and contracts C1, C4, C5 and C18 in `contract-summary.md`. Contains no names or contact details.

## Authorization Architecture

**Commands.** Every calendar and rota command (save school year, add or remove a break week, make a draft, change a week, discard, publish) calls U1's one super-admin decision point first, after the session check and before any lookup (NFR3.1, NFR3.2). A parent, teacher or group administrator gets the same denied result whatever they send.

**Reads.** The overview and duty card are read functions that return rows or a denied refusal, never an empty list for a caller with no access (BR27.1). A draft is filtered out for everyone but super admins inside the function, so a parent's overview shows the nothing-published state whether or not a draft exists (NFR3.3). Planning functions look a plan up only inside the caller's community and give the same denied result for a missing and an existing plan.

**Reach.** A rota duty has no working group, so U1's reach rules treat it as community-wide: every active parent reads it, a teacher reads it on the schedule, and only a super admin manages it (NFR3.4).

**Protected duties.** Each of today's change functions begins with one shared check that refuses a duty whose origin is not `manual` with DUTY_ROTA_MANAGED, before it changes anything (NFR3.5). U7 later replaces the check with its own rules.

**Rights.** Signed-in accounts keep select only. Every new function starts with `revoke all`, pins its search path, and then gets an explicit `grant execute`; internal helpers are granted to nobody. The catalogue test records each grant (NFR3.6).

## Data Protection Design

| Requirement | Design |
|---|---|
| NFR1.1 | The seed adds invented families and an invented school year only; secret scanning is unchanged. |
| NFR1.2 | The overview function returns a family id and display name and nothing else; a test asserts the exact field list. |
| NFR1.3 | The notice row stores no text (today's notices hold no name, contact or note). `notification_list` builds the Hungarian text when it is read, from the weeks of the reader's own family in the plan; it never reads another family's rows. A privacy test reads the list as a parent of each family and finds only that family's weeks. |

**Read side of the new notice kind.** `notification_list` builds the title and text for kind `rota_published` and skips the task lookup for it. `notification_link` gives the link to the parent's rota overview instead of a task page. `notification_mark_read` works on the row as for every kind and must not require a task. Each of the three has a test for the new kind and for an unchanged task-based kind.
| NFR1.4 | The audit rows carry the plan id, the actor and counts only. |

## Audit Design

Publish and discard write through the existing audit function in the same transaction as the change (NFR4.1). A repeated call returns the stored result before the audit write, so no second event appears (NFR4.2). Denied attempts keep the existing audit path and rate limit (NFR4.3).

## Evidence Design

NFR3.7 is proven by the authorization-matrix test with rows for the calendar, rota, overview and duty card, and by a browser specification that opens each new screen as each role. NFR3.2 and NFR3.5 are proven by database tests that call each command and each refused function directly as real accounts.

## Input Validation

Dates are parsed by the database as dates; the break week must be a Monday of a school week (BR20.1). Labels have a length limit on the table as well as in the function. Plan, week and family ids go through the existing safe parser and are checked against the caller's community. React escapes all displayed text.
