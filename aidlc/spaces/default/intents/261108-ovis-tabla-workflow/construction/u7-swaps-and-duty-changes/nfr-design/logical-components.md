# Logical Components: u7-swaps-and-duty-changes

Sources: the five design files of this Unit, `functional-spec.md`, `tech-stack-decisions.md`, and C1, C5, C8, C9, C11 and C16 in `contract-summary.md`. The Unit stays inside the existing app and local database; nothing new is deployed.

## Inventory

| Component | Kind | Where NFR patterns apply |
|---|---|---|
| `change_requests` table | Existing table, widened; its direct read for signed-in accounts is removed | Guards (NFR7.4), reason visibility (NFR1.3) |
| DutyChanges commands: `swap_request`, `swap_respond`, `swap_withdraw`, `cancellation_request`, `cancellation_decide`, `duty_reassign`, `swap_reverse` | Named Postgres functions, C1 template | Caller check (NFR3), keys (NFR3.9, NFR5.1), lock order (NFR5.6), atomic steps (NFR7.1 to NFR7.3), audit (NFR4.1) |
| DutyChanges reads: `swap_candidates`, `swap_incoming`, `swap_list`, `cancellation_list` | Named Postgres functions returning one document | One call per page (NFR9.4), display names only (NFR1.2), reason visibility (NFR1.3) |
| C5 place functions, with the new internal `place_add` | Duties (U2) functions called only from this block | Closed-duty and already-assigned checks |
| C11 rota functions, with the no-family change | RotaPlanning (U6) functions called in the same transaction | Same-week rule, picks follow the duty |
| Notice facts `notice_facts_change_request` and five new kinds | U5 registry rows and this Unit's facts function | Duty facts and display names only; reason only in `swap_requested` (NFR10.1) |
| Timed check `swap_expiry` | Registry row for U5's daily run | Recorded outcome (NFR4.7), once keys (NFR5.7) |
| Removal pair | `dutychanges_removal_preview` and `_apply` for C16 | Counts only, reason cleared (NFR11.1, NFR1.4) |
| Screens | Next.js pages: `/szulo/cserek`, the proposal form, the admin swap list, the reassign action in `/admin/beosztas`, `/admin/jovahagyasok` | Hungarian copy (NFR8.1), Stitch, keyboard and phone width (NFR8.2) |
| Application layer entries | `parent-port.ts`, `parent-facade.ts`, `admin-tasks.ts`, `authorization.ts`, `role-policy.ts`, navigation, `authorization-matrix.json` | NFR3.8 |

## Failure Domains and Blast Radius

- **One database transaction per command:** a command either completes or leaves nothing.
- **Email outside the transaction:** a failed email affects one notice and is listed on the delivery-problems screen.
- **Daily run:** a failing `swap_expiry` is recorded and the other checks still run.
- **Shared resources:** place and duty rows (shared with U2, U6 and later U8), U6's rota week and pick rows, U5's registries and the audit table. This Unit changes U2's `coordination_withdraw_requests` and U6's `rota_adjust_picks_after_change` in one migration, with both units' tests kept green.
