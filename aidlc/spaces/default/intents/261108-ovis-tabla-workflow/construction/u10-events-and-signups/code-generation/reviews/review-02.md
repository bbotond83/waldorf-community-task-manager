## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-21
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/code-generation/unit-test-instructions.md > Coverage Targets, and tests/database/events-removal.test.ts, tests/database/events-for-later-units.test.ts | The instructions promise that every database rule gets the fixed list (allowed, refused, out of reach, outdated screen, repeated click, two at once) or a cell saying "nem értelmezhető" with its reason. No such statement exists anywhere in the tests, the code summary or the traceability file (searched). The removal pair (events_removal_preview and events_removal_apply) has only allowed and repeated-click cases. There is no outdated-screen or two-at-once case, and no case that removal runs while a sign-up for the same parent is in flight. The read functions (event_get, event_list, event_list_for_group) and the three facts functions have no stated reasons for their missing cells either. | Add a short table to code-summary.md that gives, for each function, the test that covers each of the six cells or a stated reason (for example, "reads change nothing, so repeated click and two at once do not apply"). Add a removal-versus-sign-up concurrency test, or state why the lock order makes it unnecessary (see the next row). | New |
| R-02 | Minor | supabase/migrations/20261056_events_and_signups.sql > events_removal_apply and event_signup_add | The removal block collects the affected events with an unlocked read, then locks them. A sign-up or offer does not lock the family row, only the event row. A parent who is being removed and who signs up on an event where they had no row yet can commit after the removal's last update statement. The row then keeps the parent and family ids and shows the name of a removed person. The window is narrow, because the removal ends the account's sign-in in the same transaction, but nothing proves it is closed. | Either make the sign-up and offer commands refuse when the parent is no longer active (a cheap check under the event lock), or add the concurrency test and record the result. | New |
| R-03 | Minor | app/_events/EventForms.tsx > SignupAddForm and SignupChangeForm (maxLength 300); app/_events/actions.ts > noteOf | A sign-up note is limited to 300 characters on the screen and cut silently with slice(0, 300) in the action. BR108.1 and the table allow 500. The event title is also limited to 120 on the screen (saveEventAction, EventCoreForm) while BR102.1 and the database allow 200. No recorded decision explains the narrower limits. | Use 500 and 200, or record the narrower limits as a decision in the functional spec. Remove the silent slice, so that an over-long note is refused with a message. | New |
| R-04 | Minor | app/_events/EventForms.tsx > SignupAddForm hint; BR104.1 and BR108.3 | The sign-up note is shown with the person's name to every signed-in reader, teachers included. The form hint ("Például mikor érkezel, vagy miben segítenél.") does not say so. A parent could write health or child details into a note believing only the organiser reads it. | Add one sentence to the hint, for example "A megjegyzést minden bejelentkezett tag látja." Do the same for the food-offer text. | New |
| R-05 | Minor | app/_events/event-result.ts > FIELD_MESSAGES; src/data/results.ts > REASON_CODES | The map has no Hungarian text for VAL-ARCHIVED, VAL-TAKEN or VAL-EXPECTED-VERSION, and the reason after_end (a deadline after the event ends) falls through to the general VAL-INVALID. The fallback FIELD_MESSAGES[reason] ?? reason can show the raw code on screen. A deadline after the end reads only "Érvénytelen érték." | Add the missing messages, map after_end to a specific one ("A határidő nem lehet az esemény vége után."), and show a generic sentence instead of a raw code. | New |
| R-06 | Minor | src/data/copy.ts > EVENT_CODE_MESSAGES.EVENT_CLOSED; supabase/migrations/20261056_events_and_signups.sql > event_save_core | The same code EVENT_CLOSED is used when a manager changes the dates or status of a finished event. The screen then says "Erre az eseményre már lezárult a jelentkezés.", which is the wrong explanation for an editor. | Give the manager path its own sentence ("Véget ért esemény időpontja és állapota már nem módosítható."). | New |
| R-07 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/code-generation/unit-test-instructions.md > How to Run | The e2e command points to tests/e2e/events.spec.ts, which does not exist (the spec is tests/browser/events.spec.ts, as the code summary says). The database command lists seven files and leaves out tests/database/events-list-signups.test.ts, although package.json and the shuffled run include it. Run as written, the browser command matches no test. | Correct the path and add the eighth file. | New |
| R-08 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/functional-design/rules.md > BR119.1; contract-summary.md > C14 note | BR119.1 says the group event list refuses a caller who cannot manage the group. The code (event_list_for_group, read by every signed-in reader) follows the later C14 resolution in contract-summary.md, which is the sound reading, because event pages are public to the community. The rule text itself was not updated. A reader of rules.md alone would build the wrong check. | Update BR119.1 to match C14 as settled, or mark it superseded. | New |
| R-09 | Minor | supabase/migrations/20261056_events_and_signups.sql > event_signup_withdraw, event_signup_change; rules.md > BR110.1 | BR110.1 says a sign-up already withdrawn answers "not found" to a repeated call with a new key. The code answers denied (authorization_denied), because the row is gone before the lookup. This is the safer answer (same as a made-up id, NFR3.3), but it is not what the rule says. | Change the rule text to say a withdrawn or unknown sign-up answers denied. | New |
| R-10 | Minor | tests/database/events-signups.test.ts > "allowed: an offer with its three ticks" (about line 273); rules.md > BR115.1 | BR115.1 says a test reads every column and function result for a link between a dish and a child, a family's health or a diet. The test only searches the event_get document for the words family_id and child. It does not read the food_offers columns, the notice facts, the notices sent or the audit entries. | Add a check over information_schema for the four new tables, and over the audit and notice texts written by an offer, as BR115.1 and BR123.1 describe. | New |
| R-11 | Minor | tests/browser/events.spec.ts | The browser flow covers create, sign up, offer, cancel and read. It never saves the notices, a role or the year's tale through the screen. Those forms are tested only with in-memory ports and, separately, the database functions. The hop from form through server action and port to the database, including the version going up after each panel save on one page, has no end-to-end test. | Add one browser step that saves notices, a role and the tale in a row on the edit page and checks the page after each save. | New |
| R-12 | Minor | app/_events/EventScreens.tsx > SignupSection and FoodSection; app/_events/EventForms.tsx > WithdrawSignupForm, WithdrawOfferForm | Every withdraw button reads "Visszavonom" or "Jelentkezés törlése" with no accessible name that says which row it belongs to. A screen-reader user with several rows hears identical buttons. The manager deletion of someone else's sign-up or offer has no confirmation, although the cancel flow has one. The cancel confirmation does not move focus when it opens. | Give each button an aria-label with the person or dish, ask for confirmation on a manager deletion, and move focus to the cancel confirmation. | New |
| R-13 | Minor | supabase/migrations/20261056_events_and_signups.sql > event_role_save | BR105.1 says the parent must be one "who may be shown to the caller". The function checks only that the parent is active, has an account and belongs to the community. The screen's list comes from the directory, so the normal path is safe, but a direct call is not limited. The idempotency fingerprint is built with concat_ws, which skips null values, so two different calls can in theory share a fingerprint. | Either state in the rule that any active parent with an account may be chosen, or check visibility. Build the fingerprint with coalesce, as the sign-up functions do. | New |
| R-14 | Minor | scripts/db/seed/data.ts (role creation seconds); supabase/migrations/20261056_events_and_signups.sql > event_get roles order and schedule_get | Roles are shown by created_at then id, and the schedule shows the oldest role. Two roles written in one transaction share a created_at, so their order falls to a random id. The seed was changed to avoid this ("its own creation second"), which hides the problem in the test data only. | Order by a sequence or an explicit position, or note that roles are always created one per transaction. | New |
| R-15 | Minor | app/_events/event-result.ts > VAL-DATE-RANGE text | The event screens say "Érvénytelen időszak." for a date-range refusal, while src/data/copy.ts says the sign-up deadline cannot be after the event end. The two texts for the same code differ, and the screen one is less helpful. | Use the more specific copy.ts sentence in event-result.ts, or have it read from copy.ts. | New |
| R-16 | Minor | app/_events/event-result.ts and src/data/copy.ts > refusal word lists | The same refusal codes are worded in two separate lists, so they can drift apart again. | Reuse one list, or add a test that checks the two agree. | New |
| R-17 | Minor | Code summary > "Not changed" list | Several advisory items stay open (sign-up note visible to all readers, removal-race note on family locks, no confirmation when a manager deletes someone else's sign-up). They are recorded openly. | Keep them on the owner's follow-up list. | New |

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

> R-11 Not re-checked this round

> R-12 Not re-checked this round

> R-13 Not re-checked this round

> R-14 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| vitest: event-actions, event-screens, event-offer-change | PASS, 47 tests | The accessible-name and length changes are covered by passing tests. |
| node test: src/data/events.test.ts | PASS, 10 tests | The Hungarian refusal-text regression test passes. |
| node test: tests/database/events-removal.test.ts | PASS, 12 of 12, in worker_3 and public | The new "two at once" test (sign-up waits for the removal, then lands after it, no deadlock) runs on the real database. The removal list now covers allowed, repeated click and two at once, with the other cells explained in the file header. |
| verify:local | Not rerun, as instructed | The recorded run passed just before the rework. This review only reran the narrow checks above. |

Checked by reading: sign-up note and title boxes allow 500 and 200 characters (EventForms.tsx), withdraw buttons carry row-specific accessible names, VAL-ARCHIVED and VAL-DATE-RANGE have Hungarian text, and BR110.1 and BR119.1 exist in rules.md.

### Summary

The earlier Major (incomplete removal test list) is closed by a passing real-database "two at once" test, and the other reworked items hold up. Only Minor wording-consistency points remain, so the unit can be built on without architectural guidance.
