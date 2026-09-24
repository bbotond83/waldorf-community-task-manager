# Parent Experience Construction Contract

## Request Contracts

Cards call scoped duty projection. Signup returns `created|ineligible|full|conflict`; swap returns `pending|auto_approved|admin_pending|rejected|conflict`; cancellation returns `pending|approved|rejected`. Each response updates a persistent Hungarian status card and accessible announcement.

## Display Rules

Every active linked parent sees the family assignment and permitted actions. Primary-recipient selection is admin-only; parent UI displays recipient-neutral reminder status. Loading, empty, error, denied, and stale-version states preserve context without revealing restricted data.

Sources: `../../../inception/units-generation/unit-of-work.md`; `../../../inception/units-generation/unit-of-work-story-map.md`; `../../../inception/requirements-analysis/requirements.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/component-methods.md`; `../../../inception/application-design/services.md`.
