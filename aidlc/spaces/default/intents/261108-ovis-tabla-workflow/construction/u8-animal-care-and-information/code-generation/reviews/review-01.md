## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | supabase/migrations/20261069_schedule_leaves_out_animal_slots.sql > schedule_get (`t.origin_kind <> 'animal_slot'`) | The filter is technically sound: the body is the latest definition from 20261056 with one added condition, the signature is unchanged so the existing grants carry over, and a regression test covers it. But it takes the daily slots away from the teacher schedule completely, and a teacher then has no screen that shows who looks after the animals on a given day. `animal_slots_list` is open to teachers by design (rules.md), yet the teacher menu has no Állatgondozás entry and `/szulo/allatok` is not offered to them, so teachers lose a view they did not lose in the design. The stated reason (440 slots burying 8 entries) overstates the problem, because `schedule_get` already limits a request to a 31-day window, which is about 44 slots. | Keep the decision for the owner as recorded in code-summary.md, and state in that note that teachers now see no animal-care holder anywhere. Alternatively, offer teachers a read-only view of `/szulo/allatok`, or list only the next few days' slots in the schedule. | New |
| R-02 | Minor | supabase/migrations/20261068_animal_care_and_information.sql > animal_calendar_save, first-save branch (`insert into animal_calendars`) | When the year has no calendar, two super admins saving at once both see "not found" and both insert. The loser hits the unique constraint on `school_year_id`, which is not a U3R00 refusal, so it escapes as a raw database error instead of a VERSION_CONFLICT result. `animal_slots_create` avoids this with `on conflict do nothing`, but the save does not. The fixed list is also incomplete for this function: no test covers a repeated click or two people at once for the save, or for `info_section_set_hidden`. | Use `on conflict (school_year_id) do nothing` and answer a lost insert with VERSION_CONFLICT. Add the repeated-click and two-at-once tests for `animal_calendar_save` (and the two-at-once test for `info_section_set_hidden`) to the existing database test files. | New |
| R-03 | Minor | supabase/migrations/20261068_animal_care_and_information.sql > info_section_update (`for update` before the authorization test) and info_caller_coordinates | The section row is locked before the caller is checked, so any signed-in member can briefly take the lock by passing a section id, which every reader of the list receives. The lock lasts only for the call and nothing is changed, so this is only a nuisance. Also, a coordinator is allowed by id to edit a hidden section that they cannot see in their list. | Check the caller (super admin or coordinator of the owning group) with an unlocked read first and lock only after it passes, as `slot_give_up` does. Either refuse coordinator edits of hidden sections or record that allowing them is intended. | New |
| R-04 | Minor | supabase/migrations/20261069_schedule_leaves_out_animal_slots.sql and 20261068 (`duty_rota_managed`, `rota_duty_card`) | Three existing functions are replaced with `create or replace` and no `revoke all` or `grant execute` is restated. The existing grants do carry over for an identical signature, so nothing is exposed today. However the migration then does not show the rights it relies on, which the team template asks for in a new function. | Add one comment line per replaced function saying that the rights of the earlier definition carry over, or restate them. | New |

### Verification

**Lock order and race safety.** `animal_calendar_save` locks the calendar row, then the slot duties in ascending id order, and never locks a family row or assignment before reading them. `slot_give_up` reads the caller's own place unlocked and answers "not yours" and "does not exist" alike. It then calls `place_lock` (20261048), which locks the task rows ascending and then the assignment rows ascending, and re-checks the owner after the lock. No function locks a family row or takes a lock only to look at standing. The give-up and the calendar save take locks in compatible order, so I found no deadlock cycle. The race tests cover three families taking one slot, two give-ups of one place, and a give-up meeting a sign-up of another family.

**Fixed test list.** The give-up has all six: allowed, refused (within 24 hours, started, in a swap), out of reach (another family, outsider, super admin, group admin, teacher), outdated screen, repeated click, and two at once. The calendar and information functions are missing only the gaps named in the second finding. The nine database test files are in both their `test:database:*` script and `scripts/db/shuffled-tests.ts`.

**Denied-not-empty and grants.** Every read function returns `denied` for no session, no community right, or a school year outside the caller's community, never an empty list. The four new tables have row-level security on and no right for any application role, with a table-rights test. All 24 new functions are listed in one `revoke all`, only the ten caller-checked ones are granted to `authenticated`, and the starting-section install is granted to the service role only.

**24-hour and open-swap rules.** The same conditions appear in `slot_give_up` and in the `can_give_up` flag of the list. The give-up refuses at 24 hours or less, after the start, and for `swap_pending`, `cancellation_pending` or an open change request. Sign-up still goes through `duty_sign_up`, which applies the changeover rule on the slot's date, and the `duty_rota_managed` change lets families but not administrators take a slot.

**Text safety.** `info_text_valid` and `section-text.ts` use the same rule: only an `http(s)://` address or an in-app path that does not start with `//` or `\` becomes a link, and anything else is shown as plain text. The renderer builds elements and nothing in `app/` or `src/` uses `dangerouslySetInnerHTML`. External links carry `rel="noopener noreferrer"`. A coordinator's save is refused as `denied` if title, owner, season or order differ from the stored values.

**Traceability and privacy.** Every `target` in traceability.json exists. I found no phone number, email address or personal name in the migration, the new screens or the new tests. The only matches were test UUIDs, and the starting text names no person.

**Seed and migration shape.** Slots are created with generated ids in a CTE referenced twice, which PostgreSQL evaluates once, so the duty and slot ids agree. The starting-section install is repeatable.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `npx vitest run` on the seven listed test files | 2 files ran (animal-care-actions 13 tests, animal-care-screens 12 tests), 25 passed, 0 failed. The other five files did not match this runner's project filter. | The two screen and action files pass. The facade, section-text and data-adapter files are in a different project; their pass is taken from code-summary.md (Vitest 82 files, 1258 tests) and the full `verify:local` pass, which I did not repeat. |
| Traceability target existence check | All 9 distinct targets exist | No broken reference |
| Database tests (`tests/database/animal-*`, `info-*`) | Not run by me; the full `verify:local` pass is reported in code-summary.md | The test list and registration were checked by reading, not by running. |

### Summary

The design is implementable and safe as built: lock order follows the fixed order, every command refuses with a result instead of returning empty data, rights are explicit, and the information text can never become HTML. The open points are four minor ones, mainly the first-save race and missing tests in the calendar save, and the owner's call on the teacher schedule decision. Nothing blocks the unit.
