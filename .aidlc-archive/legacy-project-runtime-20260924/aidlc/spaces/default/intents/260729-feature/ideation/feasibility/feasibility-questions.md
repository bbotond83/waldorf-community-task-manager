# Feasibility Questions

## Sources

- [intent] `../intent-capture/intent-statement.md`
- [market] `../market-research/competitive-analysis.md`, `market-trends.md`, and `build-vs-buy.md`
- [regulation] European Commission child-data safeguards: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data/are-there-any-specific-safeguards-data-about-children_en

## Q1. External Integrations

Which external systems must the MVP integrate with beyond the one-time Excel import?

A. None — Excel import and email delivery are sufficient for the MVP
B. A named identity, calendar, or messaging service (please specify)
C. Integration needs are not yet decided
X. Other (please specify)

[Answer]: A. None — Excel import and email delivery are sufficient for the MVP.

## Q2. Delivery Platform

What hosting or technical-platform constraint applies?

A. Use an AWS-based deployment
B. Use an existing named platform or provider (please specify)
C. The platform is not yet decided
X. Other (please specify)

[Answer]: B. Vercel is the hosting platform planning baseline for the Next.js web application. Supabase is the backend, authentication, and database provider. Do not plan AWS hosting for the MVP unless this decision changes.

## Q3. Delivery Constraint

What timeline and budget boundary should feasibility use?

A. A lean MVP: minimize fixed operating cost and target an initial usable release within 3 months
B. A named budget or deadline (please specify)
C. No timeline or budget boundary is confirmed yet
X. Other (please specify)

[Answer]: A. A lean MVP: minimize fixed operating cost and target an initial usable release within 3 months.

## Q4. Privacy Governance

Which privacy-governance baseline should be assumed for family and child-related data?

A. GDPR-aligned: EU data residency, data minimization, role-based access, and retention/deletion decisions before production
B. Treat it as a basic internal operational tool; defer formal privacy controls
C. A named organizational policy applies (please specify)
D. Not yet decided
X. Other (please specify)

[Answer]: A. GDPR-aligned: EU data residency, data minimization, role-based access, and retention/deletion decisions before production.
