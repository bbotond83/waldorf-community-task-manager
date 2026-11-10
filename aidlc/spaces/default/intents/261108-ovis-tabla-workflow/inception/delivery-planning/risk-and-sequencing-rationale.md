# Risk and Sequencing Rationale

Why the Bolts in `bolt-plan.md` run in this order. A Bolt is one build pass over a piece of the work, ending in something that runs.

Inputs: `requirements.md`, `stories.md`, `mockups.md`, `components.md`, `unit-of-work.md`, `unit-of-work-dependency.md`, `unit-of-work-story-map.md`, `contract-summary.md` and `team-practices.md`. No scoring model is used (Q2): there is one owner and every piece is in version 1.

## Sequencing Heuristic

Risk first, after a thin first slice.

- The spreadsheet retires only when everything is built and hosted, so no single feature delivers its value early. That makes early value a weak reason and early risk reduction a strong one.
- B1 and B2 come first by agreement: the conversion to one community, then one rota from database to parent's screen, checked by the owner before the rest.
- People and rights come next (B3, B4), because almost every later feature displays or depends on them, and privacy is the main control.
- Reminders (B5) come before the features that chase people, so each of those adds only its own check.
- Rotas and swaps (B6, B7) carry the most tangled rules and follow directly.
- Simpler, independent features follow (B8 to B13).
- Removal (B14) comes after everything it must reach. Migration (B15) comes last because it loads records that must already exist.

The order follows the unit numbers, one of the orders `unit-of-work-dependency.md` allows, so there is no deviation from it.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Converting to one community breaks access rules that work today (the owner's main worry) | Medium | Critical | First Bolt; every authorization-matrix row tested; each screen walked through per role; starts clean on invented data (`requirements.md`, US1.1) |
| The fair rota draft is not usable | Medium | High | Proven with one rota in B2 and checked by the owner before the rest |
| Swaps and weekend picks get tangled | Medium | High | One transaction and named rules (`contract-summary.md` C11); fixed test list including two people at once |
| Directory shows hidden fields | Low | Critical | Visibility decided in the database; request-bypass tests (AC3.1.5) |
| Removal misses a kind of record | Medium | High | One named provider per kind of record (C16); B14 comes after all of them exist |
| A later unit needs a contract change | Medium | Medium | Provider and callers change in the same pull request (`contract-summary.md`) |
| Volume of owner reviews slows the build | High | Medium | Each Bolt has one short demo; Bolts are sized for one sitting |
| Reminders only run when triggered locally | Certain | Low | Shown in the B5 demo; the real schedule belongs to the hosting work |
| Real email is unverified | Certain | Medium | Verified against a local test mailbox; real delivery is checked in the hosting work |

## Items Carried into Bolts

| Bolt | Item |
|---|---|
| B1 | How to record a fixed-list test case with no meaning for a rule |
| B2 | Prove the draft on one rota, including empty weeks when too few families exist |
| B5 | Time zone and run hour: 07:00 Budapest by default, plus Friday noon |
| B7 | The requester field's name, whether a super admin with no parent record can be `decidedBy`, and which swap function names stay |
| B8 | Acceptance criteria for giving up a slot, not yet in `stories.md` |
| B10 | The shape of the "clear a typed name" command and its list; whether an event can name other organisers |
| B12 | Whether finishing a pulled task on a checklist also finishes its to-do task |
| B14 | Removing a family's only parent or a group's only coordinator |
| B15 | How the invented workbook stays faithful to the real layout |
