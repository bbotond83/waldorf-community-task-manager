## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-09T13:22:32Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | app/szulo/_components/NotificationReadForm.tsx > checkbox `disabled={done \|\| isPending}` | The checkbox is disabled while the request runs and stays disabled once read. A keyboard user who ticks it loses focus to the page body on success (only the failure path refocuses). Behaviour, busy state, revert-with-alert, read state and noscript "Mentés" otherwise match FR3. | Optionally move focus to the card link or form after success, or use `aria-disabled` instead of `disabled` while pending. | New |
| R-02 | Minor | app/szulo/ertesitesek/page.tsx > removed "Kapcsolódó feladat" result link | The removed link pointed to the same target as the whole-card link (`notification.link`), so no navigation is lost, and the card now has one link as FR1.5 requires. The only loss is the post-success shortcut next to the success message, and the card link remains the way to the task. | Accept; no action needed unless users relied on the shortcut right after marking read. | New |
| R-03 | Minor | app/globals.css > `.teacher-table tbody tr { position: relative }` with `.teacher-row-link::after { position:absolute; inset:0 }` | The row-wide stretched link depends on `position: relative` on a `tr` as the containing block, which is reliable in current browsers. The Firefox project was not run (code summary), and profile-login-performance and profile-login-existing specs were updated but not executed. | Run the teacher whole-row click on Firefox/WebKit, or run the two unexecuted specs once, before relying on this in release. | New |
| R-04 | Minor | app/szulo/_components/NotificationReadForm.tsx > success-focus effect (lines 36-42) | If the card link is absent, the lookup returns nothing and focus is dropped to the page body, because the disabled box cannot keep it. This is silent. The real page always renders the link (page.tsx line 49), so it does not affect users today. | Optional: fall back to focusing the form's status paragraph or the card container when no link is found. | New |
| R-05 | Minor | tests/integration/notification-read-form.test.tsx > "moves focus to the card link" | The absent-link fallback and the "no refocus on an unrelated re-render" case have no test. The code is correct for both, since the effect only runs when the action state changes. | Optional: add a small test for each. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Read-only code inspection | Focus moves only when `state.state === "success"`. The effect depends on `[state, id]`, so it runs once per new action result and not on plain re-renders. The failure effect is unchanged and still unticks and refocuses the box. | Revision R-01 is correct. |
| Read-only code inspection | The link is found by `data-testid="notification-link-<id>"` inside the form's closest `li`, falling back to the parent. In page.tsx the link and the form are siblings in the same `li`. The browser spec asserts the link is focused after the tick. | Revision is complete and wired end to end. |
| Read-only code inspection | The change is client-side focus only. The server action, authorization and idempotency key are untouched. | No access-rule or security regression. |
| Plan and summary check | Step 16 is marked done in the plan. code-summary.md has the R-01 section. traceability.json still references the form component and its test target. | FR1-FR7 and NFR1-NFR6 traceability is unaffected. I did not re-run the test suites. |

### Summary

The revision is small and correct: focus moves only after a successful save, does not steal focus on re-render, and the failure path is unchanged. Only two optional minor hardening points remain, so it is READY.
