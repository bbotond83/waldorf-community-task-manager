# Bolt Plan

## Bolts

1. **Foundation Skeleton** — access-foundation, family-directory, coordination-core, parent-experience; walking skeleton. **DoD:** a linked parent securely views and signs up for a duty. **Hypothesis:** the full authorization-to-UI transaction works.
2. **Requests and Reminders** — coordination-core, notification-jobs, parent-experience. **DoD:** swap/cancellation paths and 7-day/24-hour reminders are durable and auditable. **Hypothesis:** responsibility changes remain reliable.
3. **Scoped Administration** — access, directory, coordination, admin-experience. **DoD:** authorized record, assignment, event-note, and revocation workflows work. **Hypothesis:** staff can operate safely.
4. **Migration and Recovery** — import-migration, jobs, admin-experience. **DoD:** all-sheet preview, conflict resolution, atomic commit, and recovery drill pass. **Hypothesis:** legacy data can migrate safely.
5. **Privacy and Staff Visibility** — privacy-audit, staff-schedule, admin-experience. **DoD:** lifecycle, redacted evidence, and read-only schedule behavior pass. **Hypothesis:** privacy operations are sustainable.

## Operating Model

Bolts are thin end-to-end slices. Independent work may run in parallel only when the unit DAG prerequisites and contracts are stable.
