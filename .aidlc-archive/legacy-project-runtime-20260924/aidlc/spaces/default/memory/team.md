# Team-Level Rules

> This team's affirmed practices and corrections. Loaded after `org.md` as
> strict-additive guidance; contradictions with broader policy are rejected.
> Populated by the practices-discovery affirmation gate. Edit at the gate,
> not directly.

## Way of Working

We use trunk-based development. We work in short-lived feature branches, squash-merge to `main`, and require green automated checks before merge.

## Walking Skeleton

We use a scope-dependent walking skeleton. When the active scope enables it, we run a gated first Bolt. For this runnable-web-app feature, that Bolt proves the browser, composition, production-build, start, and smoke-test boundaries before broader delivery proceeds.

## Testing Posture

We write tests in the same change as the code and add a regression test for every defect. We enforce at least 80% line, branch, and function coverage across all production source.

Before merge, we require strict type checking, tests, a production build, deterministic start smoke, the critical browser flow, and dependency scanning that blocks high and critical findings. The critical browser flow must have no serious or critical automated accessibility violations. Provisioned integrations do not count as verified until they are exercised against their real targets.

## Deployment

We automatically build and deploy eligible changes to staging. We promote immutable deployments to production only after protected manual approval, and we retain the prior deployment as the rollback target. We keep executable deployment workflows disabled until both a deployable application and a linked target project exist; until then, the tested git SHA is our artifact-provenance claim.

## Code Style

We use strict, idiomatic TypeScript with English technical identifiers and Hungarian user-facing copy. We use Prettier and ESLint as blocking checks. We preserve functional module boundaries, explicit ports, constructor injection at infrastructure seams, and colocated `*.test.ts` files.

We represent expected application failures as explicit result states and map unexpected infrastructure errors at the application boundary. CI includes secret scanning and SAST, with high and critical SAST findings blocking delivery. We pin CI actions to immutable revisions and add an SBOM and artifact attestation when a deployable artifact exists.
## Forbidden

<!-- Team-specific forbidden patterns -->

## Mandated

<!-- Team-specific mandates -->

## Corrections

<!-- Self-learning loop appends here. -->
