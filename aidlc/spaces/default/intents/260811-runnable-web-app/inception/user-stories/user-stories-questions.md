# User Stories Plan

## Sources

- [requirements] `../requirements-analysis/requirements.md`
- [prior-stories] `../../../260729-feature/inception/user-stories/stories.md`
- [prior-personas] `../../../260729-feature/inception/user-stories/personas.md`
- [business] `../../../codekb/waldorf-community-task-manager/business-overview.md`
- [components] `../../../codekb/waldorf-community-task-manager/component-inventory.md`
- [practices] `../practices-discovery/team-practices.md`

## Q1. Persona Approach

- A. Retain Parent, Kindergarten Administrator, Group Administrator, Read-only Staff, and Super Administrator; add Developer/Product Owner for local setup and acceptance
- B. Replace product personas with Developer only
- C. Parent only
- D. Administrator only
- E. Not yet decided
- X. Other (please specify)

[Answer]: A. Retain Parent, Kindergarten Administrator, Group Administrator, Read-only Staff, and Super Administrator; add Developer/Product Owner for local setup and acceptance

## Q2. Story Granularity

- A. Keep prior US-01 through US-14 normative and add small vertical local-runtime stories for setup, identity, shell, role surfaces, evidence, and deployment boundary
- B. Rewrite every prior product story
- C. One epic for the entire application
- D. Technical tasks without user value
- E. Not yet decided
- X. Other (please specify)

[Answer]: A. Keep prior US-01 through US-14 normative and add small vertical local-runtime stories for setup, identity, shell, role surfaces, evidence, and deployment boundary

## Q3. Breakdown and Priority

- A. Break down by executable workflow and persona; Must Have for reproducible local acceptance, Should Have only for secondary fidelity that cannot displace the critical path
- B. Break down by framework layer
- C. Prioritize visual polish before behavior
- D. No priorities
- E. Not yet decided
- X. Other (please specify)

[Answer]: A. Break down by executable workflow and persona; Must Have for reproducible local acceptance, Should Have only for secondary fidelity that cannot displace the critical path

## Plan Summary

- Personas: 6 total (5 inherited product roles plus Developer/Product Owner).
- Stories: retain 14 inherited stories; add 24 local-runtime delivery stories plus explicit evidence aggregation gates.
- Breakdown: vertical workflow/persona slices with Given/When/Then authorization, privacy, state, and evidence outcomes.
- Priority: all delta stories are Must Have; enabler, product-workflow, evidence, and aggregation items are labelled separately.
