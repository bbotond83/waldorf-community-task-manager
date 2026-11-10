# Observability Design: u2-first-rota-slice

The app runs only on the owner's computer, so no metrics, alerting or SLOs are designed. Audit and visible error states carry the requirements in `observability-requirements.md`.

| Requirement | Design |
|---|---|
| NFR4.4 | The audit action check constraint is widened with `rota.publish` and `rota.discard` in the migration; existing rows are untouched. |
| NFR4.5 | Publish and discard write their audit rows with no working group. U1's audit read policy lets only super admins read rows with no group, so no new policy is needed. |
| NFR4.6 | Every rota page maps three outcomes to three states: success, the nothing-published empty state, and the existing error or denied state. A failed read never shows the empty state. |
| NFR4.7 | Each refusal is a code in the result envelope (ROTA_PLAN_EXISTS, ROTA_WEEKS_EMPTY, ROTA_BREAK_WEEK, ROTA_FAMILY_INELIGIBLE, ROTA_PLAN_PUBLISHED, DUTY_ROTA_MANAGED, VERSION_CONFLICT); the page maps each to a Hungarian sentence and the tests assert the code. |
