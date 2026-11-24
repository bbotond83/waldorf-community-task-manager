# Observability Design: u11-checklists-and-templates

How the targets in `observability-requirements.md` are met, following `functional-spec.md` and C1, C8 and C9 in `contract-summary.md`. The app runs only on the owner's computer, so there is no monitoring, alerting or SLO; the record is the audit log, the run record and the result envelope.

| Requirement | Design |
|---|---|
| NFR4.12 | The migration adds `checklist.template_removed`, `checklist.template_restored`, `checklist.claim_removed`, `checklist.done_undone` and `checklist.removal_applied` to the audit action list; existing rows are untouched. |
| NFR4.13 | Each check returns `{created, skipped}` to U5's run and puts the ids of events that failed in the run's `detail` column, as U9's check does; the super admin sees it on the existing failures screen. |
| NFR4.14 | The two notice kinds go through `notice_send`, so U5's failed-delivery list shows them by kind, without an address. |
| NFR4.15 | Each refusal is a named code in the C1 envelope; the screen maps the code to Hungarian text and each code has a test that asserts it. |
| NFR4.16 | The page layer shows its error or denied state whenever a read fails or is refused, and the empty-checklist or empty-templates text only after a successful read with no rows. |
