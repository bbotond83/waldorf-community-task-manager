# Observability Design: u10-events-and-signups

How the targets in `observability-requirements.md` are met, following `functional-spec.md` and C1 and C8 in `contract-summary.md`. The app runs only on the owner's computer, so there is no monitoring, alerting or SLO; the record is the audit log and the result envelope.

| Requirement | Design |
|---|---|
| NFR4.4 | The migration adds the new action names (event cancelled, organiser marked and unmarked, sign-up or offer removed by a manager, typed name cleared, removal applied) to the audit action list; existing rows are untouched. |
| NFR4.5 | Audit entries are written and read through the existing audit helper and reader; no new reader is added. |
| NFR4.6 | The three notice kinds go through `notice_send`, so U5's failed-delivery list already shows them by kind, without an address. |
| NFR4.7 | Each refusal is a named code in the C1 envelope; the screen maps the code to Hungarian text and each code has a test that asserts it. |
| NFR4.8 | The page layer shows its error or denied state whenever a read fails or is refused, and the empty-list text only after a successful read with no rows. |
