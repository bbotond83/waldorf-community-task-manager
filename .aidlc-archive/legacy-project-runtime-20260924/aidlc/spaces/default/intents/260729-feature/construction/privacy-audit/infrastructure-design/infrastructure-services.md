# Infrastructure Services

## Retention Store

EU Supabase Postgres stores redacted audit events, lifecycle candidates, holds, and resumable batch state. Timestamp and entity indexes support scoped investigation and one-year retention cleanup; batch processing avoids long transactions and removes contact/profile data before anonymizing history.

## Access Boundaries

Server policy and RLS restrict audit/lifecycle projections to Super Admin and Kindergarten Admin. Managed backups and recovery are configured on production; raw sensitive text is rejected before audit persistence.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
