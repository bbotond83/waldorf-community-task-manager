# Contract Design Plan

The choices in this stage are technical and can be resolved from `unit-of-work.md`, `unit-of-work-dependency.md`, `components.md`, `requirements.md` and the code knowledge base, so no question is put to the owner here.

- **Public API:** none. The app has no public API (`api-documentation.md`), and this work adds none.
- **Mechanism:** one database and named functions, the existing pattern (`architecture.md`, `decisions.md` ADR-010).
- **Ownership:** the unit that delivers a function owns its contract.
- **Breaking changes:** one repository, so the provider and every caller change in the same pull request.
- **Errors and retries:** the existing result envelope and refusal codes (`team.md`, Code Style), and the 3 email tries from `stories.md`.

The owner reviews these choices at the approval step.
