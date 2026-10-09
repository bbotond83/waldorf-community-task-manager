## Review

**Verdict:** READY
**Reviewer:** aidlc-product-lead-agent
**Date:** 2026-10-09T12:36:32Z
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
| R-07 | Minor | aidlc/spaces/default/intents/261009-navigation-polish/inception/requirements-analysis/requirements.md > FR6.1 and FR6.2 | The welcome page is "no longer shown" after choosing a profile, but nothing says what happens if someone opens its address directly, or whether the page stays in the code. | Say whether the welcome page is removed or redirects to the profile's default page, and add a pass/fail check for it. | New |
| R-08 | Minor | aidlc/spaces/default/intents/261009-navigation-polish/inception/requirements-analysis/requirements.md > FR6.4 | Landing after real sign-in is specified only for a parent. Teacher and admin landing after real sign-in is silent, although FR6.1 gives them default pages. | State that real sign-in for the other roles is unchanged (matching Out of Scope) or that they use their default page as well. | New |
| R-09 | Minor | aidlc/spaces/default/intents/261009-navigation-polish/inception/requirements-analysis/requirements.md > FR2.3 | "Filters use the same words" does not say whether the filter values carried in the page address change. Existing bookmarked or shared filter links could break. | State that only displayed labels change and that the current address values keep working, or name the new values. | New |
| R-10 | Minor | aidlc/spaces/default/intents/261009-navigation-polish/inception/requirements-analysis/requirements.md > FR3.3a and FR6.5 | The Hungarian error message has no stated way of being announced to assistive technology. The denied page a teacher sees is not required to offer the way back to Beosztás. | Require that the error is announced (for example as an alert) and that the denied page also links back to Beosztás for a teacher. | New |
| R-11 | Minor | aidlc/spaces/default/intents/261009-navigation-polish/inception/requirements-analysis/requirements.md > FR6.5 | The header logo is said to link to Beosztás for a teacher, but the logo target for parents and admins is not stated, so a developer could change it for everyone. | State that the logo target for parent and admin profiles is unchanged, or give their default pages. | New |
| R-12 | Minor | aidlc/spaces/default/intents/261009-navigation-polish/inception/requirements-analysis/requirements.md > FR3.3b | The no-script form shows a "Mentés" button, but it does not say what is submitted when the checkbox is left unticked. | Add one sentence: submitting without the box ticked changes nothing and shows no error. | New |
| R-13 | Minor | aidlc/spaces/default/intents/261009-navigation-polish/inception/requirements-analysis/requirements.md > FR6.4 and FR6.4a vs Out of Scope "any change to real authentication" | Landing page after real sign-in changes, while Out of Scope excludes changes to real authentication. This reads as a contradiction. | Reword the Out of Scope line to "no change to how sign-in verifies a person; only the landing page after it changes". | New |
| R-14 | Minor | aidlc/spaces/default/intents/261009-navigation-polish/inception/requirements-analysis/requirements.md > FR2.1 and Open item | Status labels are deferred to design, yet only six example values are given. FR2.4 makes the test the safety net, which is enough to proceed. | No block; make the design stage list the full value-to-label table before code generation. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round

> R-06 Not re-checked this round

> R-07 Not re-checked this round

> R-08 Not re-checked this round

> R-09 Not re-checked this round

> R-10 Not re-checked this round

### Summary

The four added points (FR6.2, FR6.4a, FR2.3, FR3.3a, FR6.5) are testable and consistent with the Q&A answers and the other requirements. I found no Critical or Major gaps. The remaining points are wording clarifications that engineering can settle without coming back to ask.
