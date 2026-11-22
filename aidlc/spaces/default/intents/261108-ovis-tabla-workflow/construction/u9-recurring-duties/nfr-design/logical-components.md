# Logical Components: u9-recurring-duties

Sources: the five design files in this folder, `tech-stack-decisions.md` and `functional-spec.md` of this Unit, and `contract-summary.md`. This view tells Infrastructure Design where each pattern lives. No new service, package or scheduler exists.

## Inventory

| Component | Kind | Holds | Failure domain |
|---|---|---|---|
| Recurring schedule table | Database table, read-only to signed-in roles | Title, category, owner (kind and id), interval, season, rota job, active flag, version | The local database; a failed command rolls back |
| Recurring occurrence table | Database table, read-only to signed-in roles | Due date, state (open, done, skipped), done and skip person and time, removed flags, reason | As above; unique key on schedule and due date |
| Command functions (5) | Signed-in database functions | Save, switch on or off, mark done, undo, skip | One transaction each; blast radius is one schedule or occurrence |
| Read functions (3) | Signed-in database functions | One-document reads for group, family and the duty card | Read only; a failure shows the error state |
| `recurring_due_check` | Internal function, registered in U5's registry | Creates occurrences 14 days ahead, creates due and overdue notices | A failure is recorded in U5's run record and stops nothing else |
| `recurring_notice_facts` | Internal function | Title and due date for notices | Read only |
| Removal pair | Internal functions | Counts, clears removed parent's person, sets the removed flag | Runs inside U14's removal transaction |
| Registry rows | Data in U5's registries | Two notice kinds, one target type, one check | Added by this Unit's migration only |
| Screens | Next.js pages and components, `recurring-` classes | Group page, form, family page, bottle-cleaning line, interval on the school calendar page | A page failure shows the existing error state |

## Shared Resources

- U5's check registry, notice registries, `notice_send` and the email sweep: this Unit adds rows and calls them, and edits none of their functions.
- U7's rota tables are read through `rota_family_for` and the published weeks; this Unit writes nothing to them.
- Identity and group helpers (`can_manage_group`, reach helpers, C6 display names) are called, not changed.
- The audit table gains new action values only.

## Where Each Pattern Applies

| Pattern | Component |
|---|---|
| Reach check inside the function | Command and read functions |
| Live read of the water-week holder, then re-check after the lock | Mark done on a rota-week occurrence |
| Lock order family, rota week, ..., schedule, occurrence | Command functions, the daily check, the removal apply |
| Idempotency key and version check | Command functions |
| Unique key and once keys | Occurrence table, `notice_send` calls |
| Window of days 0 to 2 for due and day 3 onward for overdue | `recurring_due_check` |
| Removed flags beside the person columns | Occurrence table, removal apply |
| One-document reads | Read functions |

## Blast Radius

A defect in a command affects one schedule or occurrence and is fixed by a new migration. A failing daily check delays occurrences and notices but never changes other units' checks or data. Nothing here can change a duty, place or rota row.
