# Logical Components: u10-events-and-signups

Where the designs in this folder apply. Requirements come from the six files in `nfr-requirements/` of this Unit, behaviour from `functional-spec.md` and boundaries from `contract-summary.md`.

## Components

Everything runs in one application and one database, with no service boundary.

| Component | Part in this Unit | If it fails |
|---|---|---|
| Identity helpers | Session, parent, manager and super-admin decisions used by every command | Commands are denied |
| Events | Event save and cancel, notices, tale, roles, sign-ups, offers, reads, the three internal facts functions and the removal pair | The page shows its error state; a command rolls back as a whole |
| Duties (today's tasks) | Open tasks closed on cancel; event tasks kept as they are | The cancel rolls back; task pages show their error state |
| Notifications | Three registered notice kinds and the `event` facts function | A refusal rolls the caller back; a failed email is retried and listed for the administrator |
| Audit | New action names | The change rolls back |
| WebApplication | Events list, event page, event form, group page section; message mapping | The page shows its error state |
| Teacher schedule | Shows the role name, no longer a coordinator name | The schedule shows its error state |
| Seed and reset | Invented events with notices, roles, sign-ups and offers | The local stack is not rebuilt; no effect on rules |

## Blast Radius

The migration drops four columns of `events` and replaces `event_save_notes`; the teacher schedule, the seed and the old note screen change in the same pull request, and the existing event-task tests must stay green. Each command runs in one transaction, so a defect rolls back instead of half-applying.

## Shared Resources

One Postgres database, the audit log, and U5's notice registries and email queue. The functions delivered for U11 and U14 have their names and meanings fixed in this Unit, with the contract deltas listed in `functional-spec.md`.
