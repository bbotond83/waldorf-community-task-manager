# RAID Log

## Risks

| ID | Risk | Likelihood | Impact | Mitigation | Source |
| --- | --- | --- | --- | --- | --- |
| R-01 | Role or row-level access rules could expose parent contact details or assignment identities incorrectly. | Medium | High | Make privacy rules explicit in design; test every role and data-access path. | [intent] [Q4] |
| R-02 | A three-month delivery target could be missed through scope expansion toward generic SaaS feature parity. | Medium | High | Preserve exclusions; prioritize a thin role-aware signup and reminder workflow first. | [Q3] [market] |
| R-03 | Vercel, Supabase, or email-provider configuration may not satisfy the intended EU-residency and data-processing controls. | Medium | High | Verify region, contracts, sub-processors, and data flows before production. | [Q2] [Q4] |
| R-04 | One-time Excel source quality may delay import or produce incomplete records. | Medium | Medium | Use preview, mapping, validation, and correction workflow; do not promise live sync. | [intent] [Q1] |

## Assumptions

| ID | Assumption | Validation | Source |
| --- | --- | --- | --- |
| A-01 | Multiple groups and up to 30 families can be served without advanced scaling architecture. | Confirm active users and peak signup patterns during design. | [market] [Q2] |
| A-02 | Email-only notification delivery is sufficient for MVP adoption. | Validate notification engagement after launch. | [Q1] |
| A-03 | Vercel and Supabase can be configured to meet the agreed EU data-residency objective. | Verify selected plans, regions, contracts, and data flows. | [Q2] [Q4] |

## Issues and Dependencies

| Type | Item | Next action |
| --- | --- | --- |
| Issue | Legal basis, retention period, deletion process, and privacy owner are not yet defined. | Resolve before production release. |
| Dependency | Transactional email provider and delivery configuration. | Select during application/infrastructure design. |
| Dependency | Clean source spreadsheet and administrator availability for mapping review. | Validate during import design and migration planning. |

## Sources

- [intent] `../intent-capture/intent-statement.md`
- [market] `../market-research/competitive-analysis.md`, `market-trends.md`, `build-vs-buy.md`
- [Q1]–[Q4] `feasibility-questions.md`
