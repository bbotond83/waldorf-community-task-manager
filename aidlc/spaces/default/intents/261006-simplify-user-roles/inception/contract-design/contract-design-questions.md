# Contract Design Questions

## Settled Contract Basis

[unit-of-work.md](../units-generation/unit-of-work.md) defines U1 current-role foundation, U2 teacher tracking and U3 retained workflows/cleanup. [unit-of-work-dependency.md](../units-generation/unit-of-work-dependency.md) defines U2 -> U1, U3 -> U1 and U3 -> U2. [components.md](../domain-design/components.md) preserves Access policy/grant ownership, business entity ownership and teacher read-model ownership. [requirements.md](../requirements-analysis/requirements.md) fixes four roles, assigned-group read-only tracking, privacy/denial, scope/state-preserving grant conversion and current-session integrity.

Retain synchronous in-process ports/shared TypeScript models for unit integration, current explicit results and safe retry behavior. This integrated application release requires coordinated contract changes rather than independently deployed API versions. U1 owns current-role/session and conversion contracts; U2 owns teacher source/projection/routes; U3 consumes them for retained workflows and executable scenario cleanup. SQL/RLS remains a matching enforcement surface, not a new HTTP service. No public partner API, new broker, production linkage or live migration is introduced.

Teacher source records must identify actual responsible owner, assignments and current status separately from coordination contact, with explicit absence and no sensitive fallback. Source/fixture mapping is required design work using existing records; it is not an extra feature choice. Old schedule/detail links retain minimal redirects and validated filter context, as already approved. English development name Kindergarten teacher and Hungarian UI label Óvónő are settled.

## Q1: Recovery for Existing Synthetic Sessions

The approved requirements allow either current-grant refresh or reauthentication after conversion. Existing synthetic cookies contain old profile IDs. Which concrete recovery should this change implement when those IDs are removed?

A. Invalidate the old synthetic cookie and use the existing profile-selection/sign-in recovery; do not silently substitute a profile (recommended, smallest explicit behavior). Converted grants remain available through a fresh current profile/session.
B. Refresh a valid old cookie into its corresponding current profile only after verifying current subject, converted grants and authorization version; deny revoked/inactive or unmappable sessions. This needs an explicit compatibility mapping beyond URL redirects.
X. Other (please specify)

[Answer]: A. Invalidate the old synthetic cookie and use the existing profile-selection/sign-in recovery; do not silently substitute a profile. Verbatim chat response: "yes" to fresh selection/sign-in.

## Interaction Mode

A. Guide me
B. I'll edit the file
C. Chat
X. Other (please specify)

[Answer]: Chat
