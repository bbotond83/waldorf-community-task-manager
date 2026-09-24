# Frontend Components

## Hierarchy

- `AdminShell` → `ScopeBanner`, role-aware navigation, `Dashboard`, `Records`, `TasksEvents`, `Approvals`, `Import`, `PrivacyLifecycle`, `Archive`, `ReminderMonitor`, `RoleManagement`.

## Behavior

`ScopeBanner` displays active organization/group on every screen; group filters are fixed for group admins. Unauthorized controls are absent and server-denied. Forms expose Hungarian labels, inline errors, confirmation, and accessible status messages.
