## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-09T15:24:11Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | src/parent-web/synthetic-parent.ts > testCopiesEnabled / SYNTHETIC_TEST_COPIES | The test-copy fixtures switch on only `process.env.SYNTHETIC_TEST_COPIES === "1"` and has no NODE_ENV guard. It is reachable only in synthetic mode and is set only in playwright.config.ts, so there is no production leak today. A stray value in a synthetic demo deployment would add the Firefox and mobile duties. | Optionally ignore the switch when `NODE_ENV === "production"` and the runtime is not a test run, or document it in the deployment notes. | New |
| R-02 | Minor | app/szulo/actions.ts > markNotificationReadAction and src/parent-web/synthetic-parent.ts > markNotificationRead | The action marks any notification id for the single synthetic actor and does not check that the id belongs to the task page it was opened from. The page gates the call through resolveNotificationContext, but the action is also reachable directly. Because notifications are per-actor and "parent-local" is hardcoded, no cross-parent leak exists in the synthetic build. | When a real parent port replaces the synthetic one, enforce the notification owner check inside the port. Add a note in the code summary. | New |
| R-03 | Minor | app/admin/_components/AdminMutationForm.tsx > noValidate form | With `noValidate`, the summary region carries the error announcement, and fields get aria-invalid and aria-describedby only through AdminTextField. Other admin forms that keep plain inputs show the message only in the summary and focus. | Confirm that every admin form with required fields uses AdminTextField. Otherwise the field-level association is missing. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261009-functional-test-fixes/construction/code-generation/code-summary.md > coverage claims | The greyed read card is checked only with axe, which can miss contrast problems in the hover or disabled states. The test compares background colours only. | Optionally record the measured contrast ratio of `--color-read-text` on `--color-read-bg` (at least 4.5:1) as evidence. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| none run (read-only review) | n/a | Findings come from reading the source and the spec. |

### Summary

FR1-FR9 and R-01..R-06 are satisfied: marking read happens only in a client effect, the notification context is validated server-side and falls back to a redirect, the back-link query is allowlisted by key and length and used only with fixed paths (so no open redirect), and the globalThis state is scoped and reset consistently. The remaining points are minor hardening items, and the tests exercise real behaviour.
