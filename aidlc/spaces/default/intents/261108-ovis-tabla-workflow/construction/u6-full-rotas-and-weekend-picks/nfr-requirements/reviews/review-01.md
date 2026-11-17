## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-16T10:57:04Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u6-full-rotas-and-weekend-picks/nfr-requirements/traceability.json > coverage entry NFR11 (target NFR11.1, NFR11.2) | The inception NFR11 says the deletion and anonymisation of leaving families must cover every new kind of record, with history still readable. This Unit adds three new record kinds (family standing per year, weekend slots, weekend picks), and the standing record is exactly the data about a leaving family. NFR11.1 and NFR11.2 only cover the removal preview, the archive refusal and reminder behaviour, so none of them says what happens to the new records when a family is anonymised. The traceability marks NFR11 as OK anyway. | Add a requirement, with a pass criterion, stating how family standing and weekend pick records behave when a family is anonymised or deleted and that history stays readable. Alternatively mark that part of NFR11 explicitly as deferred to U14 with a named owner, and say so in the traceability entry. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u6-full-rotas-and-weekend-picks/nfr-requirements/security-requirements.md > Authorization Requirements NFR3.1 and NFR3.4 | BR65.2 limits the duty card to the holding family and super admins, but NFR3.1 lists only BR65.1 to BR65.4 and NFR3.4 tests reach only for the weekend state. No requirement tests that the duty card itself is refused for an unrelated parent or a teacher. | Name BR65.2 in NFR3.1 and add a reach test for the duty card for an unrelated parent, a teacher and a group administrator. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u6-full-rotas-and-weekend-picks/nfr-requirements/security-requirements.md > NFR3.5 | "The removal pair" is not named, so the catalogue test has no exact list of functions to check, which weakens the pass criterion. | Name the two removal functions, or point to the rule that names them (BR66.4), so the grant test has a fixed list. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Manual coverage check of traceability.json against NFR1 to NFR11 in requirements.md | All 11 are listed. NFR2 is marked N/A with a valid reason. | Complete, apart from the NFR11 content gap above. |
| Manual check of NFRx.y targets | All 50 listed target IDs exist as rows in the requirement files. | No dangling targets. |
| Manual check of BR references in security-requirements.md | BR60.1, BR63.4, BR63.6, BR64.6, BR62.5, BR65.1 to BR65.5, BR67.1 and BR67.2 all exist in rules.md and match the claims. | Cross-references resolve. |

### Summary

The security requirements are measurable, grounded in the rules, and consistent with the contracts, with a sound threat table and database-side authorization checks. The one gap worth weighing before approval is that NFR11 (anonymising leaving families) does not cover this Unit's new standing and pick records, even though traceability marks it covered. Verdict is READY, with one Major and two Minor findings.
