# Security Design

## Family Isolation

Every parent route derives the family identity from the authenticated session; it never accepts another family ID as authority. Server-side authorization and database RLS return only the parent's linked children, eligible tasks, and their own requests. Contact data, optional profiles, private reasons, and unrelated family activity are omitted from all parent projections.

## Safe Actions

Cancellation and swap forms validate eligibility and ownership again at the command boundary. Sensitive reason text is visible only to the requester and authorized administrators, is not included in analytics or audit summaries, and receives accessible generic error handling if a request is denied.

Sources: `../nfr-requirements/security-requirements.md`; `../nfr-requirements/tech-stack-decisions.md`; `../functional-design/business-logic-model.md`.
