# Units of Work

## Units

- `access-foundation` — roles, scopes, RLS, invitations, revocation; **library**, M.
- `family-directory` — family/parent/child/group/year records; **service**, M.
- `coordination-core` — tasks, events, assignments, signup, requests; **service**, L.
- `notification-jobs` — durable reminders, retry, status; **service**, M.
- `import-migration` — preview, conflict queue, commit, recovery; **service**, L.
- `privacy-audit` — lifecycle, retention, redacted evidence; **service**, M.
- `parent-experience` — duties, requests, notifications; **ui**, M.
- `admin-experience` — records, approvals, import, roles, privacy; **ui**, L.
- `staff-schedule` — read-only scoped schedule; **ui**, S.

## Constraints

Units follow the Application Design ownership and contracts; UI units cannot bypass server authorization. Sources: `../application-design/components.md`, `../application-design/component-methods.md`, `../application-design/services.md`, `../application-design/component-dependency.md`, `../application-design/decisions.md`, `../requirements-analysis/requirements.md`, `../user-stories/stories.md`.

## Responsibility and Deployment

Access is an embedded shared library; Directory, Coordination, Import, Privacy/Audit, and Jobs are embedded server modules with owned records; parent/admin/staff are embedded Next.js UI surfaces. Jobs owns retry/recovery/lifecycle scheduling; Privacy/Audit owns audit retention and lifecycle evidence; other units emit audit events but do not write its records. All units ship in the modular-monolith deployment and use only public contracts/events across boundaries.
