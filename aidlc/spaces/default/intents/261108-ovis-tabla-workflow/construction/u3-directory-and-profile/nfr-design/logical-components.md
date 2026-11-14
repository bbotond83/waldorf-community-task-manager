# Logical Components: u3-directory-and-profile

Where the designs in `security-design.md` and the other files of this folder apply. Requirements come from the NFR requirement files of this Unit, behaviour from `functional-spec.md` and boundaries from `contract-summary.md`.

## Components

Everything runs in one application and one database, with no service boundary.

| Component | Part in this Unit | If it fails |
|---|---|---|
| Identity | Account-status step sets sharing false; removal step (C16); email-change request and confirmation; resend-limit table | Email change or removal is refused or rolled back; sign-in is unaffected |
| Community (directory) | `directory_list`, profile table, sharing and own-details commands, removal preview and apply, family load (C17) | The page shows its error state; a command rolls back |
| Sign-in service | Password check, password change, ending other sessions | Password and email change are refused with their reason; sign-in is unaffected |
| Mail | Invitation, email-change link and change notice | The record is kept and a resend is offered |
| Housekeeping | Deletes finished email-change requests after 30 days and old send-attempt rows | Rows stay a little longer; no rule is affected |
| Lifecycle | Anonymisation clears the new profile | The erasure test fails before merge |
| Audit | Eight new action names | The change rolls back |
| WebApplication | Directory, "Fiókom", email-confirmation page, changed records screen, message mapping | The page shows its error state |
| Seed and reset | Invented families with the new fields | The local stack is not rebuilt; no effect on rules |

## Blast Radius

Removal touches the parent, profile, account link, invitations, email request and audit in one transaction, so a defect rolls back instead of half-applying. The account-status step is shared with U1: a defect there affects sign-in status for every account, so it gets the full fixed test list. The narrowed contacts read rule affects every screen that reads contacts today (records, teacher port), which the changed tests cover. Other Units (U4, U14, U15) read people only through `directory_list` or their own contracts; `contract-summary.md` names none as reading contacts directly, and this is checked again when each is built.

## Shared Resources

One Postgres database, the audit log and the mail catcher. `directory_list`, the removal steps (C16) and the family load (C17) are fixed in this Unit: the removal steps (C16) are called by U14 and the family load (C17) by U15; `directory_list` has no contract yet, so any later consumer (such as U4) needs one.
