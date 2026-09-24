# Constraint Register

## Active Constraints

This register applies the corrected [intent statement](../intent-capture/intent-statement.md) and inherits the approved platform, privacy, and application boundaries from `260729-feature`. [intent] [Q1] [Q2] [Q6]

| ID | Constraint | Type | Impact | Required response | Source |
|---|---|---|---|---|---|
| C-01 | Preserve the approved application behavior and stakeholder surfaces from `260729-feature`. | Scope | A narrow demo cannot satisfy the intent. | Map inherited requirements and UI artifacts to runnable routes and flows. | [intent] [Q1] [Q4] |
| C-02 | Use a Next.js modular monolith with the existing strict TypeScript domain modules. | Architecture | Framework code must not absorb domain rules or erase module boundaries. | Compose through explicit ports/adapters and keep strict type checks. | [Q1] [Q3] |
| C-03 | Vercel remains the frontend deployment target; Supabase remains backend, authentication, and database. | Platform | Local and production configuration must align with approved services. | Provide environment contracts and deployment-compatible builds; do not add AWS. | [Q6] |
| C-04 | Local testing must use synthetic data and retain privacy/authorization boundaries. | Privacy | Real child or family data cannot be required for developer setup or tests. | Supply privacy-safe fixtures and preserve defense-in-depth checks. | [Q2] |
| C-05 | The application must support documented development, production build, deterministic start, and browser validation. | Delivery | Root scripts and runtime configuration are required deliverables. | Add `dev`, `build`, and `start` commands plus smoke/browser checks. | [Q4] [Q5] |
| C-06 | Existing domain tests and 80% line/branch/function coverage gates remain green. | Quality | Delivery code adds test volume and cannot regress domain behavior. | Test in the same change and enforce the repository's affirmed checks. | [Q3] [repository] |
| C-07 | Executable deployment remains disabled until a deployable app and linked target exist. | Release | Local runnability precedes activation of deployment automation. | Produce a deployable application first; retain manual production approval. | [Q4] [Q6] |

## Dependencies and Decisions

- Existing `src/` public contracts are implementation dependencies, not designs to replace. [Q1] [Q3]
- Approved `260729-feature` requirements, stories, refined mockups, application design, units, and functional designs are downstream specification inputs. [intent] [Q1] [Q4]
- A local Supabase approach must be selected without claiming real integration verification until exercised against the target. [Q2] [Q6]
- Browser automation and accessibility checks are required by affirmed team practices once the delivery layer exists. [Q4]

## Sources

- [intent] `../intent-capture/intent-statement.md`
- [Q1]–[Q6] `feasibility-questions.md`
- [repository] Root `package.json`, `src/`, and active-space practices
