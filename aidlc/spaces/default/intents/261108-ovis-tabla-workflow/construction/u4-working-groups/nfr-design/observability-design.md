# Observability Design: u4-working-groups

This file shows how the targets in `observability-requirements.md` are met, following `functional-spec.md`, `rules.md` and C1 and C8 in `contract-summary.md`. The app runs only on the owner's computer, so no metric, alert or SLO is added.

## Design

| Requirement | Design |
|---|---|
| NFR4.10 | Appointing writes `role.grant` through `grant_admin`, unchanged. Ending a right writes `role.revoke`. Its detail is `grant:group_admin:<reason>`, from `end_admin`'s new reason parameter. The audit action list is unchanged, so no constraint changes. Past rows keep the detail `grant:group_admin`, and the audit screen shows them as they are. |
| NFR4.11 | Join and leave write no audit row. The membership keeps its join time in the existing `created_at` column (the `joinedAt` of `entities.md`), and `ended_at` and `end_reason`. Leaving as a coordinator still writes the `role.revoke` row. |
| NFR4.12 | Each refusal is returned as a C1 envelope carrying its code. The screen's message map holds the Hungarian text from `rules.md` for each code. |
| NFR4.13 | The page maps a failed read or a denied result to the existing error and denied states. It shows "Még nincs tagja ennek a csoportnak." only for a successful read with no members. |
| NFR4.14 | Coordinator notices go through `notice_send`, so U5's delivery attempts and failures screen cover them with no U4 code. |
