# Constraint Register

## Active Constraints

This register applies the approved [intent statement](../intent-capture/intent-statement.md) and findings from the [competitive analysis](../market-research/competitive-analysis.md), [market trends](../market-research/market-trends.md), and [build-vs-buy assessment](../market-research/build-vs-buy.md).

| ID | Constraint | Type | Impact | Response | Source |
| --- | --- | --- | --- | --- | --- |
| C-01 | Host the Next.js web application on Vercel. | Platform | Excludes AWS hosting from MVP planning. | Use Vercel as the deployment baseline; revisit only by explicit decision. | [Q2] |
| C-02 | Use Supabase for backend, authentication, and database. | Platform | Shapes identity, data, and authorization options. | Validate role enforcement and EU-region configuration in later design. | [Q2] |
| C-03 | Support only one-time Excel import and email delivery as integrations. | Integration | Limits integration surface and operational dependencies. | Migrate all 17 legacy sheets with validation and repeat-safe identity handling; do not add calendar/chat integrations without approval. | [Q1] [PRD-27] |
| C-04 | Deliver a usable MVP within three months with minimal fixed operating cost. | Delivery | Requires disciplined prioritization and prevents broad feature parity work. | Preserve explicit exclusions and plan thin vertical slices. | [Q3] |
| C-05 | Apply GDPR-aligned EU data residency, minimization, role-based access, annual review, and retention/deletion decisions before production. | Regulatory/privacy | Child- and family-related data processing needs governance controls. | Define legal basis, annual review, child-leaving deletion, sibling exceptions, and audit treatment before release. | [Q4] [PRD-27] |
| C-06 | Restrict contact and sensitive profile details by role; expose participant display names only where coordination needs them. | Product/privacy | Authorization errors would violate the approved product boundary. | Treat UI and REST permissions, immediate revocation, and field-level access as non-negotiable design/test concerns. | [intent] [PRD-27] |
| C-07 | Keep native apps, SMS/WhatsApp, payments, auto-rotation, new ongoing completion tracking, and live Excel synchronization out of MVP. | Scope | Prevents schedule and cost overrun. | Preserve imported legacy completion/status values; maintain the formal defer list through delivery planning. | [intent] [PRD-27] |

## Dependencies and Decisions

- Vercel and Supabase region and service settings must be selected to support the EU-residency objective.
- A transactional email provider and its data-processing terms remain a downstream decision.
- The legal basis, retention period, deletion workflow, and operational privacy owner remain unresolved and must not be inferred from the GDPR planning baseline.
- Import mapping, stable identity matching, atomicity/rollback, hostile-file controls, and recovery remain unresolved; the all-17-sheet migration scope is not optional.

## Sources

- [intent] `../intent-capture/intent-statement.md`
- [market] `../market-research/competitive-analysis.md`, `market-trends.md`, `build-vs-buy.md`
- [Q1]–[Q4] `feasibility-questions.md`
