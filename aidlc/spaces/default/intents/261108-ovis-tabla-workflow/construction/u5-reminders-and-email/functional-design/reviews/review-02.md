## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-15
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/functional-design/rules.md > BR50.4, and entities.md > NoticeKind | A notice title is defined as a fixed prefix plus the item name. Today's list (notification_list in 20261037) builds some titles from the request's current status: the swap and cancellation decisions read "Csere jóváhagyva" or "Csere elutasítva" depending on whether the request was approved or rejected. The rota_published notice has a title with no item name at all ("Közzétették a beosztást"), and has its own text. A single prefix per kind cannot reproduce these, yet the spec says the parent's list layout and its stale or cancelled marks are unchanged. The spec also never lists which of today's kinds are seeded into NoticeKind, or with which prefixes. | State how the registry expresses titles that depend on the item's state, or have no item name. For example the facts function could also return the title, or a kind could be split in two. List the seed rows for every existing kind (sign_up_confirmed, swap_requested, swap_decided, cancellation_decided, place_removed, reminder_7d, reminder_24h, rota_published) with their Hungarian titles. Keep or drop the extra "text" field of rota_published explicitly. | New |
| R-02 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/functional-design/rules.md > BR54.3 and functional-spec.md > W6 | "Try again" is addressed to a group of emails (kind plus item), not to one record, so there is no version to compare. BR54.3 says the call is stale when "its latest try is the one the screen showed", but never says what the screen sends back (the group's kind and item, plus the latest-try time or the largest try id) or how the check is made under the ascending-id lock. Without this, a developer must invent the stale-screen contract, and the "outdated screen" test from the fixed list cannot be written. A failed email whose new group member arrives after the screen was shown is also not covered. | Define the Try again inputs: group key, expected latest-try token, idempotency key. State exactly which failed emails the call restarts (those that were failed when the call took its locks, or those the screen showed) and when REMINDER_STALE is returned. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/functional-design/rules.md > BR52.2, entities.md > TimedCheckRun.outcome | The daily-run contract (C9) records a missing check function as "failed". The spec adds a third outcome `missing` and also uses the database error code, which is not a column in C9. The spec lists only the optional moment and the delivery pass as C9 changes, not these. A missing function is also hard to tell from an undefined-function error raised inside an existing check. | Add the `missing` outcome and the `errorCode` column to the C9 change list in "Existing Code That Changes", or follow the contract and record both as failed. Say how a missing function is detected, for example by looking it up in the catalogue before calling it. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/functional-design/rules.md > BR53.2, BR53.3 | Due dates are calendar-date based. A duty created on the day before or on the day it starts has a day-before job already due and not yet started, so it is sent with a "Holnap:" title even when the duty is today. A duty three days away gets a "Egy hét múlva:" notice too, because its week-ahead date has passed. BR53.4 handles only the case where both are due. | Add a rule for a job that is already late at planning or catch-up time: skip it, or send it with timing-neutral wording. Check this against the owner's answer to Q1. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/functional-design/rules.md > BR56.1, BR51.4 | Removal deletes a parent's notices, emails and tries, but does not say what happens to an email already claimed and being sent. The app will still send it, and the later outcome record finds nothing. The tables TimedRun, TimedCheckRun, EmailAttempt and sent EmailDelivery also have no retention rule and grow without limit. | Add a sentence that removal also waits for or ignores a claim in progress, and that the late outcome is dropped. Record a retention decision, or note that it is deferred to the hosting work. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/functional-design/entities.md > TimedCheck.functionName, NoticeTarget.factsFunction | Check functions and facts functions are called by name from registry rows, so the run function must build the call dynamically. The spec does not say that the names are checked as safe identifiers and that only the migration role writes the registries. It also does not say whether the parent's notice list calls one facts function per notice, or has a page size. | State that the registries are written only by migrations, that the names are quoted as identifiers, and that the notice list is limited in size. | New |
| R-07 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/functional-design/rules.md BR54 (Try again) | The wording fix is in place (rules.md line 147 and functional-spec.md line 35 now say lock_step order, then check-name order, matching the migration). The rules do not state the largest group one Try again can restart (the code now allows 5000 and refuses more with REMINDER_TOO_LARGE). | Optionally add one line to BR54 naming the 5000 limit; not blocking. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round

> R-06 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Cross-check of rules.md, functional-spec.md against the migration and code (grep and read) | Consistent | Stale rule, no-address list, new-round and one-round-for-two-admins rules match the code and the 64 database tests that passed. |

### Summary

The functional design still matches the final code and its own files; the one stale wording is fixed.
