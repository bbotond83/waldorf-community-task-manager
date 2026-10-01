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

- NEVER enable executable deployment workflows before a deployable application and linked target project exist. (affirmed 2026-08-12)
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

- ALWAYS require green automated checks before merge. (affirmed 2026-08-12)
- ALWAYS run a gated first Bolt when the active scope enables a walking skeleton. (affirmed 2026-08-12)
- ALWAYS write tests in the same change as the code and add a regression test for every defect. (affirmed 2026-08-12)
- ALWAYS enforce at least 80% line, branch, and function coverage across all production source. (affirmed 2026-08-12)
- ALWAYS block delivery on failed type checking, tests, production build, start smoke, critical browser-flow checks, serious or critical accessibility violations in that flow, or high and critical dependency findings. (affirmed 2026-08-12)
- ALWAYS automatically deploy eligible changes to staging and require protected manual approval before immutable production promotion. (affirmed 2026-08-12)
- ALWAYS use Prettier and ESLint as blocking checks. (affirmed 2026-08-12)
- ALWAYS use English technical identifiers and Hungarian user-facing copy. (affirmed 2026-08-12)
- ALWAYS preserve module ports, injection, and colocated tests. (affirmed 2026-08-12)
- ALWAYS map expected application failures to explicit result states and unexpected infrastructure errors at the application boundary. (affirmed 2026-08-12)
- ALWAYS run CI secret scanning and SAST, with high and critical SAST findings blocking delivery. (affirmed 2026-08-12)
- ALWAYS pin CI actions to immutable revisions. (affirmed 2026-08-12)
- ALWAYS generate an SBOM and artifact attestation when a deployable artifact exists. (affirmed 2026-08-12)
## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
- Reuse existing Code Generation artifacts when the recorded plan approval is explicit. (learned 2026-09-23) <!-- cid:code-generation:c1 -->
- Use the inline review fallback after two reviewer dispatch failures caused by an unsupported pinned model. (learned 2026-09-23) <!-- cid:code-generation:c2 -->
- The initial request authorizes a brownfield current-state investigation and a next-work plan (learned 2026-09-25) <!-- cid:260925-brownfield-roadmap:intent-capture:f2fed79211bd3f89e50f31181fac1973fa282c6c5aeeb8051e390b8d20ab1fba -->
- The approved intent keeps the product boundary open until reverse-engineering (learned 2026-09-25) <!-- cid:260925-brownfield-roadmap:scope-definition:91fc9d6dd5a95bcaad3b779b4f10be0e78f759f77d8276e9b7a00cdd26094bb5 -->
- ALWAYS capture the CodeKB source snapshot and publish the candidate using the same Git-access mode; reuse the exact snapshot store generation and source fingerprint for compare-and-swap publication. (learned 2026-09-29) <!-- cid:260925-brownfield-roadmap:reverse-engineering:3e4caaf567315f5e47f345882c623ba4cae38d4e0bb1ca20606d8c0348cfeba4 -->
- ALWAYS record all exact choices from one guided multi-question response in a single answer-log entry; do not submit one answer per question from the same user turn. (learned 2026-09-29) <!-- cid:260925-brownfield-roadmap:requirements-analysis:c10ea7bc5d18f30a38164573b329a8416aec91773ef434ae77ef659389e0a02c -->
- Keep Unit boundaries aligned with the owner's clarified outcomes, and resolve mismatches between requested parallelism and dependency prerequisites before generating the Unit graph. (learned 2026-09-29) <!-- cid:260925-brownfield-roadmap:units-generation:d6eb405ebfa3bba9f2361326cdcb49894127c80bce9985b192e187372ba51621 -->
