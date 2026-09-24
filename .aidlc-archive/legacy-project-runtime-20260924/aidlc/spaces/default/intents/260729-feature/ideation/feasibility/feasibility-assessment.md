# Feasibility Assessment

## Decision Context

This assessment builds on the approved [intent statement](../intent-capture/intent-statement.md), [competitive analysis](../market-research/competitive-analysis.md), [market trends](../market-research/market-trends.md), and [build-vs-buy assessment](../market-research/build-vs-buy.md). The product is a bounded, privacy-sensitive kindergarten coordination MVP for multiple groups and up to 30 families.

The confirmed deployment baseline is a Next.js web application hosted on Vercel, with Supabase providing backend, authentication, and database capabilities. Excel import and email delivery are the only external integration needs for the MVP. [Q1] [Q2]

## Feasibility Verdict

**Conditionally feasible.** The core workflow is suitable for a lean three-month MVP because it relies on common web capabilities: role-aware access, structured records, self-service signup, scheduled email reminders, and a one-time import. The local scale does not require a distributed architecture or AWS hosting.

The decision to use a tailored build remains justified by the market assessment: the combined Hungarian-language experience, family-owned assignments, and role-based privacy boundary are central requirements, not commodity extras. The MVP must maintain its explicit exclusions and avoid expanding to payments, native apps, live Excel sync, or broad volunteer-management features.

## Conditions for Delivery

| Area | Feasibility condition | Owner at later stages |
| --- | --- | --- |
| Identity and roles | Validate that Supabase authorization design can enforce the approved role and contact-visibility rules. | Architecture and security design |
| Data location | Configure Vercel and Supabase regions and supporting services to meet the EU-data-residency decision. | Infrastructure and compliance design |
| Email | Select and validate a transactional email approach, including delivery failures and Hungarian templates. | Application and operations design |
| Import | Migrate all 17 legacy sheets with preserved operational meaning, admin-mapped preview/validation, repeat-safe identity matching, and no ongoing synchronization. | Requirements, functional, and application design |
| Schedule | Protect the three-month boundary through Must/Should prioritization and defer excluded features. | Scope and delivery planning |
| Privacy | Define field-level access, annual review, child-leaving deletion, sibling exceptions, audit treatment, and legal basis before production. | Compliance and NFR stages |

## Confidence and Open Items

Feasibility confidence is **medium-low**. Product scope and platform choices are clear, but Section 27 materially expands migration and privacy detail: deterministic mapping, identity/conflict resolution, import atomicity/recovery, retention/deletion ownership, and notification behavior still need decisions. GDPR alignment is a planning baseline, not a legal-compliance certification.

## Sources

- [intent] `../intent-capture/intent-statement.md`
- [market] `../market-research/competitive-analysis.md`, `market-trends.md`, `build-vs-buy.md`
- [Q1]–[Q4] `feasibility-questions.md`
