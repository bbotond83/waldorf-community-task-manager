# Discovered Rules

## Mandated

- ALWAYS require green automated checks before merge.
- ALWAYS run a gated first Bolt when the active scope enables a walking skeleton.
- ALWAYS write tests in the same change as the code and add a regression test for every defect.
- ALWAYS enforce at least 80% line, branch, and function coverage across all production source.
- ALWAYS block delivery on failed type checking, tests, production build, start smoke, critical browser-flow checks, serious or critical accessibility violations in that flow, or high and critical dependency findings.
- ALWAYS automatically deploy eligible changes to staging and require protected manual approval before immutable production promotion.
- ALWAYS use Prettier and ESLint as blocking checks.
- ALWAYS use English technical identifiers and Hungarian user-facing copy.
- ALWAYS preserve module ports, injection, and colocated tests.
- ALWAYS map expected application failures to explicit result states and unexpected infrastructure errors at the application boundary.
- ALWAYS run CI secret scanning and SAST, with high and critical SAST findings blocking delivery.
- ALWAYS pin CI actions to immutable revisions.
- ALWAYS generate an SBOM and artifact attestation when a deployable artifact exists.

## Forbidden

- NEVER enable executable deployment workflows before a deployable application and linked target project exist.
