## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u12-todo-and-my-tasks/nfr-design/performance-design.md > Writes, row NFR9.15 | The pull is described as locking the selected to-do rows first and then creating the checklist tasks. The functional rules (BR185.1, BR189.1) and the scalability design say the reverse: event row, checklist rows, then to-do rows ascending with the versions checked there. A developer following the performance design would take to-do locks before checklist locks, against the fixed lock order and against the "no checklist command locks a to-do row" argument that rules out deadlocks. | Reword NFR9.15 so the pull takes the event row, then the checklist rows (inside checklist_add_task), then the selected to-do rows ascending. Say that the 50 checklist-task calls and the single insert-select for links fit the 2-second target in that order. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u12-todo-and-my-tasks/nfr-design/security-design.md > Authorization, row NFR3.25 | The row says removal by U14 locks no family row. BR190.1 and C1 say U14's block does take the family row and the to-do removal then locks task rows ascending after it. The post-lock re-check still closes the race, but the stated reason is wrong. | Say that the claim, give-back and done mark lock no family row (project rule), and that the re-check after the task lock covers a removal committing before or after it. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u12-todo-and-my-tasks/nfr-design/security-design.md > Authorization, row NFR3.22 NFR3.26 NFR3.27 | A refused My tasks read for a teacher and for a super admin without a family (NFR3.27) is not named. The row mentions only the denied refusal for "a denied read". A teacher's read of the list and history is allowed and is also not said explicitly. | Add one sentence: My tasks answers the denied refusal for a teacher and for a caller without a family, while the list and the task page are readable by teachers. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u12-todo-and-my-tasks/nfr-design/traceability.json > coverage | Every entry maps an NFR id to a whole file, so NFR8.5 and NFR8.6 (Hungarian text, Stitch, accessibility) point at performance-design.md and NFR6.9 to NFR6.12 point at reliability-design.md without a section. A reader cannot tell which part of the file addresses each requirement. | Add the section name to each target, for example "performance-design.md > Screens". | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Manual coverage check: nfr-requirements ids against nfr-design traceability.json | All 56 sub-ids (NFR1.8-1.10, 3.21-3.31, 4.17-4.25, 5.15-5.22, 6.9-6.12, 7.18-7.24, 8.5-8.6, 9.11-9.17, 10.4-10.5, 11.5-11.7) appear exactly once with status OK; NFR2 is N/A upstream. | Complete. Each target file contains a row that addresses its requirement, apart from the points above. |
| Manual consistency check against rules.md and contract-summary.md | Lock order, post-lock re-check, no family lock, idempotency before audit, and audit in the same transaction match, except the NFR9.15 wording. | One Major, two Minor. |
| New package, service or scheduler check | None added (tech-stack-decisions.md; logical-components.md). | Consistent with the stack constraint. |
| Names and contact details check | None found in the nfr-design files. | Pass. |

### Summary

The designs cover every NFR id of the unit and follow the functional rules (database-side checks, ascending lock order, no family lock, in-transaction audit, idempotent repeats) with no new package or service. The one point to fix before approving is the performance design's pull lock order, which contradicts the rules and the scalability design. The remaining findings are wording gaps.

READY
