# Unit Story Map

## Coverage

| Stories | Units |
|---|---|
| US-01, US-02, US-03 | access-foundation, family-directory, coordination-core, parent-experience |
| US-04 | notification-jobs, parent-experience |
| US-05, US-06, US-07 | access-foundation, family-directory, coordination-core, admin-experience |
| US-08, US-09, US-10 | import-migration, admin-experience |
| US-11 | privacy-audit, admin-experience |
| US-12 | access-foundation, family-directory, import-migration |
| US-13 | staff-schedule, access-foundation, coordination-core |
| US-14 | all units |

## Verification

Every story maps to one or more units; every unit has one or more stories. Cross-cutting accessibility, authorization, privacy, audit, and quality requirements apply to all affected units.

## Unit Story Sequence

- access-foundation: US-06, US-12, US-13
- family-directory: US-01, US-05, US-12
- coordination-core: US-02, US-03, US-07, US-10
- notification-jobs: US-04, US-09
- import-migration: US-08, US-09, US-10, US-12
- privacy-audit: US-11
- parent-experience: US-01, US-02, US-03, US-04
- admin-experience: US-05, US-06, US-07, US-08, US-09, US-10, US-11
- staff-schedule: US-13

Cross-unit contracts are authorization/revocation, family relevance, assignment-change/reminder events, import-recovery jobs, and redacted audit events.
