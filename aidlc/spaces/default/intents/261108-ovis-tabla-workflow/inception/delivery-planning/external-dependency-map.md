# External Dependency Map

What outside the build can hold up a Bolt, which is one build pass over a piece of the work, ending in something that runs. The owner confirmed nothing else applies (Q3).

Inputs: `requirements.md`, `stories.md`, `mockups.md`, `components.md`, `unit-of-work.md`, `unit-of-work-dependency.md`, `unit-of-work-story-map.md`, `contract-summary.md` and `team-practices.md`.

## Dependencies

| Item | Owner | Needed for | If it slips |
|---|---|---|---|
| Review of each built screen against its Stitch design | The owner | Every Bolt with new screens | The Bolt waits at its checkpoint; nothing else starts |
| Fixing and re-running the anonymiser, outside the repository, and checking its output | The owner, with the assistant | The owner's trial runs in B15 | B15's automatic checks still pass on the invented workbook; only the trial run waits |
| Confirmation that teachers may see parents' phone and email (assumption A3) | The kindergarten | Go-live, not any Bolt | B3 is built as specified; if refused, a small change to the teacher's view is needed before go-live |

## Later Hosting Work

These are outside this work and block no Bolt: a real mail service, a real schedule for the daily run, loading real data, and the hosted site.
