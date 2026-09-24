# Application Facades Technology Decisions

## Sources

Decisions implement [business logic](../functional-design/business-logic-model.md), [business rules](../functional-design/business-rules.md), approved [requirements](../../../../inception/requirements-analysis/requirements.md), and preserve the brownfield [technology stack](../../../../../../codekb/waldorf-community-task-manager/technology-stack.md).

## Selections

- Strict TypeScript ESM under NodeNext; no React/Next/environment dependency in the library.
- Existing domain module barrels and constructor injection at all infrastructure seams.
- Zod-compatible schemas passed in or housed in a transport-neutral validation package; avoid duplicate validation implementations.
- Discriminated unions with exhaustive `never` checks for domain-to-application mapping.
- Native `node:test` for fast contract/unit tests; delivery integration tests exercise the same public façade APIs.
- Plain immutable view models and event/evidence envelopes; no ORM or persistence types.

## Alternatives Rejected

Framework-bound server actions inside façades would couple tests and domain mapping to Next.js. Raw exception propagation violates privacy and explicit-state requirements. Generic dictionaries for results/authorization would lose compile-time exhaustiveness.

## Acceptance

The library typechecks independently, exposes only public contracts, has no dependency cycle into delivery/adapters, maps every required result state, and passes authorization/privacy/idempotency/redaction contract suites at required coverage.
