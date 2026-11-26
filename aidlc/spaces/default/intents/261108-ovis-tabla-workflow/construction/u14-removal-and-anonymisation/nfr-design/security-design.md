# Security Design: u14-removal-and-anonymisation

Sources: this Unit's `security-requirements.md`, `reliability-requirements.md`, `performance-requirements.md`, `scalability-requirements.md`, `observability-requirements.md` and `tech-stack-decisions.md`, its `functional-spec.md`, contracts C1, C6 and C16 in `contract-summary.md`, both earlier reviews, and the owner's answer Q1 in `nfr-design-questions.md`. Contains no names or contact details. Where this file and the functional design's `rules.md` disagree, the table "Which text wins" in `logical-components.md` decides.

## Authorization Architecture

- **One gate per command.** `parent_remove`, `family_archive`, `removal_preview`, `removal_flagged_items`, `lifecycle_run` and `family_restore` each start with the use-case template: active session, idempotency key (commands only), super admin of the subject's community, then the subject lookup scoped to that community, so another community's subject answers as not found (NFR3.4).
- **Self-removal refused (owner answer Q1).** After the subject is resolved, the command refuses with `SELF_REMOVAL` when the subject is the caller's own parent record or the caller's own family. The preview returns the same refusal, so the confirmation page shows "Ezt egy másik főadminisztrátornak kell elvégeznie" instead of the button. This also means a super admin never ends their own session through removal.
- **Last super admin (NFR3.3).** The preview and the command count the community's other active super admin accounts outside the subject. If none remains, both answer `last_super_admin`. Tests cover a family holding every super admin and the caller's own family with another super admin outside it (NFR review finding 3).
- **Steps stay private.** The eleven `*_removal_preview` / `*_removal_apply` functions and the new `working_groups_sole_coordinator_groups` and `duties_removal_*` start with `revoke all` and get no grant; they run as the definer inside the commands (NFR3.5).

## Ending Sessions

1. After the family row and the task and place locks (see `reliability-design.md`), the command reads the account ids of the subject's active parents with an account, ascending, into the report (NFR3.1).
2. The directory step bumps each account's authorization version, so the database refuses the next request of any session of those accounts at once, even before the next step below (NFR3.6).
3. The result envelope carries the ids; the idempotency store keeps the full result, so a repeated click returns the same ids.
4. After the commit the server calls the existing session-ending step for each id. If a call fails, the server logs it with the code and the account id (no name), retries once, and shows the result page with a warning line "Egy kijelentkeztetés nem sikerült; a fiók a következő kérésnél úgyis le lesz tiltva." The database check of step 2 still refuses that session (NFR review finding 2).

## Data Protection Design

- **Name helpers (NFR1.1).** `parent_display_name` reads former when the parent is archived or the family is archived or anonymised; `family_display_name` returns `korábbi család` when the family is archived or anonymised. Super admin screens that must show the stored name read the column directly through their own reads, as today.
- **Single parent's name (NFR1.4).** The parent command, after the steps, sets that parent's stored name to `Anonimizált szülő`. A family removal leaves names for the 30 days.
- **Own texts emptied at removal (NFR1.3).** Each owning step empties the texts of the subject's own entries:

| Text | Owning step | Emptied when |
|---|---|---|
| Event sign-up note | events (U10) | the sign-up belongs to the subject |
| Food-offer text | events (U10) | the offer belongs to the subject |
| Checklist-claim note | checklists (U11) | the claim was the subject's |
| Recurring skip reason | recurring_duties (U9) | the subject gave the skip |
| Swap and cancellation request reason | dutychanges (U7) | the subject's family asked |

  The changed steps are new versions of those functions in this Unit's migration. Shared texts (to-do notes and descriptions, book descriptions, event notices) stay. An emptied required text is set to a fixed placeholder "—" where the column does not allow empty.
- **Result fields (NFR1.2).** Preview, report, flagged items and audit rows are built from ids, counts, codes, duty and task titles, book titles, dates and group names; each read lists its columns explicitly.

## Audit Design

- One `platform_audit_write` per removal or later run, in the same transaction, action `lifecycle.parent_removed`, `lifecycle.family_removed`, `lifecycle.delete` or `lifecycle.anonymize`, with details `{ steps: [{ block, to_clear, to_flag }], ended_accounts: n }` (NFR4.1). A failure aborts the transaction.
- Earlier rows are never updated (NFR4.2).
- Refusals are not audited, as in the other units.

## Input Validation

- Subject kind is one of `parent` and `family`; ids are uuids; versions are integers; the confirmation flag is a boolean. Anything else is a validation refusal naming the field, never a value.
