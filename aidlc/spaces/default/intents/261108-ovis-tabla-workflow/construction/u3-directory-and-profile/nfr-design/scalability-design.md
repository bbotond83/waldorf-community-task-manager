# Scalability Design: u3-directory-and-profile

How the targets in `scalability-requirements.md` are met, following `functional-spec.md`, `rules.md` and C1 in `contract-summary.md`.

## Scaling Architecture

One community of about 20 families on one local database. No partitioning, queue or cache is needed; every list stays far below the data API's limit of 1000 rows.

## Concurrency Design

| Requirement | Design |
|---|---|
| NFR5.1 | Every command takes the C1 idempotency key and returns the stored result for a repeat. The password change and email confirmation are outside the template: a repeated password submit fails because the old password is no longer current, and a repeated confirmation finds the request no longer pending. |
| NFR5.2 | Commands on an existing record compare the expected version and return VERSION_CONFLICT when it is outdated. |
| NFR5.3 | A partial unique index allows one pending request per account, so two requests at once leave one. The request step takes the lock order of NFR5.6 (family, account, parent, then the pending request row if any), marks the old request replaced and inserts the new one, so the unique index is never hit. Confirmation takes the same order, rechecks the request is still pending, and changes the email once. |
| NFR5.4 | A unique index on the active parent's email on record, checked inside the add command under the advisory lock below, gives one success and one EMAIL_UNAVAILABLE. |
| NFR5.5 | Removal and own-details saves take the locks in the order of NFR5.6; the loser sees a new version or the denied refusal and stores nothing on a removed parent. |
| NFR5.6 | One order for every function, matching C1 and C16 (family first): the family row, then account rows ascending, then parent rows ascending, then request and invitation rows ascending. A function that starts from an account or a parent (the account-status step, email request, email confirmation, removal) first reads its family without a lock, then takes the locks in this order and rechecks the link and state; U14's removal, which already holds the family row, therefore reaches U3's apply step and U1's removal step in the same order. For a family with several parents, every linked account row is locked ascending after the family row. This Unit's migration redefines `identity_set_account_status` to this order (U1's version locked the account row first); the contracts need no change because they already say family first. Functions touching no account skip the account step. A function touching two families locks both ascending. Invitation accept and account link take the same order (family, account, parent). One advisory lock key, built from the hashed address, serialises every step that sets or checks an address: add-parent, add-family, email edit on record, email request, email confirmation, invitation send, `migration_load_family` and the resend limit. It is taken before the family lock and after nothing else; a function needing two addresses takes the keys in ascending order; since a step holds no row lock when it takes it, no cycle can form. The account-status step takes no address lock because it sets no address. Every taken-address check returns EMAIL_UNAVAILABLE, never a raw database error. The two-at-once tests include deactivation against removal, deactivation against confirmation, and removal through U14's family-first path. |

## Capacity Thresholds

None: the load is a few dozen rows and a few emails a month. The repeated race tests are the evidence that no deadlock appears.
