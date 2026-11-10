## Review

**Verdict:** READY
**Reviewer:** aidlc-product-lead-agent
**Date:** 2026-11-08T11:06:39Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/inception/user-stories/stories.md > US4.2 (AC4.2.3), US6.1 (AC6.1.3), US6.2 (AC6.2.2) | Three stories rely on "the administrator reassigns" a duty (a flagged duty, a missing picking family, a missed weekend pick), but no story or criterion describes that action. Nothing says who may do it, which rules it must obey (changeover date, no indoor cleaning plus front garden in one week), what happens to a weekend pick that was already made, who is notified, or that it is audited. The only edit story (US5.2) covers unpublished drafts. | Add a story, or criteria under US5.2, for the administrator changing a published duty. State the allowed and refused cases, the rules it must still obey, the effect on a linked weekend pick, the notice to the families, and the audit entry. | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/inception/user-stories/stories.md > US8.2 (AC8.2.1 to AC8.2.4) | The swap has only the happy path (propose, accept, applied) and a refusal for rule breaks. These are silent: the other family declines or never answers; the proposer withdraws; a duty in a pending swap is offered in a second swap, or is picked, reassigned or removed meanwhile; a duty becomes past before acceptance; the reversal of a swap that was followed by another swap. QA could not write tests for these, and the "two people at once" test has no subject here. | Add criteria for decline, withdraw and expiry. State what happens when a duty in a pending swap changes. State whether a duty can be in two pending swaps. State what reversing a swap does when later swaps depend on it. | Resolved (reviewer) |
| R-03 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/inception/user-stories/stories.md > US3.6 (AC3.6.1 to AC3.6.3); traceability.json > NFR11 (Deferred to functional-design) | The story title says "add and remove families and parents", but the criteria cover adding a family and removing a family's duties. There is no criterion for removing a single parent. There is none for what happens to the removed people's personal data and sharing choice, to their claims, picks and sign-ups, or to history staying readable (NFR11). NFR11 is deferred without any story, so a privacy requirement has no pass/fail criterion. The project rule asks for privacy and audit outcomes in each story. | Add criteria for removing a parent and for removing or anonymising a leaving family. Cover the personal data, the claims and history that stay readable, the duties that are flagged, and the audit entry. Or make NFR11 a story of its own with Given/When/Then criteria. | Resolved (reviewer) |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/inception/user-stories/stories.md > US2.1 (AC2.1.4) and US2.3 | Leaving a working group says nothing about a coordinator who leaves. Does the coordinator right stay or end? Can a group be left with no coordinator? This is the same corner as AC2.3.4, where a revoked right applies at the next request. | Add a criterion: leaving a group ends that group's admin right at once, and say what the group shows when it has no coordinator. | Resolved (reviewer) |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/inception/user-stories/stories.md > US17.1 (AC17.1.2), US3.7 (AC3.7.1 and AC3.7.2) | "Retried up to the limit" names no limit, and the invitation link has no expiry. Neither can be turned into a pass/fail test. | Give the retry limit and spacing as numbers. State whether an invitation link expires and after how long, or state that it never does. | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/inception/user-stories/stories.md > US3.1 (AC3.1.4), US3.5 (AC3.5.1) | AC3.1.4 covers only a family where parents differ. A single-parent family, a family with no children and a family with no parent with an account are not covered. AC3.5.1 cites "Q9", which is in the requirements Q&A and not in this stage's Q1 to Q8, so a reader of the stories cannot find it. | Add one criterion for the single-parent and no-children cases. Name the source of Q9 in full (the requirements questions file). | Resolved (reviewer) |
| R-07 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/inception/user-stories/stories.md > US13.1 (AC13.1.2), US10.1 (AC10.1.1) | FR13.2 says a notice goes "a chosen time before an event", two weeks by default for a big cleaning. AC13.1.2 covers only the big-cleaning default. AC10.1.1 says "starting with the animal-care, feeding and big-cleaning background content" without a checkable list of sections. | Add a criterion for a chosen lead time other than the default. List the information page's starting sections by name so QA can check them. | Resolved (reviewer) |
| R-08 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/inception/user-stories/stories.md > US3.6 (AC3.6.4) | AC3.6.4 covers removing one of several parents. It does not say what happens when the removed parent is the family's only parent or its only account holder, or when the removed parent is a working-group coordinator. | State the outcome in Functional Design or add a criterion. For the only-parent case, say whether this is a family removal under AC3.6.2. For a coordinator, say that the admin right ends at once with an audit entry, as in AC2.1.5. | New |
| R-09 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/inception/user-stories/stories.md > US6.2 and US7.3 (AC6.2.1, AC6.2.2, AC7.3.1) | The timed triggers ("Wednesday before the weekend", "Friday noon", "next three days") name no time zone and no run hour. QA could not write a deterministic time-based test from them. | Fix the school's local time zone, and the hour at which the daily and weekly checks run, before Functional Design. | New |

> R-01 Reviewer note: US5.4 now covers reassigning a published duty or unpicked weekend slot: who may do it, rule refusals, the weekend pick moving, past duties, a pending swap, notices to both families and the audit log.

> R-02 Reviewer note: AC8.2.5 to AC8.2.10 add decline, withdraw, expiry, at most one pending swap, concurrent change, and a refused reversal when the duties have since changed. AC5.4.6 covers a reassigned duty that has a pending swap.

> R-03 Reviewer note: AC3.6.4 to AC3.6.7 cover removing a parent (sign-in, sharing choice, contact details, audit), history shown as "korábbi tag", a leaving family's records, and held books or tasks. The pass/fail is now stated.

> R-04 Reviewer note: AC2.1.5 ends a leaving coordinator's right with an audit entry, and AC2.1.6 covers a group with no coordinator.

> R-05 Reviewer note: AC17.1.2 sets 3 tries, 15 minutes apart, and AC3.7.2 sets 7-day expiry with a way to resend.

> R-06 Reviewer note: AC3.1.6 to AC3.1.8 cover single-parent, no-children and no-account families. AC3.5.1 names the Q9 source in full.

> R-07 Reviewer note: AC13.1.6 covers a lead time other than the default. AC10.1.1 names the information page's starting sections.

### Summary

All seven prior findings are fixed. US5.4 and the extended swap, removal and notification criteria give engineering testable behaviour. The two new items are minor edge cases that can be settled in Functional Design, so engineering can start.
