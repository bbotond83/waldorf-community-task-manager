## Review

**Verdict:** READY
**Reviewer:** aidlc-product-lead-agent
**Date:** 2026-10-09T14:45:28Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261009-functional-test-fixes/inception/requirements-analysis/requirements.md > FR2.1, FR2.2, FR2.4 | Marking read happens when the task page is requested (see the assumption). A browser link preview, prefetch or reload would then mark a notification read without the parent opening it. The requirements also do not say whether the list shows the read state on return through the back button or a cached page. | Add a testable rule that only a real page open marks read, and that the list shows the read state when the parent returns by link or back button, or record explicitly that preview marking is accepted. | New |
| R-02 | Major | aidlc/spaces/default/intents/261009-functional-test-fixes/inception/requirements-analysis/requirements.md > FR2.3 | Only a foreign or unknown notification id is handled. A valid notification id of the parent that belongs to a different task than the one in the address is not covered. It would mark the wrong notification and show the wrong menu and back link. | State that the notification context and the marking apply only when the notification belongs to this parent and refers to this task, otherwise treat the page as opened from the task list. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261009-functional-test-fixes/inception/requirements-analysis/requirements.md > FR1.3 | The sentence says the flow "also works" for notice-stale notifications, which is vague. The notification card link and the "not marked read" outcome are not clearly tied to the card. | Say what opening such a card does and what shows afterwards, and whether it is ever marked read. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261009-functional-test-fixes/inception/requirements-analysis/requirements.md > FR7.2, FR7.3 | It is not stated which notice shows if both a swap and a cancellation request are already pending in existing data. | Name the notice for that case, for example both or the earliest. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261009-functional-test-fixes/inception/requirements-analysis/requirements.md > FR9.2 | "Values that are too long" has no limit, so QA cannot write the test. | List each field with its maximum length, or point to the existing validation limits. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261009-functional-test-fixes/inception/requirements-analysis/requirements.md > FR6.1 | "Elutasítva when the data can contain it" depends on the design stage, so the pass or fail check is open. | Decide now, or require the design stage to record the decision as a checked item. | New |

### Summary

All nine requested fixes and the three later decisions are covered, with no direct contradictions between FR1.3 and FR2.4 or between FR7.2 and FR7.3. Two read-marking corners (marking on page request, and a notification that belongs to a different task) should be settled before design.
