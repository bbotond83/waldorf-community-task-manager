# Code Generation Plan Approval

AI-DLC built this plan without asking because plan approval is off for this
piece of work. This file is the record and asks nothing; to look at a plan
before it is built, ask in chat.

## Plan Approval

Built without asking: plan approval is off for this piece of work (set by you).

- Builds: the real tables, policies and use-case functions for people and structure (Directory), settings, and tasks, sign-ups, swaps, cancellations, notes and the teacher schedule (Coordination), th...
- Touches: `supabase/migrations/` (new files only), `src/data/` (new database adapters), `src/runtime/production/`, `src/application/` (port additions), `src/access/` (parent matrix and role policy),...
- Tests: about 400 tests across fourteen components (unit with fakes, real-stack database, contract, component, and browser with accessibility checks), 10 to 15 per component, plus the race, lock-ord...
- Deviation from the approved design, recorded on purpose: rule BR34.1 listed `src/parent-web`, `src/admin-core`, `src/teacher-web` and `src/teacher-tracking` for deletion in U3. They are still the r...

Full plan: aidlc/spaces/default/intents/261012-real-backend-local/construction/u3-directory-and-coordination/code-generation/code-generation-plan.md
Test instructions: aidlc/spaces/default/intents/261012-real-backend-local/construction/u3-directory-and-coordination/code-generation/unit-test-instructions.md

[Approval Fingerprint]: sha256:v3:04298c544e6086b5540dcfff1dda8ec4eb07802b2bad3623f29677f24c6c54e6
[Planned Source]: 8808581719b6f059234927102c06e5f60c51134a4cf90973d41d3132a7945329


[Answer]: Plan approval off
