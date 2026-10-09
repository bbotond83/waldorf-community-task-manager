# Authorization and Sensitive-Field Contract

The machine sources are [`authorization-matrix.json`](authorization-matrix.json) and [`sensitive-fields.json`](sensitive-fields.json). Their stable versions are referenced by every verification evidence record.

| Role                 | Permitted scope                            | Main allow boundary                                       | Required negative boundary                                     |
| -------------------- | ------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------- |
| Parent               | linked family and own requests/assignments | duties, notifications, own contribution                   | unrelated family and sensitive fields                          |
| Kindergarten teacher | granted schedule group                     | schedule owner/assignee/status and required display names | every mutation, ungranted group, contact/profile/reason fields |
| Group Administrator  | granted groups                             | core records/tasks/assignments/approvals/archive          | ungranted group and every organization advanced operation      |
| Super Administrator  | organization including governance          | all approved administration                               | stale/revoked authorization version                            |

All denials use the same non-enumerating application contract: HTTP 403 where an HTTP response applies, `AUTHORIZATION_DENIED`, no state mutation, no resource-existence signal, and redacted identifier-only evidence. Grant removal is effective on the next protected request and clears protected cached navigation/data.

Sensitive contact, locality, optional-profile, protected-reason, participant, and unrelated-family classes are absent from unauthorized projections—not merely hidden in the UI. The dictionary also defines log, audit, fixture, screenshot, report, and lifecycle treatment.

The four current selectable profiles match the runtime catalog. Converted legacy kindergarten administrators use organization-scoped Super administrator workflows, including governance; Parent/Teacher/Group admin direct advanced requests deny. Old teacher bookmarks are compatibility-only redirects and never create a session. Historical reports remain historical evidence.
