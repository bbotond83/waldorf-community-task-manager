# Functional Design Questions: U1 Local platform and audit

U1 is the foundation: the local stack, the migration baseline, the audit log, stored idempotency keys, the runtime configuration and the privacy scan. These questions settle the open points from the design review that belong to U1 (audit atomicity, per-worker schemas) and a few choices about what is stored and checked.

## Q1. What does one audit event record?

A. Who did it (account and role), what happened (a fixed action name), what it was done to (type and id), the scope (group or organization), when, and the outcome; plus a short details field that never holds personal data (no names, emails, phone numbers or addresses).
B. Same as A, but also a before-and-after copy of the changed values, which makes events more useful for investigation but puts personal data into the audit log.
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. Who did it (account and role), what happened (a fixed action name), what it was done to (type and id), the scope (group or organization), when, and the outcome; plus a short details field that never holds personal data (no names, emails, phone numbers or addresses).

## Q2. How is the audit event kept atomic with the change it describes (so a change is never saved without its event, or the other way round)?

A. Every audited change (role changes, approvals, imports, lifecycle actions) goes through a named database function that writes the change and its event in one transaction; ordinary edits that FR3.5 does not list are not audited.
B. Database triggers on every audited table write the event automatically, so even a direct write is covered; slightly more hidden behaviour.
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. Every audited change (role changes, approvals, imports, lifecycle actions) goes through a named database function that writes the change and its event in one transaction; ordinary edits that FR3.5 does not list are not audited.

## Q3. How do the database functions work in every per-worker schema, given that each function must pin its search path (a fixed lookup path, which stops one schema's function from reaching another's tables)?

A. The migration runner fills in the schema name when it applies the same migration files to each schema, so every function pins exactly its own schema; the files themselves never hard-code a schema name.
B. Every worker gets its own database instead of a schema; simpler functions, but the sign-in service's user table would have to be shared another way.
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. The migration runner fills in the schema name when it applies the same migration files to each schema, so every function pins exactly its own schema; the files themselves never hard-code a schema name.

## Q4. How long are stored idempotency keys (the records that stop a repeated submission from creating a duplicate) kept?

A. 24 hours, then they are removed by a cleanup that the seed and reset commands also run.
B. 7 days.
C. Until the next reset (local only), with no cleanup.
D. Not yet defined.
X. Other (please specify)

[Answer]: A. 24 hours, then they are removed by a cleanup that the seed and reset commands also run.

## Q5. What should the privacy scan treat as real personal data?

A. Any tracked workbook or spreadsheet file (`.xlsx`, `.xls`, `.csv`) outside one allowed folder for fictitious fixtures, plus email addresses and phone numbers found in tracked files outside that folder and outside a short list of allowed example values.
B. Only tracked workbook and spreadsheet files outside the fictitious fixtures folder (no text patterns).
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. Any tracked workbook or spreadsheet file (`.xlsx`, `.xls`, `.csv`) outside one allowed folder for fictitious fixtures, plus email addresses and phone numbers found in tracked files outside that folder and outside a short list of allowed example values.

## Q6. Should the web application's runtime configuration hold the service-role key (the all-powerful database key)?

A. No. In U1 the app only needs the database address and the public key; the service-role key is used only by the local tooling (seed, reset, operator command), and U2 decides whether sending invitations needs it on the server.
B. Yes, as a server-only setting from the start, never exposed to the browser.
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. No. In U1 the app only needs the database address and the public key; the service-role key is used only by the local tooling (seed, reset, operator command), and U2 decides whether sending invitations needs it on the server.

## Consolidated Summary Confirmation

- Audit event: who (account and role), what (fixed action name), target (type and id), scope, when and outcome, plus a details field that never holds personal data.
- Atomicity: every audited change goes through a named database function that writes the change and its event in one transaction; unlisted edits are not audited.
- Worker schemas: the migration runner substitutes the schema name per schema, so each function pins exactly its own schema.
- Idempotency keys: kept 24 hours, cleaned up by a job that seed and reset also run.
- Privacy scan: tracked spreadsheets outside one fictitious-fixtures folder, plus emails and phone numbers outside it and an allowed-example list.
- Service-role key: not in the app's runtime configuration; only the local tooling uses it, and U2 decides about invitations.

Does this all look correct before I generate the artifacts?

Looks correct
Request changes

[Answer]: Looks correct
