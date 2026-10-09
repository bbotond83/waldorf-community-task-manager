# User Stories Plan and Questions

## Established Plan

Use four personas corresponding to the approved four roles: Parent, Group admin, Óvónő/Kindergarten teacher and Super administrator. Existing staff becoming teachers and existing kindergarten administrators becoming super administrators are transition contexts for those personas, not additional available roles.

Use standard As a / I want / so that stories with independently testable Given/When/Then acceptance criteria and stable US/AC identifiers. All requested behavior is Must Have, as approved in requirements. Preserve denial, privacy and migration-state cases; no new product permissions or features are proposed.

Proposed initial breakdown: eight small stories covering current role selection, teacher tracking, teacher read-only enforcement, staff conversion, kindergarten-admin conversion, current/stale session resolution, retained parent/admin permissions, and business-record-safe cleanup. Designer, developer and quality contributions will refine sizing and coverage without changing approved behavior. Final count may change if a story needs splitting to remain independently testable.

## Q1: Story Organization

The roles and permissions are already settled. How would you like the stories organized for review?

A. By user workflow: choosing a role, tracking work, transitioning existing access, and preserving current behavior (recommended).
B. By persona: Parent, Group admin, Óvónő and Super administrator, with shared transition stories separately.
X. Other (please specify)

[Answer]: A. By user workflow: choosing a role, tracking work, transitioning existing access, and preserving current behavior.

## Interaction Mode

A. Guide me
B. I'll edit the file
C. Chat
X. Other (please specify)

[Answer]: Guide me

## Sources

[requirements.md](../requirements-analysis/requirements.md) and its completed questions; shared CodeKB business-overview.md and component-inventory.md; [team-practices.md](../practices-discovery/team-practices.md). Requirements determine behavior and priority; the planning question determines document organization only.

## Q2: Quality Review Fallback

The quality participant could not start: native delegation reported `agent thread limit reached` on both the initial spawn and a retry using an existing quality agent. The designer and developer contributions are complete and their draft refinements are integrated. AI-DLC's ensemble failure protocol requires a human choice after two unsuccessful delegation attempts.

A. Run it here — perform the quality participant's work in the current conversation, retaining its written contribution before the separate product-lead review and approval gate.
B. Skip and revisit — leave User Stories unfinished for a later session; no stage approval or advancement is implied.
X. Other (please specify)

[Answer]: Run it here
