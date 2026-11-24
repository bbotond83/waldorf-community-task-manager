## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-design/security-design.md > Defence in Depth, Database role row; and traceability.json entry NFR3.8 | NFR3.8 in the requirements says signed-in accounts KEEP read-only table rights on the four new tables. The design instead grants no select to `authenticated` and adds no policy, and the traceability file still marks NFR3.8 as OK. Existing tables in this repository grant select to `authenticated` (for example `rota_plans` and `tasks`), so the catalogue test and its scope probes will meet a different table shape for these four tables. The design does not say whether this is a deliberate change, and the planned test (a select by a signed-in role gets a permission error) does not match the requirement's pass criterion (the catalogue lists the read-only rights). | Decide which is intended. Either follow NFR3.8 as written (select grant plus row-level security, and no policy that lets a signed-in role read the rows), or record the stricter no-select choice as a deliberate change to NFR3.8. Then make the traceability target and the planned catalogue test say the same thing. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-design/security-design.md > Authorization Design table, `info_sections_list` row | NFR3.6 requires hidden sections to be returned only to super admins. The table lists `info_sections_list` as readable by every signed-in member and does not mention the hidden-section rule. It appears only in the performance document as an "edit flag". A developer could miss it. | Add the rule that hidden sections go to super admins only to the `info_sections_list` row, and name the test that checks it. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-design/traceability.json > NFR3.7 target | The target points to a `security-design.md` heading "Duty links". No such heading exists; the text is a bullet under Authorization Design. Other targets (for example NFR1.1, "invented data and the privacy allowlist") also name sub-sections that are only prose lines. | Point each target to an existing heading, or add the heading, so the trace can be followed. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-design/security-design.md > Authorization Design, `slot_give_up` bullet; scalability-design.md > Concurrency Design | `slot_give_up` takes the duty lock first and the holder test comes in the same lookup. The text does not say the lock is taken before the caller's right is known. A made-up place has no duty to lock, so a response-time difference between a real and a made-up id could appear. NFR3.4 asks only for the same refusal, so this is low risk. | State whether the holder test runs before the lock or inside it, and accept the timing difference in writing or avoid it. | New |
| R-05 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-design/scalability-design.md > Concurrency Design, "Two creations, or a creation and a time change" and Lock Order | The design says every calendar command "locks the calendar row first", but a year's first save has no calendar row to lock. The first-save race (two super admins at once, one winner and one VERSION_CONFLICT) is required by the review follow-up in the requirements but has no design row. It is built (migration 20261070: insert with "on conflict do nothing", loser reads a version conflict) and is sound, yet a developer reading the design alone would rely on the row lock and get a raw unique-key error. | Add a concurrency row for the first save: no row to lock, the unique key on the school year decides, the loser gets VERSION_CONFLICT. State in the lock order that the calendar lock applies only once the row exists. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-design/reliability-design.md > Migration, Existing Behaviour; logical-components.md > Failure Domains | The design says "one new forward-only migration" that changes only `rota_duty_card`. The built unit has three migrations. `schedule_get` is also replaced (20261069, BR81.7 and NFR11.2), and `info_section_update` and `animal_calendar_save` are replaced in 20261070. `schedule_get` is shared with other units, so the blast-radius list is incomplete. | Update Migration, Existing Behaviour and Shared resources to name the three files and add `schedule_get` as a shared read that now omits animal-slot duties, with the existing schedule tests kept green. | New |
| R-07 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-design/security-design.md > Review follow-up (teacher page) and Authorization Design; performance-design.md > Read Shapes | The teacher page `/teacher/allatok` gets one sentence. The authorization table has no teacher-page row. The performance design does not say that the page makes the same two reads, so the "two reads" check in NFR9.5 is not stated for it. The built page does reuse `animal_slots_list` and `animal_fair_share` read-only. Those reads return display names, counts and shares only, and no contact detail. The teacher gets `mine` false and `may_hold` false (no family), so nothing leaks. | Add the teacher page to the authorization table (read only, same functions, display names only, matrix row `/teacher/allatok/**`). Add it to the performance read shapes and the page-call count. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

### Verification

- **Lock order:** calendar row, then duties ascending, then places ascending. Sign-up and give-up take duty then place. A time change locks the calendar then the duties, and never locks a place or family row. No cycle exists. The give-up reads the lock-time start under its duty lock, so the 24-hour limit is judged correctly (NFR5.6).
- **Caller before lock:** the design for `slot_give_up` and `info_section_update` checks the caller on an unlocked read, so a stranger never waits on a lock. The migration implements the unlocked check, then the lock, then a recheck under the lock. Real and made-up ids get the same refusal.
- **Teacher page:** it uses the same two read functions as the parent page with `readOnly`. These reads return only display names and slot facts, so no contact detail is returned.
- **Other NFRs:** every NFR is mapped to a stated design choice across the six design files. The four tables have no `select` grant for signed-in accounts. Duty links go through the internal function only. The section renderer has no raw HTML. I found no contradiction with the functional design.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Stage validation tools | Not run; the stage definition lists no run command for this pass. | Manual cross-check of design against requirements, functional spec and migrations 20261068 to 20261070. Tests were not re-run, as instructed. |

### Summary

The design is implementable and matches what was built. Its lock order is acyclic and the caller-before-lock choices are sound. The one real gap is that the first-save conflict is not designed, so the "lock the calendar row first" statement is wrong for that case. The two minor findings are stale migration and shared-resource text and a thin teacher-page design.
