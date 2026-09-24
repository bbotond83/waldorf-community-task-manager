# Ideation Decision Log

## Product and Scope

- Feature scope; Hungarian, warm/calm mobile-first MVP.
- Vercel/Next.js with Supabase backend/auth/database; email only beyond Excel import.
- GDPR-aligned EU residency/minimization/access baseline.
- Privacy foundation -> parent workflow/reminders -> admin/import delivery order.
- PRD Section 27 is authoritative: migrate all 17 legacy workbook sheets without silently dropping operational meaning; preserve imported legacy status/progress/completion values, but do not introduce a new completion workflow without approval.
- Use `hu-HU`, `Europe/Budapest`, RFC 3339 timestamps, UTF-8 normalization, E.164 phone storage, and equivalent validation across product and import surfaces; detailed import and privacy operations remain requirements/design decisions.

## Delivery and UX

- Solo part-time developer; kindergarten admin owns product/privacy decisions.
- WCAG 2.2 AA-aligned semantic, keyboard, screen-reader-readable Hungarian UI.
- Rough mockups approved by product-lead reviewer.
