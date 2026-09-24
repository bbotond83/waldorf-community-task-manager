# Infrastructure Design Memory

## Interpretations

- 2026-08-06T00:00:00Z — Interpreted manual production approval with no staging as approval after CI and a development-environment verification checklist; the user explicitly selected dev and production only.

## Deviations

- 2026-08-06T00:00:00Z — Omitted a separate secrets manager for MVP because the user selected Vercel and Supabase managed environment secret stores.

## Tradeoffs

- 2026-08-06T00:00:00Z — Accepted developer-only initial alert ownership to reduce MVP operational coordination; the alert routes can be expanded before production handover.

## Open questions

- 2026-08-06T00:00:00Z — Exact EU-region identifiers, provider DPAs, controller identity, and production alert channels remain release-time configuration decisions.
