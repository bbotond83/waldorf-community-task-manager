# Project-Level Rules

> Project-specific specialisation and corrections. Loaded after `org.md` and
> `team.md` as strict-additive guidance; contradictions with broader policy
> are rejected. Populated by practices-discovery and the self-learning loop.
>
> Use sparingly: most teams don't need a project layer. Reach for it
> only when this specific project needs stable, durable guidance beyond the
> team practice (for example, package-specific release checks or an additional
> regression suite for a legacy component).

## Way of Working

<!-- Project-specific specialisation. Example: -->
<!-- This monorepo requires package-scoped branch names and a package owner -->
<!-- review in addition to the team's normal merge policy. -->

## Walking Skeleton

<!-- Project-specific specialisation. Example: -->
<!-- The walking skeleton must exercise the legacy service adapter as well -->
<!-- as the new service boundary. -->

## Testing Posture

<!-- Project-specific specialisation. -->

- ALWAYS treat current executable test and coverage results as authoritative when historical summaries contain stale counts (learned 2026-08-06) <!-- cid:build-and-test:c1 -->
- ALWAYS include security and performance instructions when explicit NFR or privacy risks require them, even under Standard strategy (learned 2026-08-06) <!-- cid:build-and-test:c2 -->
- ALWAYS report provisioned environment checks as outstanding evidence until they are executed against real integrations (learned 2026-08-06) <!-- cid:build-and-test:c3 -->
- ALWAYS block CI on high and critical dependency vulnerabilities (learned 2026-08-06) <!-- cid:ci-pipeline:c3 -->
## Deployment

<!-- Project-specific specialisation. -->

- ALWAYS use the tested git SHA as artifact provenance while the repository contains domain modules without a deployable application bundle (learned 2026-08-06) <!-- cid:ci-pipeline:c1 -->
- NEVER publish a package artifact unless the project explicitly adopts package distribution (learned 2026-08-06) <!-- cid:ci-pipeline:c2 -->
- ALWAYS use Vercel immutable deployment promotion and prior-deployment rollback as the application release strategy (learned 2026-08-06) <!-- cid:deployment-pipeline:c1 -->
- NEVER create an executable deployment workflow before a deployable application and linked target project exist (learned 2026-08-06) <!-- cid:deployment-pipeline:c2 -->
- ALWAYS require manual production approval from development for the two-environment MVP (learned 2026-08-06) <!-- cid:deployment-pipeline:c3 -->
## Code Style

<!-- Project-specific specialisation. -->

## Tech Stack

<!-- Technology choices locked for this project. -->

## Decided

<!-- Decisions made in earlier stages that should not be re-asked. -->
<!-- Format: DECIDED: [decision] (Stage [slug], [date]) -->

## Scope Overrides

<!-- Custom scope rules for this project. -->

## Forbidden

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: NEVER [behavior] (affirmed [date]) -->
<!-- Example: NEVER throw exceptions across service layer boundaries (affirmed 2026-05-17) -->

## Mandated

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: ALWAYS [behavior] (affirmed [date]) -->
<!-- Example: ALWAYS use Result<T,E> for fallible operations in service layer (affirmed 2026-05-17) -->
- ALWAYS keep each requirements-analysis answer directly attached to its corresponding question and retain a single current consolidated confirmation (learned 2026-08-04)
- ALWAYS express user stories as independently testable Given/When/Then slices with explicit authorization, privacy, and audit outcomes (learned 2026-08-05)
- ALWAYS represent privacy-sensitive or approval workflows with explicit detail-screen states, access boundaries, and recovery outcomes (learned 2026-08-05)
- ALWAYS document module data ownership, public contracts, and transactional/event boundaries before engineering handoff (learned 2026-08-05)
- ALWAYS keep dependency topology separate from economic delivery sequencing and make durable event dependencies explicit (learned 2026-08-05)
- ALWAYS use a walking skeleton to validate end-to-end boundaries before parallelizing independent delivery work (learned 2026-08-05)

## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
