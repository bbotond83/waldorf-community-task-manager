# Rules: U1 Local platform and audit

Source: requirements FR1.1 to FR1.4, FR3.1, FR3.2, FR3.5, FR3.6, FR4.2, FR10.2, FR10.3, FR11.1, NFR1, NFR6, and the confirmed answers in `functional-design-questions.md`.

```yaml
rules:
  - id: BR1.1
    statement: "One documented command starts the local stack and one command stops it"
    category: constraint
    applies_to: DevelopmentTooling
    trigger: "the developer runs the start or stop command"
    logic: "IF the start command runs THEN Postgres, sign-in service and mail catcher are running and healthy before it reports success; IF the stop command runs THEN all of them stop and no data is deleted"
    violation: "the command reports which part did not start and exits with a failure"
    source: FR1.1
  - id: BR1.2
    statement: "Every migration applies cleanly to a fresh database with no manual step"
    category: constraint
    applies_to: DevelopmentTooling
    trigger: "the migration command runs on an empty database or schema"
    logic: "IF all migration files are applied in order THEN no error occurs; the first existing migration uses a non-reserved alias and the unit test that pins its checksum holds the new value"
    violation: "the command stops at the failing file and names it"
    source: FR1.2
  - id: BR1.3
    statement: "The runtime configuration is validated at startup and names the failing setting"
    category: validation
    applies_to: ApplicationKernel
    trigger: "the application starts"
    logic: "IF the database address is missing, OR its scheme is http and its host is not a loopback host (127.0.0.1, localhost or ::1), OR its scheme is neither http nor https, OR the public key is missing, OR the session secret is shorter than 32 characters or equals the example value, OR the database schema setting (default public) is not a valid lowercase identifier THEN startup stops. Examples: http://127.0.0.1:54321 passes; https://project.example.co passes; http://project.example.co fails; ftp://x fails"
    violation: "startup stops with a message naming the failing setting; no synthetic fallback exists"
    source: FR1.3
  - id: BR1.4
    statement: "No secrets are committed and the service-role key never reaches the browser or the app runtime"
    category: policy
    applies_to: "ApplicationKernel, DevelopmentTooling"
    trigger: "configuration is read or a file is committed"
    logic: "IF a key is a service-role key THEN only the tooling reads it, from the local stack at start; the example environment file lists names only (values empty or marked as examples); each environment has its own session secret; the secret scan checks tracked files for JWT-shaped strings, private-key headers and service-role key names with values"
    violation: "the secret scan fails the build naming the file"
    source: FR1.4
  - id: BR1.5
    statement: "The same migration files apply to the default schema and to every worker schema, each function pinning exactly its own schema"
    category: constraint
    applies_to: DevelopmentTooling
    trigger: "the migration runner applies files to a schema"
    logic: "IF a file contains the schema placeholder THEN the runner substitutes the target schema name; no file hard-codes a schema name; every elevated function pins its search path to its own schema plus the system catalogue"
    violation: "a file with a hard-coded schema name fails the runner's check"
    source: FR1.2
  - id: BR3.1
    statement: "Every table has a database-generated uuid primary key and carries its scope as columns"
    category: constraint
    applies_to: "all tables"
    trigger: "a table is created"
    logic: "IF a table is created THEN its primary key is uuid with a database default and, where it holds group- or organization-owned data, it has organization and group scope columns and an integer version"
    violation: "a migration test fails for the table that breaks the convention"
    source: "FR3.1, FR3.2"
  - id: BR3.2
    statement: "Role changes, approvals, imports and lifecycle actions each write one audit event from a fixed action list"
    category: policy
    applies_to: PrivacyAudit
    trigger: "an audited change is made"
    logic: "IF the change is one of the fixed actions role.grant, role.revoke, role.first_super_admin, approval.approve, approval.reject, import.commit, lifecycle.anonymize, lifecycle.delete, lifecycle.hold_place or lifecycle.hold_release THEN one AuditEvent with actor account and role, action name, target type and id, scope, outcome (success or denied) and time is written; this list is the constraint on the action column; edits not on this list are not audited (this narrows the domain design's wider audit wording and supersedes it)"
    violation: "an action name outside the list is rejected by the column constraint; no audited change is saved without its event"
    source: FR3.5
  - id: BR3.3
    statement: "An audited change and its event are written in the same transaction through a named database function"
    category: constraint
    applies_to: "PrivacyAudit, ApplicationKernel"
    trigger: "an audited change is submitted"
    logic: "IF an audited change is submitted THEN one named function applies the change and calls the audit write function in the same transaction; IF the actor is not allowed THEN the function returns a denied result normally (it does not raise), and only the denied AuditEvent is committed; IF any step raises an error THEN the whole transaction rolls back, change and event together, and the kernel returns a retryable or terminal result"
    violation: "a thrown error saves nothing; a denial saves only its denied event"
    source: FR3.5
  - id: BR3.9
    statement: "The audit write function is callable only from the named change functions, and the actor comes from the session"
    category: authorization
    applies_to: PrivacyAudit
    trigger: "an audit event is written or the audit write function is called"
    logic: "IF a caller is anon, authenticated or any application role THEN execute on the audit write function and insert into the audit table are refused; the actor account and role are derived from the signed-in session (or from a verified system actor for the operator command and seed), never from parameters"
    violation: "the call is refused; a wrong-role test proves that an ordinary signed-in user cannot write or forge an event"
    source: "FR3.5, NFR1"
  - id: BR3.4
    statement: "Audit event details and hold reasons are code-shaped text, and audit events cannot be changed or deleted"
    category: constraint
    applies_to: PrivacyAudit
    trigger: "an audit event or a hold reason is written, or an audit event is updated or deleted"
    logic: "IF details (at most 500 characters) or a hold reason (at most 300) is written THEN it must match the code pattern of lowercase letters, digits, underscore, dot, colon and hyphen only (so free text such as names or addresses is rejected); IF an update or delete of an AuditEvent is attempted by any application role THEN it is refused (a hold may be updated only by its release)"
    violation: "a non-matching text is refused with a validation result; the update or delete is denied; tests cover a matching code, a free-text name and an over-length value"
    source: "FR3.5, NFR1"
  - id: BR3.5
    statement: "At most one open lifecycle hold exists per target"
    category: constraint
    applies_to: LifecycleHold
    trigger: "a hold is placed"
    logic: "IF an open hold already exists for the same target type and id THEN the new hold is refused"
    violation: "conflict result"
    source: FR3.5
  - id: BR3.6
    statement: "A repeated submission with the same idempotency key returns the stored result and creates nothing new"
    category: constraint
    applies_to: ApplicationKernel
    trigger: "an operation with an idempotency key is submitted"
    logic: "IF a record exists for the account, operation and key, has not expired and its fingerprint matches THEN return its stored result state and reference without acting; IF the fingerprint differs THEN return a conflict result; IF none exists (or it has expired) THEN act and store the record. Only the states success, validation, denied, conflict and terminal are stored and replayed; a retryable result is never stored, so a retry always acts again. The lookup and the write run inside the same database function as the operation, and the table is readable and writable only by that function for the owning account"
    violation: "a different request under a used key returns a conflict result"
    source: FR3.6
  - id: BR3.7
    statement: "Idempotency records expire after 24 hours and are cleaned up"
    category: policy
    applies_to: ApplicationKernel
    trigger: "a record passes its expiry time, or seed or reset runs"
    logic: "IF expires_at is in the past THEN the next operation with the same key replaces the expired row in the same statement (insert on conflict replace), so an expired key behaves as new even where no cleanup has run; a cleanup function removes expired rows as housekeeping, run by seed and reset and callable by the operator on a hosted database"
    violation: "none: an expired key behaves as new"
    source: FR3.6
  - id: BR3.8
    statement: "A stale update is refused with the existing conflict result"
    category: constraint
    applies_to: "all mutable records"
    trigger: "an update is submitted with a version"
    logic: "IF the submitted version differs from the stored version THEN the update is refused; IF it matches THEN the update is applied and the version increases by one"
    violation: "conflict result with no change saved"
    source: FR3.6
  - id: BR4.1
    statement: "Every operation returns one of the existing explicit result states"
    category: constraint
    applies_to: ApplicationKernel
    trigger: "any operation completes"
    logic: "IF an operation completes THEN it returns success, validation, denied, conflict, retryable or terminal; unexpected infrastructure errors are mapped to retryable or terminal at the application boundary and never reach the screen as raw errors"
    violation: "a boundary test fails for an unmapped error"
    source: FR4.2
  - id: BR10.1
    statement: "Each test worker has its own schema, created and reset on demand"
    category: constraint
    applies_to: DevelopmentTooling
    trigger: "a worker starts or a test file starts"
    logic: "IF a worker starts THEN a schema named for the worker is created with all migrations applied; IF a test file starts THEN that schema's data is reset; account names for the worker use the worker's own namespace; the reset removes the worker's accounts (found by the worker's name prefix in the shared sign-in user table) so accounts never accumulate or collide, and tests create the accounts they need"
    violation: "setup fails and the test run stops with the worker and schema named"
    source: FR10.2
  - id: BR10.3
    statement: "A worker schema is exposed to the data API and selected by its own test server"
    category: constraint
    applies_to: DevelopmentTooling
    trigger: "a worker schema is created"
    logic: "IF a worker schema is created THEN the tooling adds it to the data API's exposed-schema list and triggers a configuration reload before the first request; each test server process reads its schema from the validated database schema setting (default public) and uses it for every request it serves; one process serves one schema"
    violation: "setup fails naming the schema and the step (expose, reload or select)"
    source: FR10.2
  - id: BR10.4
    statement: "The audit, idempotency and policy tests also run once against the unmodified default schema"
    category: constraint
    applies_to: "DevelopmentTooling, CI workflow"
    trigger: "the database-backed tests run in CI or before a unit checkpoint"
    logic: "IF the database-backed tests run THEN the audit, idempotency and (from U2) policy tests run once in the default schema as well as in worker schemas, so the schema that ships is the schema that is tested"
    violation: "the check fails and blocks the merge"
    source: "FR10.2, FR10.3"
  - id: BR10.2
    statement: "The CI workflow starts the database service and runs the database-backed tests; deployment workflows stay disabled"
    category: constraint
    applies_to: "CI workflow"
    trigger: "a change is pushed or a pull request is opened"
    logic: "IF CI runs THEN the database service is started, migrations are applied and the database-backed tests run; no deployment workflow is enabled"
    violation: "the check fails and blocks the merge"
    source: "FR10.3"
  - id: BR11.1
    statement: "The privacy scan fails when real personal data is tracked"
    category: validation
    applies_to: DevelopmentTooling
    trigger: "the privacy scan runs locally or in CI"
    logic: "IF a tracked file is .xlsx, .xls, .ods, .csv or .sql outside the fictitious-fixtures folder (tests/fixtures/fictitious), OR a tracked text file outside that folder, outside lock files and generated folders, and outside the allowed-example list (scripts/verification/privacy-allowlist.json, holding example addresses such as example.com ones and example phone numbers) contains an email address (local@domain.tld pattern) or a phone number (Hungarian forms starting +36 or 06, with optional spaces or hyphens, and international +country forms) THEN the scan fails naming the file. Tests cover a planted workbook, a planted email, a planted phone number (positive) and an allowed example and a fixture file (negative)"
    violation: "the scan fails and blocks the merge"
    source: FR11.1
  - id: BR11.2
    statement: "The real-data workbook is untracked and ignored"
    category: policy
    applies_to: "repository"
    trigger: "the repository is checked"
    logic: "IF the workbook path is tracked THEN the privacy scan fails; the path is listed in the ignore file; the history rewrite is a manual owner step reported as an open item"
    violation: "the scan fails; the open item stays on the final report"
    source: "FR11.1"
```

## Summary

| Group | Rules |
|---|---|
| Local stack and migrations | BR1.1, BR1.2, BR1.5 |
| Runtime configuration and secrets | BR1.3, BR1.4 |
| Schema conventions | BR3.1 |
| Audit | BR3.2, BR3.3, BR3.4, BR3.5, BR3.9 |
| Idempotency and versions | BR3.6, BR3.7, BR3.8 |
| Result states | BR4.1 |
| Test isolation and CI | BR10.1, BR10.2, BR10.3, BR10.4 |
| Privacy | BR11.1, BR11.2 |
