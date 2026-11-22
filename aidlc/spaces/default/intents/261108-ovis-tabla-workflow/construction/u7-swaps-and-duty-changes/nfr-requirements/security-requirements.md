# Security Requirements: u7-swaps-and-duty-changes

Sources: `functional-spec.md` and `rules.md` of this Unit, NFR1, NFR3, NFR4 and NFR10 in `requirements.md`, contracts C1, C5, C6, C8, C10, C11 and C16 in `contract-summary.md`, and `technology-stack.md`. Contains no names or contact details.

## Authentication

Sign-in, sessions and password rules do not change. A signed-out visitor receives no request, duty or swap data and is sent to sign-in. This Unit adds no service-role entry point; the daily check and the removal pair are internal and granted to nobody.

## Authorization Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR3.1 | Every new or rewritten read and write checks the caller on the database side, as its rule says (BR70 to BR77). | Database tests acting as real roles and accounts pass for each rule. |
| NFR3.2 | Proposing and withdrawing are refused for anyone but a parent of the source family, and accepting and declining for anyone but a parent of the target family, including a group admin or super admin acting outside their own family and a teacher (BR70.1). A refused caller gets the same denied refusal for a real request and a made-up one. | A test calls each command as every role and compares the refusals. |
| NFR3.3 | Reassigning a rota duty, reversing a swap and deciding the cancellation of a rota duty are refused for a working-group admin, a parent and a teacher (BR70.2, AC5.4.5). For a duty that is not a rota duty, the caller must reach its group. | A test calls each command as each role, on a rota duty and on a manual duty. |
| NFR3.4 | `swap_decide` no longer has an execute grant, and calling it as a signed-in account fails (BR75.4). The retired `DUTY_ROTA_MANAGED` guard is removed from the swap and cancellation paths only. | The catalogue test shows the grant removed; the U2 tests that still rely on the guard elsewhere pass. |
| NFR3.5 | `place_add`, `dutychanges_swap_expiry_check` and the removal pair cannot be executed by any signed-in role. | The catalogue test lists their grants, and a call as a signed-in account is refused. |
| NFR3.6 | Signed-in accounts keep read-only table rights. Every new or rewritten function starts with `revoke all` and an explicit `grant execute`, pins its search path, and grants no table write right. | The catalogue test lists each function's grants and the change_requests table's rights. |
| NFR3.7 | A right lost while signed in applies at the next request: a parent removed from a family, or a family marked leaving, is refused on the next command. | A test changes the right between two requests. |
| NFR3.9 | A repeated-click key is bound to the calling account, the command and a fingerprint of its inputs, as the existing `idempotency_records` table does (unique account, operation and key, with a request fingerprint). A stored result is returned only to the same account for the same command with the same inputs; another account using the same key starts a fresh command under its own rights, and the same account sending different inputs with a used key is refused. Every command of this Unit uses this mechanism and keeps no key store of its own. | Tests replay a key as a second account (no stored result is returned, the second account's own checks apply) and as the same account with changed inputs (refused). |
| NFR3.8 | `verification/authorization-matrix.json`, `role-policy.ts` and `authorization.ts` gain rows for the new and retired functions for every role, and each new screen is walked through for every role. | Evidence is in the Unit's test results before merge. |

## Data Protection

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR1.1 | The seed, fixtures and tests use invented families and people only; any address or phone number in a test is on the privacy allowlist. | Secret scanning and the privacy check stay green. |
| NFR1.2 | The swap reads return family display names through C6 and duty facts only: no contact detail, no child's name, no sharing choice of the other family (BR77.2). | A test asserts the exact fields each read returns. |
| NFR1.3 | A request's reason is returned only to the two families of the request and to administrators allowed by BR70.2 (BR70.3), is plain text up to 500 characters enforced in the database, and is shown escaped. | A test reads the reason as each role and saves markup that reads back unchanged and escaped. |
| NFR1.4 | The reason is the one free text a family writes for another family to read, so it may hold a name or a phone number the writer chose to share. The form says under the field, in Hungarian, that it is seen by the other family and the administrators and should hold no phone number, email address or child's name. The reason is kept only as long as the request: when a parent or family is removed, the reason of every request that family made or received is cleared together with the person fields (BR77.3), and a past request then shows no reason. | A test removes a family and reads its requests' reasons; the form text is checked in the screenshots. |
| NFR10.1 | Every notice and email of this Unit names the duties, their times and the other family's display name, and nothing else the app adds: no phone number, email address or child's name from any record. The one exception is the reason, which only the `swap_requested` notice carries, only to the other family, quoted as the proposer wrote it and marked as their words (NFR1.4). | A test reads each kind's text from the local test mailbox, and checks that only `swap_requested` carries the reason. |

## Audit

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.1 | A reassignment (`duty.reassigned`), a reversal (`swap.reversed`) and a cancellation decision (`approval.approve`, `approval.reject`) each write one audit entry with opaque ids and the actor and no names or reason text; the change rolls back when the entry cannot be written. | A test reads the entry for each command, and a forced audit failure (a temporary failing trigger, inside the test only) leaves the duties unchanged. |
| NFR4.2 | A swap the two families agree on writes no audit entry; its request row is its record (NFR4 names administrator interventions only). | A test applies a swap and counts audit rows. |
| NFR4.3 | Denied attempts are audited as they are today, under the existing rate limit. | The existing denied-audit tests pass. |

## Threat Considerations

| Threat | Control |
|---|---|
| A parent answers a swap meant for another family by calling the function directly | The caller's family is checked inside the function (NFR3.2) |
| A parent swaps into a duty that breaks the changeover or same-week rule | C10 and C11 are asked at proposal and again at acceptance (BR71.4) |
| An outdated acceptance applies a swap over a later change | Stored place versions are compared under the locks (BR72.1) |
| A working-group admin moves a rota duty | Super scope is required for rota duties (NFR3.3) |
| A reason reveals more than intended to other parents | The reason is returned to the two families and administrators only (NFR1.3), with a warning on the form and clearing on removal (NFR1.4) |
| Another parent replays a repeated-click key to read a stored result | Keys are bound to the account, command and inputs (NFR3.9) |
| A signed-in user runs the expiry check or adds a place directly | Internal functions have no grant (NFR3.5) |
| A function running with raised rights is steered to another schema | Every function pins its own schema (NFR3.6) |
