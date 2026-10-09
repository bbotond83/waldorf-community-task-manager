**Collaborator:** aidlc-quality-agent

## Contribution

### Testing posture and affirmed baseline

The lead correctly retains the existing team requirement to deliver tests with code, add defect regressions, preserve 80% line/branch/function coverage across production source, and keep the complete local validation gates. These are established practices, not new requirements inferred from this role change. The existing same-change statement does not determine test-first versus test-after ordering. The final draft needs explicit `Methodology` and `Ordering` fields selected by the human. Org test-after is a fallback suggestion, not an already affirmed team decision.

No current pass count, coverage measurement, browser result or linked-target proof was obtained during this review. Historical counts must remain historical, consistent with the project testing rules. No tests or browsers were run and no application files were changed.

### Observed tooling and gate scope

| Evidence | Observed practice and limit |
| --- | --- |
| `package.json` | Node test runner for colocated domain tests; Vitest for delivery/rendering and combined coverage; Playwright and Axe for browser checks. `npm test` combines domain and delivery tests. |
| `vitest.config.ts` | Istanbul includes production `app`, `src`, scripts, proxy and Next configuration, excluding tests/declarations. Line, branch and function floors are 80%. These are aggregate thresholds, not a separately enforced 80% minimum for each file. The production reporter adds inventory checking; its existence is not proof of today's measured coverage. |
| `scripts/verification/run-local-verification.ts` | Canonical `npm run verify:local` fails on toolchain, manifest, format, lint, typecheck, tests, coverage, security, build, start-smoke or browser failure, then aggregates evidence and scans generated records for privacy. Command ordering is verification ordering, not development cadence. Scenario evidence associates successful command logs with manifest scenarios; it does not independently establish semantic policy parity. |
| `.github/workflows/ci.yml` | Main-targeting PRs and main pushes execute the complete local pipeline using locked dependencies and installed Chromium/Firefox. Build evidence depends on successful validation. Repository branch protection and required-check enforcement were not inspected. Workflow presence alone cannot certify that merges are blocked. |
| `playwright.config.ts` | Desktop Chromium, Firefox and Pixel 7 mobile Chrome, isolated production servers, one worker, failure traces/screenshots and two CI retries. Installed-Chrome login performance suites are excluded from the standard suite. Their opt-in status should remain explicit. |
| `tests/browser/staff-web.spec.ts` | Per-test synthetic reset/profile selection; scoped filtering, empty/invalid states, crafted out-of-scope denial, recovery, absence of sensitive/mutating DOM capabilities, and accessibility. This is an appropriate existing teacher regression starting point once requirements settle scope and event detail. |
| `tests/coverage/app-session-boundaries.test.ts` | Before-each fixture resets and after-each environment cleanup support repeatability. Existing explicit staff/admin profiles need coherent updates with runtime role changes. |
| `src/access/access-service.test.ts`, `src/application/authorization.test.ts` | Requirement-oriented authorization tests exercise role/scope/field restrictions, revocation and governance. The available assertions do not establish agreement between application, domain and SQL policies. |

The consumed quality record also identifies the independent production inventory helper, 39 manifest scenarios (33 local, six outstanding), role-specific boundary/browser fixtures, and limited regex-based security scanners. These are static findings; this support review does not recertify omitted deep scan paths or real backend behavior. Supabase auth/RLS/persistence, scheduler/provider, Vercel and Safari must remain outstanding until exercised against actual targets.

### Role change implications for future quality work

For requirements and later test planning, cover the exact four-role catalog; Munkatárs-to-Óvónő replacement; read-only tasks, owners and task/event status; direct-route/action authorization; group/family boundaries; sensitive field exclusions; immediate revocation; old/unknown role and profile rejection; and last-super-admin protection. Keep positive access assertions paired with mutation and disclosure denials. The domain unknown-role fallback and unrestrained SQL role text make runtime rejection important; merely changing a TypeScript union is insufficient.

Update fixtures, runtime profile/session expectations, executable authorization rows and versioned verification references together. Manifest reference validity is separate from agreement with actual permissions. Cross-layer agreement needs targeted assertions or explicit policy evidence; synthetic success cannot be presented as real RLS verification.

This is a future test-planning recommendation, not a new mandated team constraint or permission to expand teacher access. Teacher group scope, event detail, legacy kindergarten-admin grant disposition and business-group cleanup must be clarified during requirements analysis before expected test outcomes are fixed.

### Interview needs

1. Ask only the unresolved testing cadence: implement each layer then its tests, write tests before implementation, or a specified mixed cadence. Preserve same-change/regression/coverage/gate requirements whichever option is selected. A mixed answer requires `custom` plus an explicit ordering sentence.
2. Retain the lead's narrow attestation and merge-strategy follow-ups. Unsigned private build records are evidence, but are not signed attestations and do not automatically amend the existing mandate.
3. No additional QA question is needed to reopen the established coverage floor, browser/a11y gate or real-target evidence posture. These are already affirmed. Do not imply the current intent has executed them.

### Sources and review boundaries

Read all six consumed CodeKB documents, all four lead draft outputs, active-space org/team/project memory, the practices-discovery stage and ensemble contract, and the bounded repository files cited above. Did not read sibling contributions. Only this contribution file was written. The nonexistent `scripts/verification/run-domain-coverage.ts` path was attempted once; actual domain coverage invocation was confirmed from `package.json`, so no finding relies on that absent file.

## Positions

- AGREE: Preserve the affirmed testing, coverage, CI and real-target evidence requirements — configuration supports the posture without proving fresh results.
- AGREE: Interview the human for explicit Methodology and Ordering — tests in the same change do not imply test-first development.
- AGREE: Keep role and business-group questions in requirements analysis — they determine expected behavior rather than team practices.
- AGREE: Surface unsigned build evidence honestly and retain the attestation conflict — checksums do not satisfy a signed-attestation claim.
- AGREE: Retain the stated inspection limits — no fresh execution or branch-protection proof exists in this review.
- OBJECT: Promote the current team-practices draft before the cadence interview — its Testing Posture lacks the required structured Methodology and Ordering fields. This is an expected draft gap already acknowledged by the lead, resolved by the planned interview and integration.
