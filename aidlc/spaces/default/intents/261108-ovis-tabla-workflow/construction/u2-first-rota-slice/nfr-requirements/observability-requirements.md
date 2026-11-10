# Observability Requirements: u2-first-rota-slice

Sources: NFR4 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C1 in `contract-summary.md`, and `technology-stack.md`. The app runs only on the owner's computer, so no monitoring, alerting or SLO applies yet.

## Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.4 | The audit action check constraint gains `rota.publish` and `rota.discard`, and past audit events stay readable. | A test applies the change over an audit row of each existing kind. |
| NFR4.5 | A rota audit event concerns a community-wide item, so it carries no working group; the existing audit read policy then lets only super admins read it (U1 reach rules). | An audit read test for a super admin and for a group administrator. |
| NFR4.6 | A failed read or refusal shows the existing error or denied state, never the empty state "Még nincs kiadott beosztás." | A browser or component test covers each state. |
| NFR4.7 | A refusal names its reason in the result envelope (for example ROTA_WEEKS_EMPTY, ROTA_FAMILY_INELIGIBLE, ROTA_PLAN_PUBLISHED) so the screen can explain it and the tests can assert it. | Each refusal code has a test that asserts the code. |
