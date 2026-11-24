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
| R-05 | Major | verification/authorization-matrix.json > AUTH-ANIMAL-READ-SUPER-ADMIN-ALLOW, AUTH-ANIMAL-SLOT-SUPER-ADMIN-ALLOW, AUTH-ANIMAL-MANAGE-SUPER-ADMIN-ALLOW | The three super admin animal-care rows name the route `/admin/allatok/**`, but the built page and the super admin menu entry (`admin-animal-care` in src/runtime/navigation.ts) use `/admin/allatgondozas`, and tests/unit/navigation-access.test.ts maps that route to `animal_calendar`. No `/admin/allatok` page exists. The matrix therefore describes a route that does not exist and says nothing about the real one. | Change the super admin rows to `/admin/allatgondozas/**` (and decide whether the super admin's own sign-up view at `/szulo/allatok` needs a row), so the matrix, role-policy and navigation agree. | New |
| R-06 | Minor | tests/database/animal-sign-up-give-up.test.ts, tests/database/animal-slot-races.test.ts (animal_slots_list reads) | The new read-only teacher page /teacher/allatok depends on `animal_slots_list` letting a teacher read, but no database test calls the list as the teacher (only the fair share read is checked for a teacher). The browser test covers it later, not at the rule level. | Add an "allowed" case where the teacher reads `animal_slots_list` and sees no sign-up or give-up flag set for them. | New |
| R-07 | Minor | code-generation/code-generation-plan.md > Steps 1 to 19 | Every step is still unticked while code-summary.md says steps 1 to 17 are done, and steps 18 and 19 are also built. | Tick the finished steps; leave Step 20 open until the browser verification and owner approval. | New |
| R-08 | Minor | repository root > `.verification-checkpoint-u8.out`, `.verification-u8-round2.out` | Two untracked verification output files sit at the repository root and are not ignored, so a broad `git add` would commit them. | Delete them or add them to the ignore list before the unit is committed. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

### Verification

- **Migration 20261070, calendar first save:** the first-save path locks the calendar row, inserts with `on conflict do nothing`, and a null returned row becomes `VERSION_CONFLICT`. The loser of two first saves at once therefore gets a conflict, not a raw unique error. The eight-run race test in animal-calendar-slots.test.ts checks exactly one success and one `VERSION_CONFLICT`, and that one calendar exists. Repeated click is covered through the idempotency check.
- **Migration 20261070, section update:** the caller is checked on an unlocked read first (missing, hidden-for-coordinator and not-coordinator all answer `authorization_denied`), then the row is locked and hidden is re-checked under the lock, so a coordinator cannot reach a hidden section. A coordinator also cannot change title, owner, months or order. info-sections.test.ts has the hidden-section case, by id too.
- **Teacher page:** app/teacher/allatok/page.tsx passes `readOnly` and the screen renders no sign-up or give-up control in that mode. The teacher's access rows, the navigation entry and the browser test agree on the route.
- **Lock order:** `animal_calendar_save` locks the calendar, then slot duties ascending, and touches no places. `slot_give_up` uses `place_lock`, which locks duties then places, both ascending. There is no cycle between the two.
- **Rights:** both migrations' functions start with `revoke all` and then an explicit `grant execute` to `authenticated` (helpers and checks to nobody signed in, the install to `service_role`). 20261069 only replaces `schedule_get`, which keeps its existing grants.
- **Summary against code:** the summary's account of 20261069, 20261070, the teacher page, the test changes and the checklist-race adjustment matches the files. Differences are limited to the findings above.
- **Fixed test list:** allowed, refused, out of reach, outdated screen, repeated click and two at once are present for the calendar, slots, give-up, checks and sections. The teacher read of the slot list is the one gap (Minor above).
- **Data and release:** no real names or contacts found in the reviewed files. Nothing is committed or deployed; the new code is untracked or modified in the working tree.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Tests (type check, fast tests, database tests) | Not re-run, as instructed; reported passing | Taken from the brief and code-summary.md |
| Full browser verification | Not yet run | Planned after this review (Step 20) |

### Summary

The owner-review changes are sound: the first-save race now resolves to a version conflict, the section update checks the caller before locking and keeps a coordinator out of hidden sections, the teacher page is read-only, and lock order and rights follow the rules. The one real inconsistency is the authorization matrix naming a super admin route that does not exist; fix it along with the small test and housekeeping items.
