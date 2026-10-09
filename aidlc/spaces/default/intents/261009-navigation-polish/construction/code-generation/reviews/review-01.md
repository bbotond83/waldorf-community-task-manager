## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-09T00:00:00Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | app/szulo/_components/NotificationReadForm.tsx > checkbox `disabled={done \|\| isPending}` | The checkbox is disabled while the request runs and stays disabled once read. A keyboard user who ticks it loses focus to the page body on success (only the failure path refocuses). Behaviour, busy state, revert-with-alert, read state and noscript "Mentés" otherwise match FR3. | Optionally move focus to the card link or form after success, or use `aria-disabled` instead of `disabled` while pending. | New |
| R-02 | Minor | app/szulo/ertesitesek/page.tsx > removed "Kapcsolódó feladat" result link | The removed link pointed to the same target as the whole-card link (`notification.link`), so no navigation is lost, and the card now has one link as FR1.5 requires. The only loss is the post-success shortcut next to the success message, and the card link remains the way to the task. | Accept; no action needed unless users relied on the shortcut right after marking read. | New |
| R-03 | Minor | app/globals.css > `.teacher-table tbody tr { position: relative }` with `.teacher-row-link::after { position:absolute; inset:0 }` | The row-wide stretched link depends on `position: relative` on a `tr` as the containing block, which is reliable in current browsers. The Firefox project was not run (code summary), and profile-login-performance and profile-login-existing specs were updated but not executed. | Run the teacher whole-row click on Firefox/WebKit, or run the two unexecuted specs once, before relying on this in release. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Read-only code and diff inspection | Pass | FR1-FR7 map to existing files. The menus in `profiles.ts` are a subset of what each role's authorization rows allow. The group admin menu has only Áttekintés, Nyilvántartások, Feladatok és események, Jóváhagyások, Archívum, with no import, reminders, privacy or settings. The super admin gets the extra four. Import and settings pages keep their own server-side guards, and `authorization.ts` changed only `HOME_PATH_BY_ROLE.parent`. |
| Redirect and landing logic | Pass | `app/page.tsx` still handles the configuration error, production mode, and no/expired/unknown session cases as before. Only the signed-in case now redirects to `homePath`. The session route keeps its origin check, `profileId=""` sign-out and 400 handling. `safeDestination` still lets a requested `/szulo/...` destination win. |
| Whole-card controls | Pass | Admin items and the teacher table and card layouts each have one link per item (stretched link, row/cell semantics kept). The notification card has one link plus the checkbox form as siblings, not nested. |
| Focus outline | Pass | `outline: none` applies only to `[tabindex="-1"]` targets (headings, main). Global `:focus-visible` is kept, and the stretched teacher links draw the ring on `::after`. No other `tabIndex=-1` interactive elements were found. |
| `verification/fixtures.json` and `/admin/beallitasok` CSS fix | Acceptable | The parent `home` value is aligned with the runtime profile, which a unit test checks. The `.admin-form` grid fix is cosmetic only. |
| data-testid hooks | Pass | `<testId>-open-<id>`, `teacher-schedule-open-<id>`, `teacher-schedule-card-open-<id>`, `notification-link-<id>`, `notification-read-form-<id>` and `app-shell-navigation-<id>` are preserved. The documented replacement `notification-read-checkbox-<id>` is present. |

### Summary

The implementation matches the plan and the requirements. No access rule or page guard changed, and the group admin menu stays within its permitted pages. Only minor, non-blocking points remain: focus after a successful read tick, the dropped post-success task link, and cross-browser and unexecuted specs.
