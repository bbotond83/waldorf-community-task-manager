# Performance Design

## Asynchronous Preview

The import API stores the source file in short-lived staging and starts a background parse/validation run rather than processing workbook rows in the request. Progress, row counts, and bounded conflict samples are exposed through a polling projection, keeping import initiation responsive and allowing the recovery flow to complete within one hour.

## Verification

Test representative workbook sizes with malformed, duplicate, and partially valid rows. Capture parse duration, preview latency, commit duration, and recovery duration; verify UI progress remains responsive while validation runs.

Sources: `../nfr-requirements/performance-requirements.md`; `../nfr-requirements/tech-stack-decisions.md`; `../functional-design/business-logic-model.md`.
