# Role Personas

## Definitions

These are functional personas derived from the approved roles, not researched demographic profiles. No additional role, technical-comfort claim or usage frequency is inferred.

| ID | Name / role | Goals | Needs and friction addressed | Context |
| --- | --- | --- | --- | --- |
| P1 | Parent / Szülő | Participate in own-family duties, requests and notifications. | Preserve familiar permitted workflows without exposing another family's information. | Existing parent behavior remains scoped to their own family. |
| P2 | Group admin | Administer their assigned groups' core records, tasks, assignments and queues. | Retain group administration while knowing which operations belong to the super administrator. | Group grants do not authorize unrelated groups or organization-wide advanced operations. |
| P3 | Kindergarten teacher / Óvónő | Follow scheduled tasks/events, owners, assignments and current status. | Understand who is responsible and how work is progressing without editing records or seeing private family details. | Assigned-group read-only access; existing Munkatárs grants transition to this role without changing group scope or revocation state. |
| P4 | Super administrator | Administer the organization and govern access; retain imports, reminders, privacy operations and settings. | Convert obsolete roles coherently and keep business records intact. | Existing kindergarten administrators transition to super administrators with governance rights; this is an approved privilege expansion within their organization, not a fifth persona. |

## Relationships and Priority

All four personas are in scope and their approved outcomes are Must Have. Teacher tracking is the distinct user-facing change. Super administrators govern the current catalog and migration; group admins retain group-scoped core administration; parents retain own-family participation. Role boundaries remain explicit even when the same person holds more than one grant.

Persona ordering is explanatory, not a release priority or invented stakeholder ranking. Delivery Planning determines sequencing using dependencies and the approved requirements.

## Sources and Limits

[requirements.md](../requirements-analysis/requirements.md), completed [user-stories-questions.md](user-stories-questions.md), shared CodeKB business-overview.md and component-inventory.md, and [team-practices.md](../practices-discovery/team-practices.md). Existing-role observations are current-state evidence; future permissions come from the approved requirements. No new event feature, live backend linkage or demographic assumptions are introduced.
