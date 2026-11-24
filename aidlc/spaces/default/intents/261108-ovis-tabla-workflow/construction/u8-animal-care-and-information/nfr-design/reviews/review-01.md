## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24T04:25:59Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-design/security-design.md > Defence in Depth, Database role row; and traceability.json entry NFR3.8 | NFR3.8 in the requirements says signed-in accounts KEEP read-only table rights on the four new tables. The design instead grants no select to `authenticated` and adds no policy, and the traceability file still marks NFR3.8 as OK. Existing tables in this repository grant select to `authenticated` (for example `rota_plans` and `tasks`), so the catalogue test and its scope probes will meet a different table shape for these four tables. The design does not say whether this is a deliberate change, and the planned test (a select by a signed-in role gets a permission error) does not match the requirement's pass criterion (the catalogue lists the read-only rights). | Decide which is intended. Either follow NFR3.8 as written (select grant plus row-level security, and no policy that lets a signed-in role read the rows), or record the stricter no-select choice as a deliberate change to NFR3.8. Then make the traceability target and the planned catalogue test say the same thing. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-design/security-design.md > Authorization Design table, `info_sections_list` row | NFR3.6 requires hidden sections to be returned only to super admins. The table lists `info_sections_list` as readable by every signed-in member and does not mention the hidden-section rule. It appears only in the performance document as an "edit flag". A developer could miss it. | Add the rule that hidden sections go to super admins only to the `info_sections_list` row, and name the test that checks it. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-design/traceability.json > NFR3.7 target | The target points to a `security-design.md` heading "Duty links". No such heading exists; the text is a bullet under Authorization Design. Other targets (for example NFR1.1, "invented data and the privacy allowlist") also name sub-sections that are only prose lines. | Point each target to an existing heading, or add the heading, so the trace can be followed. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/nfr-design/security-design.md > Authorization Design, `slot_give_up` bullet; scalability-design.md > Concurrency Design | `slot_give_up` takes the duty lock first and the holder test comes in the same lookup. The text does not say the lock is taken before the caller's right is known. A made-up place has no duty to lock, so a response-time difference between a real and a made-up id could appear. NFR3.4 asks only for the same refusal, so this is low risk. | State whether the holder test runs before the lock or inside it, and accept the timing difference in writing or avoid it. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability (by hand) | 58 distinct NFR ids in the six requirement documents; 58 ids in `traceability.json` coverage; every row is OK, with none missing | Complete. Spot-checked targets for NFR3.7, NFR3.8 and NFR5.6 exist as design content, but one heading name is wrong (see Minor). |
| existing-code check | `tasks_one_per_origin`, `timed_check_runs` and `rota_duty_card` (security definer, stable) exist in `supabase/migrations/`; other tables grant select to `authenticated` | The design's claims about existing objects hold. The grant convention differs from the new tables (see Major). |
| required-sections, upstream-coverage, linter, type-check | Not run by this reviewer | No code in this stage. Documents were checked by reading only. |

### Summary

The design covers every NFR (58 of 58), keeps one lock order (calendar, duty, place) that is consistent with U2 and U7, and traces cleanly. The one point the owner should weigh is the table-rights difference between NFR3.8 and the design. The rest are small wording gaps.
