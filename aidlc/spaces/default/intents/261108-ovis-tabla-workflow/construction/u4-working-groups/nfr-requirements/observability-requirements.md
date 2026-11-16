# Observability Requirements: u4-working-groups

Sources: NFR4 in `requirements.md`, plus `functional-spec.md` and `rules.md` of this Unit, C1 and C8 in `contract-summary.md`, and `technology-stack.md`. The app runs only on the owner's computer, so no monitoring, alerting or SLO applies yet.

## Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.10 | The existing `role.grant` and `role.revoke` audit actions record appointing and revoking, so no new action is added. The `role.revoke` detail names the reason: `grant:group_admin:revoked`, `grant:group_admin:left_group` or `grant:group_admin:removed`. Past events with the old detail `grant:group_admin` stay readable. | A test reads the detail after revoke, leave, removal and the lifecycle step. |
| NFR4.11 | Joining and leaving are not audited, because they are a parent's own choice and NFR4 does not list them. The membership row keeps `joinedAt`, `endedAt` and `endReason`. | A test checks that a join and a leave by a non-coordinator write no audit event. |
| NFR4.12 | A refusal names its code in the result envelope so the screen can explain it and tests can check it. The codes are ALREADY_MEMBER, NOT_A_MEMBER, ALREADY_COORDINATOR, NOT_COORDINATOR, ACCOUNT_REQUIRED, VERSION_CONFLICT, GROUP_UNAVAILABLE and GRANT_USE_COORDINATOR_ACTION. | Each code has a test that checks for it. |
| NFR4.13 | A failed read or refusal shows the existing error or denied state, never an empty member list ("Még nincs tagja ennek a csoportnak."). | A browser or component test covers each state. |
| NFR4.14 | A coordinator notice whose email fails to send shows on U5's delivery-failures screen as every other notice does. U4 adds no logging of its own. | A test fails the mailer for a coordinator notice and finds the failure row. |
