# RAID Log

## Risks

| ID | Risk | Likelihood | Impact | Mitigation | Source |
|---|---|---|---|---|---|
| R-01 | Delivery collapses to a task demo instead of exposing the approved application surfaces. | Medium | High | Trace routes and flows to prior requirements, stories, and refined mockups. | [intent] [Q1] [Q4] |
| R-02 | Framework components duplicate or bypass existing domain rules. | Medium | High | Compose through public contracts and explicit adapters; retain domain tests. | [Q1] [Q3] |
| R-03 | Local fallback behavior masks missing Supabase authorization or persistence verification. | Medium | High | Label local substitutes, test adapter contracts, and keep real-target verification outstanding. | [Q2] [Q6] |
| R-04 | Environment setup is incomplete or undocumented, so the app only runs on the implementer's machine. | Medium | High | Verify fresh setup, example environment configuration, build, start smoke, and browser flow. | [Q4] [Q5] |
| R-05 | Privacy-sensitive data appears in fixtures, logs, or screenshots. | Low | High | Use synthetic data and redaction; test role boundaries. | [Q2] |
| R-06 | The inherited MVP breadth exceeds a single safe implementation increment. | High | Medium | Use the walking skeleton to establish runtime and critical surfaces, then deliver dependency-ordered slices. | [Q1] [Q4] |

## Assumptions

| ID | Assumption | Validation | Source |
|---|---|---|---|
| A-01 | Existing domain-module public contracts are sufficient foundations for the application layer. | Map every inherited flow during requirements/application design and identify genuine contract gaps. | [Q1] [Q3] |
| A-02 | Next.js can be introduced without changing approved Vercel/Supabase architecture. | Production build and adapter/configuration validation. | [Q3] [Q6] |
| A-03 | Synthetic local data can exercise critical UI states without real personal data. | Browser test fixtures covering role and workflow states. | [Q2] [Q4] |

## Issues

| ID | Issue | Required action | Source |
|---|---|---|---|
| I-01 | No web application entry point or application routes exist. | Implement the Next.js delivery layer. | [Q5] |
| I-02 | Root scripts do not include `dev`, `build`, or `start`. | Add and document runnable scripts. | [Q4] [Q5] |
| I-03 | No local environment/configuration contract is present. | Define safe defaults, example variables, and setup instructions. | [Q4] [Q5] |

## Dependencies

| ID | Dependency | Treatment | Source |
|---|---|---|---|
| D-01 | Approved `260729-feature` artifacts | Reuse as authoritative product and design inputs. | [intent] [Q1] |
| D-02 | Existing TypeScript domain modules | Integrate through public contracts; do not replace. | [Q1] [Q3] |
| D-03 | Next.js and Supabase runtime packages | Add at Construction after design confirms package boundaries. | [Q3] [Q6] |

## Sources

- [intent] `../intent-capture/intent-statement.md`
- [Q1]–[Q6] `feasibility-questions.md`
- [repository] Root `package.json` and `src/`
