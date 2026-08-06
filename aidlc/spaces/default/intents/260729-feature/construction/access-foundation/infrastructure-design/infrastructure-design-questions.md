# Infrastructure Design Questions — Access Foundation

## Deployment and Environments

1. Which MVP environment model should be used: a shared development project plus production, or separate development, staging, and production environments?
[Answer]: Development and production only.

2. Should the Next.js application deploy on Vercel while Supabase remains in an EU region, as previously allowed, or should all application hosting use another EU-only platform?
[Answer]: Vercel for Next.js is acceptable; Supabase production remains EU-region.

## Delivery and Operations

3. Which deployment safeguard is preferred: automated production deployment after required checks, or a manual approval step after staging verification?
[Answer]: Manual approval after CI and a development-environment verification checklist; no staging environment for MVP.

4. Who receives initial production alerts for authentication failures, failed jobs, and database/security anomalies?
[Answer]: Developer only.

5. Where should production secrets be managed: Vercel/Supabase environment secret stores, or a separate secrets manager?
[Answer]: Vercel and Supabase environment secret stores for MVP.
