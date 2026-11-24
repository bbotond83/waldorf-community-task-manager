## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-requirements/performance-requirements.md > NFR9.5 | NFR9.5 says each page needs one call because family names, counts and shares come from the same read. The functional spec defines separate reads: `animal_slots_list` (slot rows) and `animal_fair_share` (the panel), plus `animal_calendar_get` for the settings screen. The sign-up page therefore makes at least two calls, and the pass criterion "a test counts the calls a page makes" cannot be met as written. | Reword NFR9.5 to the real shape, for example "no call per row, and a fixed small number of calls per page (sign-up page: slot list plus fair share)", or decide that the page uses one combined read and change the functional spec. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-requirements/security-requirements.md > NFR3.7 and NFR3.8 | `info_links_for_duty` is described as not executable by any signed-in role, yet the functional spec says the duty card read calls it. The duty card read is an existing function. If it runs with the caller's rights it cannot call a function the caller may not execute, so the requirements do not say how the call works. They also do not say that the existing duty card read must change, while NFR11.2 says existing behaviour is unchanged. | State how the duty card read reaches the link function (the read runs with raised rights and checks the caller's right to the duty first), and add a test that the links never expose a hidden section or a section for a duty the caller cannot see. Record that the duty card read function is replaced by a new migration file. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-requirements/security-requirements.md > NFR3.2 and NFR3.6 | `animal_calendar_get` is a super-admin-only read in the functional spec, but no requirement names it. NFR3.2 covers only saving and creating, and NFR3.6 covers only member reads. Only the general NFR3.1 covers it. | Add `animal_calendar_get` to NFR3.2 (refused for every role except super admin) so a test calls it as every role. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-requirements/observability-requirements.md > NFR4.4 | The audit action check is dropped and re-created in full by each migration that adds an action (the same pattern is in `20261067_checklists_and_templates.sql`). The new migration must repeat every action added up to and including U9 and U11, or those kinds fail to insert. The pass criterion tests one past row of each existing kind, which would catch it only if all existing kinds are in the test. | Say that the new constraint carries the complete current list, and make the test build its list of existing kinds from the live constraint rather than from a hand-written list. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-requirements/security-requirements.md > NFR3.12 and NFR3.13 | The safe-display tests cover scheme, `//host` and `/host` links and script, image and style injection. The formatting syntax the renderer accepts (how bold, lists and links are written in the stored text) is not fixed anywhere in the requirements, so the renderer's inputs are open-ended. Link cases with leading whitespace, control characters or backslashes inside an `https://` link are not listed. | Name the accepted syntax or point to the rule that does, and add a few such link inputs to the test list for the renderer and the saving function. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-requirements/performance-requirements.md > NFR9.1 and NFR9.5 | The read-only teacher page /teacher/allatok (functional design BR81.6) has no stated timing target and no call-count target. NFR9.1 and NFR9.5 name only the sign-up page, the fair-share list, the information page and the settings screen. | Add the teacher page to NFR9.1 (under 2 seconds on the large seed) and NFR9.5 (one read, the slot list, with no sign-up or give-up control calls). | New |
| R-07 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-requirements/reliability-requirements.md > NFR11.2 | The functional design says the teacher schedule (`schedule_get`) leaves out animal-slot tasks (migration 20261069). NFR11.2 lists sign-up, swap, reminder and duty card as the unchanged existing behaviour, but not `schedule_get`. Nothing states that the existing schedule tests pass apart from that exclusion. | Add a line to NFR11.2: `schedule_get` changes only by leaving out tasks whose origin is an animal slot, and the existing schedule tests pass unchanged apart from that. | New |
| R-08 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-requirements/security-requirements.md > NFR3.5 and NFR3.6 | Migration 20261070 makes a coordinator get the same denied answer for a hidden section as for a missing one, and checks the caller before locking the section. NFR3.5 does not say a coordinator cannot update a hidden section. NFR3.6 covers hidden sections for reads only. NFR3.11 covers the teacher page only generically. | Add to NFR3.5 that a coordinator is refused for a hidden section with the same refusal as for a missing one, and that the caller is checked before the section lock. Name the teacher page in NFR3.6 and NFR3.11 (readable by a teacher, with no action controls). | New |
| R-09 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-requirements/scalability-requirements.md > NFR5.5 and NFR5.7 | Two first saves of the calendar at once now give the loser VERSION_CONFLICT instead of a raw unique error (migration 20261070). No concurrency requirement states this. NFR5.5 covers slot creation and start-time change, but not the first save. | Add a pass criterion: two super admins making the first calendar save at once give one calendar and one VERSION_CONFLICT. Add that a stranger's call to `info_section_update` does not wait on the section lock. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round

### Verification

- The seed size (about 400 slots, about 20 families, six sections of a few thousand characters) is consistent across the performance and scalability files. The 2-second targets for pages and commands are measurable (median of 5 warm runs, database tests that time the call). The 5-second and 10-second bulk targets match the bulk work in the code.
- Lock behaviour: NFR5.9 (calendar row, then slot duties by ascending id, then places) matches the lock order in the functional design (BR89.1) and the team's lock-order rule. In `animal_calendar_save` (20261070) the calendar row is locked first and the slot duties are locked in ascending id before the update. The save touches no family row, which the project rule on wrapper locks requires.
- The first-save conflict handling (`on conflict do nothing`, then VERSION_CONFLICT) does not break NFR5.1, NFR5.5, NFR7.5 or NFR4.1. The audit entry and the idempotency store still run in the same transaction.
- `info_section_update` now checks the caller before it takes the section lock. This helps NFR3.5, NFR3.9 and NFR5.7, because a stranger no longer waits. It does not break NFR5.7: the version is still checked after the lock is taken.
- Privacy: NFR1.2, NFR3.8 and NFR10.1 give exact-field assertions, no direct table reads, and no contact details in notices. Text safety is specified fully (a fixed syntax, a fixed link scheme allow-list, rejection of `//host`, `/\host` and control characters), with a database test and a component test for each.
- Nothing in the NFR files contradicts the functional design. The four gaps above are omissions of the teacher page and the migration 20261070 and 20261069 behaviour, not contradictions.
- I did not re-run the tests, as instructed.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Stage validation tools | Not listed in the dispatch, and none run | No structural facts to add. The review rests on reading the NFR files, the functional design rules and migration 20261070. |

### Summary

The NFR requirements are measurable and achievable and do not contradict the functional design, and the first-save conflict and caller-before-lock changes in migration 20261070 break no stated target. A developer could build from them. READY, with four Minor omissions: the read-only teacher page, the `schedule_get` exclusion, the hidden-section refusal for coordinators and the first-save race are not named in the requirements.
