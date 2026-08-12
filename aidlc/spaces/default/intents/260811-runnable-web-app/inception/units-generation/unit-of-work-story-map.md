# Unit Story Map

## Sources and Coverage Rule

This map consumes Application Design [components](../application-design/components.md), [component methods](../application-design/component-methods.md), [services](../application-design/services.md), [component dependency](../application-design/component-dependency.md), and [decisions](../application-design/decisions.md), plus approved [requirements](../requirements-analysis/requirements.md) and [stories](../user-stories/stories.md). Every active local-runtime story and inherited US-01–US-14 path has an owning unit; retired umbrellas US-LR-06a/06b and aggregation epics are not delivery-counted.

## Active Local Story Ownership

| Story | Owning unit | Supporting units |
|---|---|---|
| US-LR-00 | application-facades | runtime-foundation, verification-handoff |
| US-LR-01 | runtime-foundation | verification-handoff |
| US-LR-02 | runtime-foundation | application-facades, parent-web |
| US-LR-03 | runtime-foundation | application-facades, all UI units |
| US-LR-04a | parent-web | application-facades, verification-handoff |
| US-LR-04b | parent-web | application-facades, verification-handoff |
| US-LR-04c | parent-web | application-facades, verification-handoff |
| US-LR-04d | parent-web | application-facades, verification-handoff |
| US-LR-04e | parent-web | runtime-foundation, application-facades |
| US-LR-04f | parent-web | application-facades, admin-core-web |
| US-LR-05 | staff-web | application-facades, verification-handoff |
| US-LR-06a1 | admin-core-web | application-facades |
| US-LR-06a2 | admin-core-web | application-facades, admin-advanced-web |
| US-LR-06b1 | admin-core-web | application-facades |
| US-LR-06b2 | admin-core-web | application-facades |
| US-LR-06c | admin-core-web | application-facades, verification-handoff |
| US-LR-06d | admin-advanced-web | application-facades, verification-handoff |
| US-LR-06e | admin-advanced-web | application-facades, verification-handoff |
| US-LR-06f | admin-advanced-web | application-facades, verification-handoff |
| US-LR-06g | admin-advanced-web | application-facades, runtime-foundation |
| US-LR-06h | application-facades | parent-web, admin-core-web, admin-advanced-web, verification-handoff |
| US-LR-07 | verification-handoff | application-facades, all UI units |
| US-LR-08 | verification-handoff | every production-code unit |
| US-LR-09 | verification-handoff | runtime-foundation |

## Inherited Story Preservation

| Inherited story | Owning unit(s) |
|---|---|
| US-01–US-04 | parent-web, application-facades |
| US-05–US-06 | admin-core-web, admin-advanced-web, application-facades |
| US-07 | parent-web, admin-core-web, application-facades |
| US-08–US-10 | admin-advanced-web, application-facades |
| US-11 | admin-advanced-web, application-facades |
| US-12 | application-facades, parent-web, admin-core-web, admin-advanced-web |
| US-13 | staff-web, application-facades |
| US-14 | parent-web, runtime-foundation, application-facades |

## Within-Unit Story Grouping

This is cohesion grouping, not cross-unit economic sequencing:

- `runtime-foundation`: startup/config/composition → session/shell → synthetic reset/fixtures.
- `application-facades`: shared result/auth contract → role façades → events/jobs/evidence mapping.
- `parent-web`: invitation/auth → duties/signup → requests → notifications/notes → recovery/accessibility.
- `staff-web`: schedule/filter/detail → denial/failure/accessibility.
- `admin-core-web`: shell/dashboard → records/archive → tasks/assignments → approvals/notes.
- `admin-advanced-web`: import → reminders → governance/revocation → lifecycle/recipient settings.
- `verification-handoff`: manifest/fixtures → focused tests → browser/security/a11y gates → build/start/runbook/report.

## Coverage Verification

Every active delivery story maps to one owning unit and at least one acceptance boundary. Every unit owns stories. Cross-cutting authorization, privacy, accessibility, localization, quality, browser, and no-deployment requirements map through `application-facades`, affected UI units, and `verification-handoff`. The scenario manifest remains the machine-verifiable preservation gate.
