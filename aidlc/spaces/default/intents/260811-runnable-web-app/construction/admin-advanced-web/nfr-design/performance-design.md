# Administrator Advanced Web Performance Design

## Sources

Implements [performance requirements](../nfr-requirements/performance-requirements.md), [security requirements](../nfr-requirements/security-requirements.md), [stack decisions](../nfr-requirements/tech-stack-decisions.md), and [business logic](../functional-design/business-logic-model.md).

## Design

Import parsing and comparison produce a server-owned preview identifier, immutable workbook fingerprint, bounded summary counts, and paginated row/conflict projections. Each step reads only its preview slice; resolution updates one conflict; commit consumes the stored preview once and returns a compact reconciliation outcome. Reminder, grant, lifecycle, recipient, and settings lists use server filters and stable pagination; detail loads one authorized object plus required references.

Server actions expose pending state immediately, retain the stable idempotency/correlation identity, and revalidate only affected routes. URL and server-owned workflow state preserve filters, active step, and safe resolutions without uploading or parsing the workbook again. Client islands do not duplicate protected data or computation.

## Budgets and Measurement

Measure every critical step/action from request to render-ready explicit result on versioned fixtures. Two seconds is the target for each bounded operation; continued loading is announced after the threshold and must terminate. Record payload/page bounds and separate synthetic timing from outstanding linked-target persistence/provider evidence.
