**Collaborator:** aidlc-developer-agent

## Contribution

The draft is directionally consistent with the reverse-engineering evidence, but it should distinguish executable conventions from proposed conventions more sharply.

### Naming and code style

- Strict TypeScript, English technical identifiers, functional module names, `*.test.ts` colocation, and Hungarian user-facing denial text are observed conventions. Idiomatic TypeScript is therefore a defensible baseline.
- The evidence does not establish a repository-wide formatter, linter, naming rule, import-order rule, or file-layout enforcement. Prettier and ESLint are reasonable candidates, but selecting them and making them blocking gates requires human affirmation rather than inference.
- Repeated local `Session`, authorizer, and result shapes indicate contract drift risk. The team should decide whether these remain context-local types or are consolidated behind one stable application contract; an automatic cross-module deduplication rule would be premature.
- Many declarations are compressed onto single lines. This is a concrete maintainability problem that formatter adoption should correct, not an established style to preserve.

### Layer boundaries and file organization

- The ports-and-adapters modular-monolith boundary is well evidenced: domain services depend inward on explicit ports, infrastructure collaborators use constructor injection, and in-memory adapters support deterministic tests. The corresponding draft guidance should remain.
- Existing module barrels are internal organizational conveniences, not proven public package APIs: there is no root export, `exports` map, emitted JavaScript, or consumable package entry. The interview should determine whether barrel exports are intended public contracts and who owns compatibility before downstream work treats them as stable.
- The runnable slice should add a narrow application task port, synthetic in-memory adapter, composition root, and browser delivery adapter in an explicit delivery/application area. It should not widen the coordination aggregate merely to serve the demo and must not connect the partial Supabase edge.
- The current repository has no composition root, delivery directory, build boundary, or local development guide. Their names and exact placement are design decisions for the active intent, not discovered team practices.
- Repository transaction callbacks are synchronous and cannot be faithfully implemented by a future asynchronous database adapter without changing the port or concealing async work. This compatibility constraint should be surfaced before production persistence design and captured as an explicit boundary decision.

### Error handling

- Discriminated application-facing states such as `ready`, `empty`, `denied`, `not_found`, and invalid-input states are observed and are a good convention for user-recoverable outcomes.
- Error handling is not uniform across all layers: lower-level paths also use domain-specific errors or authorization unions, while the Supabase adapter throws infrastructure errors without application mapping. The draft should avoid implying a single repository-wide result mechanism.
- For the new browser boundary, validation failures, generic authorization denials, not-found outcomes, and infrastructure failures should be mapped deliberately into explicit application/UI states. Raw infrastructure exceptions must not cross the delivery boundary, and generic Hungarian denials must remain non-enumerating when real authorization is later connected.
- The team should confirm whether the intended rule is “discriminated results for expected/recoverable application outcomes; exceptions only for unexpected infrastructure/programming failures, mapped at the application boundary.” Evidence supports proposing this rule but does not prove it is already affirmed.

### Draft corrections and additions

- Keep the draft’s strict TypeScript, colocated tests, functional module boundaries, explicit ports, constructor injection, and application-facing result-state guidance, with the qualifications above.
- Rephrase “preserve functional module boundaries” to require explicit ownership and dependency direction for the new application/delivery code; current evidence shows cohesive modules but also a high-fan-out access boundary and repeated cross-context shapes.
- Add the synchronous-transaction-port constraint and missing infrastructure-error mapping to `evidence.md` because both materially affect future adapter design.
- Do not promote Prettier, ESLint, a shared type package, a barrel-export policy, or a universal Result type as discovered rules until the interview confirms them.
- Treat the active intent’s feature-local task contract and browser/application layout as bounded design guidance, not as a durable team-wide file-organization convention.

### Unresolved interview gaps

1. Which formatter and linter will be established, which configurations will be used, and will format/lint failures block CI?
2. Are module barrels intended stable public contracts or only internal conveniences, and what compatibility rule applies when they change?
3. Should expected application failures use discriminated results while unexpected infrastructure failures use exceptions mapped at the application boundary?
4. Where should the composition root and browser/application delivery code live, and may delivery code import only module public contracts?
5. Should repeated session/authorization/result shapes remain locally owned or be consolidated; if consolidated, which module owns them?
6. Must transaction ports become async before any real database adapter is introduced?
7. Does the team affirm the repository’s current 80% thresholds for lines, branches, and functions as the durable floor, rather than the existing team statement’s line-only floor?
8. Does the team require full-source coverage inclusion so unimported production files such as the Supabase adapter cannot escape the coverage gate?
9. Should English remain mandatory for code identifiers and Hungarian remain mandatory for all user-facing copy, including validation and error states?

## Positions

- AGREE: Keep strict TypeScript, colocated `*.test.ts` files, functional modules, explicit ports, constructor injection, and discriminated application-facing states — all are supported by the CodeKB evidence.
- AGREE: Establish formatter and linter tooling before claiming format or lint as executable gates — neither exists in the repository today.
- AGREE: Use a thin synthetic application/browser slice and avoid partially wiring Supabase — this preserves the observed domain boundaries and active-intent exclusions.
- OBJECT: Treating all observed barrels and module shapes as stable public conventions — the package has no root API, exports map, emitted output, or compatibility policy.
- OBJECT: Generalizing discriminated results into a universal error-handling rule — current lower layers mix result unions, domain errors, and thrown infrastructure failures, so the boundary policy needs human confirmation.
- OBJECT: Omitting the synchronous transaction-port constraint from the practices evidence — it is a material blocker for faithful async persistence adapters.
- OBJECT: Promoting Prettier/ESLint, shared cross-module types, or a delivery directory layout without interview confirmation — these are sensible proposals, not discovered facts.
