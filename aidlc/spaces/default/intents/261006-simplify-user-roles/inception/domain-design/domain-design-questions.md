# Domain Design Questions

## Established Context

Approved requirements and stories define four roles: Parent, Group admin, Kindergarten teacher and Super administrator. The teacher tracks existing scheduled tasks/events in explicitly assigned groups, read-only, with owners, assignments and current status. Staff grants convert to teacher; kindergarten-admin grants convert to super-admin within their existing organization. Preserve inactive/revoked state, actual business groups and records. Advanced operations are Super administrator only. English development names and Hungarian UI copy are settled.

The current architecture already separates access, directory, coordination, notifications, privacy lifecycle, imports, parent/admin experiences, staff schedule and runtime/facades. Access owns grants and revocation; task/assignment owners stay in their existing business modules. The teacher view is an allowlisted read model, not a new owner of task records. SQL is an enforcement dependency, not a logical component. Production composition is unlinked; this change does not provision or switch backend infrastructure.

Sources: [requirements.md](../requirements-analysis/requirements.md), [stories.md](../user-stories/stories.md), shared CodeKB [architecture.md](../../../../codekb/waldorf-community-task-manager/architecture.md) and [component-inventory.md](../../../../codekb/waldorf-community-task-manager/component-inventory.md), [team-practices.md](../practices-discovery/team-practices.md), and approved refined mockups. Prior questions and scoped audit answers were checked; product permissions and visual direction are not reopened.

## Q1: Component Boundaries

The application already has separate access, schedule and business modules. How much restructuring should accompany the role cleanup?

A. Preserve existing module boundaries; make Access the owner of the four-role policy and grant conversion, rename the staff schedule to Kindergarten teacher tracking, and adapt existing consumers/projections (recommended). Smaller change; enforcement surfaces still need explicit parity checks.
B. Combine role policy and teacher tracking into a new component. It centralizes this feature but couples access lifecycle to schedule presentation and requires broader restructuring.
X. Other (please specify)

[Answer]: A. Preserve existing module boundaries; make Access the owner of the four-role policy and grant conversion, rename the staff schedule to Kindergarten teacher tracking, and adapt existing consumers/projections.

## Q2: Existing Staff URLs

The current schedule uses `/munkatars/beosztas`. After introducing teacher routes, how should existing bookmarks behave?

A. Keep a minimal redirect from old schedule/detail URLs to the teacher equivalents, preserving only validated filters; remove the old role and authorize the new destination normally (recommended). Existing links keep working without a fifth role.
B. Remove old URLs entirely; users navigate through the updated teacher menu. Simpler route cleanup, but old bookmarks stop working.
X. Other (please specify)

[Answer]: A. Keep a minimal redirect from old schedule/detail URLs to the teacher equivalents, preserving only validated filters; remove the old role and authorize the new destination normally.

## Interaction Mode

A. Guide me
B. I'll edit the file
C. Chat
X. Other (please specify)

[Answer]: Guide me
