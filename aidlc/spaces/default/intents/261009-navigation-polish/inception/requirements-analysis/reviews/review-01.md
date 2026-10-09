## Review

**Verdict:** READY
**Reviewer:** aidlc-product-lead-agent
**Date:** 2026-10-09T12:28:59Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261009-navigation-polish/inception/requirements-analysis/requirements.md > FR3.3 and FR3.5 | The checkbox marks a notification as read at once, but the failure case is not stated. FR3.5 only says "same error states as today", and today's mark-as-read is a button. It is unclear what the card shows if the action fails: does the box revert to unticked, is a message shown, and what happens when JavaScript is off or the request is slow? A tester cannot write a pass/fail check for this. | State the checkbox outcomes explicitly: success (ticked and disabled), failure (box reverts and a Hungarian error message appears), and the in-progress state. State whether the action must work without client-side JavaScript. | New |
| R-02 | Major | aidlc/spaces/default/intents/261009-navigation-polish/inception/requirements-analysis/requirements.md > FR6.3 | The teacher gets no menu and no "Navigáció" toggle, and Beosztás is described as their only page. But teachers open item detail pages from the schedule (FR1.2). Nothing says how a teacher gets back from a detail page to Beosztás. The requirements also do not say what the teacher sees when they open a URL for a page they cannot access. | Add a requirement that every teacher detail page has a visible way back to Beosztás (for example a back link or the logo link). State that a teacher opening a non-permitted page behaves as it does today. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261009-navigation-polish/inception/requirements-analysis/requirements.md > FR2.1 and Open question | The status-word list is deferred to design. Only six examples are given, so the acceptance rule for "every status value is Hungarian" has no fixed list to test against. | Keep the deferral, but add an acceptance check: a test that fails if any status value rendered by the app lacks a Hungarian label. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261009-navigation-polish/inception/requirements-analysis/requirements.md > FR1.2 and FR1.5 | In the teacher table layout the whole row is clickable "through its title cell link". FR1.5 requires one link with one accessible name per item. A stretched-link row can break table semantics and give a different accessible name than the card layout. | State that the table keeps its row and cell semantics and that the accessible name matches the card layout. Mention a keyboard and screen-reader check for the table layout. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261009-navigation-polish/inception/requirements-analysis/requirements.md > FR6.1 and FR6.2 | The default page is defined for the four profiles only. The requirements do not say what happens when the session has a role with no default or has expired, or when a landing page is not allowed for the role. | Add one line: a session with an unknown role or no session keeps today's behaviour (profile chooser or sign-in). | New |
| R-06 | Minor | aidlc/spaces/default/intents/261009-navigation-polish/inception/requirements-analysis/requirements.md > FR7.1 and Assumptions | The group admin menu is stated as matching what the admin can already reach, but this is only an assumption. NFR5 says no profile may gain access to a page it did not have. Archívum, Nyilvántartások and Feladatok és események are shown to the group admin on every page, which makes the claim load-bearing. | Add a check against the existing access rules, for example a test that each menu link resolves to an allowed page for that role. | New |

### Summary

The eight points are covered with traceable, mostly testable requirements, and the three owner decisions are recorded and carried through. Two gaps should be weighed before approval: the checkbox failure and in-progress behaviour, and how a teacher navigates back from a detail page without a menu. Neither needs a loop-back, and both can be settled in design or at the code gate.
