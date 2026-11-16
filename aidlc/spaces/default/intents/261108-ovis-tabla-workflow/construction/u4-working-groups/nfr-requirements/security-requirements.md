# Security Requirements: u4-working-groups

Sources: `functional-spec.md` and `rules.md` of this Unit, NFR1 to NFR4 and NFR10 in `requirements.md`, the contracts C1, C2, C7, C8 and C16 in `contract-summary.md`, ADR-008 and ADR-010, `technology-stack.md`, and the owner's answers in `functional-design-questions.md` (Q1 to Q5). Contains no names or contact details.

## Authentication

Sign-in and sessions do not change. A signed-out visitor gets no group page and is sent to sign-in. Every U4 function checks for an active session first (C1).

## Authorization Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR3.10 | Only a parent joins or leaves, always for their own parent record. The commands take no parent id. A teacher, or a super admin without a parent record, is refused, and so is a leave naming someone else's membership (BR40.1, BR40.4, Q2). | Fixed-list "out of reach" tests as a teacher, as a super admin and as another parent. |
| NFR3.11 | Only a super admin appoints or revokes. This holds also when the function is called directly, and also for a coordinator of the same group (BR41.1). | "Out of reach" tests as a parent, a teacher and a coordinator. |
| NFR3.12 | The general role-change function refuses the group_admin role for adding and revoking with GRANT_USE_COORDINATOR_ACTION, after its authorization check. Invitations still cannot carry group_admin (BR41.7). | Tests for adding and revoking group_admin as a super admin, and as a non-admin who is denied first. |
| NFR3.13 | A revoked coordinator, or one who left, is refused as a group administrator from their next request. Every rights check reads the current grants (BR41.5, NFR3). | A test revokes the right and then calls a group-admin read with the same session. |
| NFR3.14 | A group in another community, an archived group or a missing group answers GROUP_UNAVAILABLE on every read and command. The answer is the same for all three, so it does not reveal which groups exist (BR40.1, BR42.1). | One test per case, comparing the answers. |
| NFR3.15 | Signed-in accounts keep read-only table rights. Every new or redefined function starts with `revoke all` and an explicit `grant execute`, pins its search path, and grants no right to write tables. The C7 facts functions, the C16 steps, the contact helpers and `end_admin` are granted to no signed-in role. | The catalogue test lists each function's grants. |
| NFR3.16 | The three new group routes get rows in `verification/authorization-matrix.json` for every role. `role-policy.ts`, `authorization.ts` and the navigation change together, and each new screen is walked through for every role (BR42.5). | The matrix has a row for each new route and each role, the matrix check in `scripts/verification/core.ts` passes, and `tests/unit/current-role-references.test.ts` finds the new routes. |

## Data Protection

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR1.8 | The seed, fixtures and tests use invented families and people only. Every phone number or email used in a test is in `scripts/verification/privacy-allowlist.json`. | Secret scanning and the privacy check stay green. |
| NFR1.9 | A member row shows phone and email only where the directory would show them to the same viewer, through the same helpers `directory_list` uses (BR42.2). A field that is withheld is absent from the result, also when the screen is bypassed (ADR-008). | One database test per row of the "Who sees what" matrix, plus a test that the directory and the group page agree for the same viewer and member. |
| NFR1.10 | A member row never carries residence, occupation, hobby, how the parent supports, the sharing choice or children (GroupMemberView). The super admin is the only viewer who gets the row's version. | A test reads every field of the result as each role. |
| NFR1.11 | The C7 facts functions return parent ids only, never names or contact details (BR43.1). | A test reads their result. |

## Consent

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR2.3 | A change of a member's sharing choice shows on the group page at the next load of any viewer. Nothing caches a member row. | A test changes the choice and reads the group page as another parent straight away. |

## Audit

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.15 | Every coordinator appointment and every ending of the right (by revocation, leaving, removal or the lifecycle step) writes its audit event in the same transaction (BR40.5, BR41.3, BR41.5, BR44.2). The reason is named as in `observability-requirements.md`. | A test reads the event after each of the five paths. |
| NFR4.16 | A U4 audit event carries opaque ids only, never a name, email or phone. | A test reads every field of each event. |
| NFR4.17 | A repeated click writes no second audit event. A refused appointment writes no `role.grant`, and a denied attempt is audited as today's denials are (BR41.1). | The "repeated click" and "refused" tests count the events. |

## Email

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR10.5 | The coordinator notice and its email carry only the notice title, the group's name and the link to its page. They name no other person and no contact detail (BR41.6). | A test reads both notices and both emails in the mail catcher. |
| NFR10.6 | A parent without an active account receives no coordinator notice or email, as U5 decides. In practice this cannot happen for an appointment, because ACCOUNT_REQUIRED refuses it first. | A test revokes the right of a parent whose account was deactivated and finds no email queued. |

## Threat Considerations

| Threat | Control |
|---|---|
| A parent calls a function directly to become a coordinator, or to add someone else to a group | Super admin only, and the commands act for the caller only (NFR3.10, NFR3.11) |
| A super admin or a script uses the old role-change path to make a non-member a coordinator | That path is closed for group_admin (NFR3.12) |
| A coordinator keeps the right after leaving, after removal or after family erasure | Every writer ends the grant, and an invariant test checks it (NFR7.15, NFR11.4) |
| A member reads hidden contact details through the group page | Same helpers as the directory, decided in the database (NFR1.9) |
| Someone probes which groups exist in other communities | One answer for missing, archived and other-community groups (NFR3.14) |
| A function with raised rights is steered to another schema | Every function pins its own search path (NFR3.15) |
