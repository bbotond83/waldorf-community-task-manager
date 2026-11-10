# Team Allocation

A Bolt is one build pass over a piece of the work, ending in something that runs. A mob is the group that works on a Bolt together. This plan has no team-formation stage, so all 15 Bolts in `bolt-plan.md` are built by the AI developer agent (aidlc-developer-agent), with the owner reviewing.

Inputs: `requirements.md`, `stories.md`, `mockups.md`, `components.md`, `unit-of-work.md`, `unit-of-work-dependency.md`, `unit-of-work-story-map.md`, `contract-summary.md` and `team-practices.md`.

## Allocation

| Bolts | Built by | Reviewed by |
|---|---|---|
| B1 to B15 | aidlc-developer-agent | The owner, at each Bolt's checkpoint, and the architecture reviewer on the design and code |

## The Owner's Part in Each Bolt

- Approve the plan and the design for the Bolt.
- Compare each new screen with its Stitch design, using screenshots the assistant provides.
- Try the demo named in `bolt-plan.md`.
- Approve the checkpoint before the next Bolt starts.

## Working Rhythm

Bolts run one at a time, each on its own short-lived branch, squash-merged to `main` through a pull request. Half-finished features may be visible on `main`, because only the owner runs the app during this work.
