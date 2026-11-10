# Security Design: u1-community-foundation

How the targets in `security-requirements.md` are met, following `functional-spec.md`, `tech-stack-decisions.md` and contracts C1, C2 and C6 in `contract-summary.md`. Contains no names or contact details.

## Authorization Architecture

**One decision point.** "May this caller manage this group?" is answered in one place, and every existing check calls it. `has_core_scope` gives the same answer as `can_manage_group`, so policies and commands cannot disagree (NFR3.1, NFR3.2).

```text
can_manage_group(group):
  session active
  AND ( super admin
        OR ( group is not empty
             AND unrevoked group_admin grant on that group
             AND linked parent active AND parent's family active ) )
```

An empty group therefore means super admin only, with no separate branch to forget.

**Stale links.** The active-parent and active-family test lives inside the role check itself, so a grant left behind by an archived parent reaches nothing (NFR3.5). Nothing is cached across requests, so revocation applies at the next request through the existing authorization version (NFR3.4).

**Refusals.** Commands look the item up only inside the caller's community, then answer with the same denied result whether the item is out of reach or missing (NFR3.3).

**Rights.** Signed-in accounts keep select only. Every new function starts with `revoke all`, then an explicit `grant execute`. Internal helpers such as `grant_admin` and `end_admin` are granted to nobody. The catalogue test records each grant (NFR3.6).

## Data Protection Design

| Requirement | Design |
|---|---|
| NFR1.1 | The six group texts are repository data. All people come from the invented seed; secret scanning is unchanged. |
| NFR1.2 | `directory_reaches_family` becomes super admin only, which closes every family, parent, child and contact read through one change. |
| NFR1.3 | A new read function returns id and display name of active families to administrators. Group administrators get no table right on `families` beyond their own family. |
| NFR1.4 | The teacher reads only through `schedule_get`, which keeps today's field list. Teachers gain no table right. |

## Audit Design

`grant_change`, `grant_admin` and `end_admin` write through the existing audit function, in the same transaction as the change (NFR4.1). Denied attempts keep the existing audit path and rate limit (NFR4.2).

## Evidence Design

NFR3.7 is proven by two named artefacts: the authorization-matrix test, extended to every row and the new roles, and a new browser specification, `tests/browser/community-roles.spec.ts`, that opens each screen of `functional-spec.md` as each role. NFR3.2 is proven by database tests that call each command and read each table directly as a real group administrator of another group.

## Input Validation

Group ids are parsed by the existing safe parser and checked against the caller's community inside each function. Text limits sit on the table as well as in the function. React escapes the description text on the card.

## Accepted Risk

The clean-start deletion runs inside a normal migration, with no guard of its own. It is accepted because real data can only be loaded by the later hosting work, after this migration has run on an empty database. `db:reset` refuses anything but the local stack.
