# Observability Design: u6-full-rotas-and-weekend-picks

How the targets in `observability-requirements.md` are met, following `functional-spec.md` and C1 and C9 in `contract-summary.md`. The app runs only on the owner's computer, so there is no metrics, tracing or alerting stack; what happened is read from the audit log, the daily run's records and the result envelope.

## Design

| Requirement | Design |
|---|---|
| NFR4.4 | The audit action check is widened with `family.standing_set` and `weekend_pick.assign`; existing rows are untouched. |
| NFR4.5 | Both events are written with no working group, so U1's audit read rule shows them to super admins only. |
| NFR4.6 | The three checks return `{ created, skipped }` as C9 requires; the run stores that with the outcome, and a failed or missing check appears on U5's delivery-problems screen with no change to that screen. |
| NFR4.7 | This Unit's notices go through `notice_send`, so their emails are ordinary delivery rows and a failure is grouped on the same screen by kind and duty. |
| NFR4.8 | Every refusal is raised through the shared refusal helper with its stable code, and DUTY_INELIGIBLE adds its reason as an extra field of the envelope. The application maps each code to one Hungarian message. |
| NFR4.9 | Each page has three states. The unpicked list shows "Mindenki választott" only for a successful read with no rows; a denied or failed read shows the existing denied or error state. |

## What Is Not Added

No log lines, counters or dashboards are added. The hosting work decides on monitoring once the app runs somewhere other than the owner's computer.
