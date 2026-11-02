# Code Generation Plan: Sign-in lands on the role home

## Summary

- Builds: after sign-in the person goes to the home page of their role, and a signed-in visitor of the sign-in page is sent there too, so the dead-end "signed in" screen is removed.
- Touches: `app/bejelentkezes/actions.ts`, `app/bejelentkezes/page.tsx`, `src/identity/copy.ts`, the sign-in tests in `tests/integration`, and the browser helper and specs in `tests/browser`.
- Tests: 2 regression unit tests that fail on today's code, plus a browser check of the menu for all four roles, and upkeep of the 12 browser waits and 1 unit test that pin the old screen.

## Context

Root cause (reproduced for super admin, group admin, teacher and parent): `signInAction` ends with `redirect("/bejelentkezes")` (`app/bejelentkezes/actions.ts:45`), and `SignInPage` (`app/bejelentkezes/page.tsx`) shows a signed-in visitor only a note and a sign-out button, outside every role layout. The page `/` (`app/page.tsx`) already sends a signed-in person to the home of their strongest role through `resolveProductionHome`, and shows panels (not another redirect) for the no-role and unavailable states, so redirecting to `/` cannot loop. Accounts, role grants and the menu code are correct.

Design: one rule for "where does this role belong" stays in `resolveProductionHome`. The action and the sign-in page both redirect to the fixed path `/`; no address from the request is used as a redirect target.

## Requirement traceability

| Requirement | Plan steps |
| --- | --- |
| FR1.1, FR1.2, FR1.3 | 3, 4, 8, 9, 10 |
| FR2.1, FR2.2, FR2.3 | 5, 6, 7 |
| FR3.1 | 9, 10 |
| FR4.1 | 3, 4, 11 |
| FR4.2 | 5, 6, 11 |
| FR4.3 | 8, 9 |
| NFR1 | 3, 5 (fixed internal path only) |
| NFR2 | 12 |
| NFR3 | 7 (copy removal), all tests in English |

Review points of the requirements review, handled here: a session the sign-in page reads as signed in while `/` reads it as signed out gives a "Bejelentkezés" link and no automatic loop (covered by a unit test of `app/page.tsx` that already exists, plus the new redirect test, Step 6); an expired or unavailable session counts as signed out and keeps the form (Step 6 test); the browser check asserts the role menu after sign-in (Step 10).

## Steps

- [x] **Step 1: Project structure and production configuration skeleton.** No new modules, folders or configuration. Create a short-lived branch only if the owner asks; nothing is committed or pushed without approval.
- [x] **Step 2: Verify the existing test runner and record the unit-scoped commands.** Run `npx vitest run tests/integration/identity-actions.test.ts tests/integration/identity-screens.test.tsx tests/unit/copy.test.ts` (path of the copy test confirmed in this step) to get the green baseline, and record the exact commands in `unit-test-instructions.md`.
- [x] **Step 3: API / endpoint - implement.** In `app/bejelentkezes/actions.ts` change the final `redirect("/bejelentkezes")` to `redirect("/")` and update the doc comment. Cookies are still written before the redirect.
- [x] **Step 4: API / endpoint - write and run its tests.** In `tests/integration/identity-actions.test.ts` change the post-sign-in expectation (line 122) from `"/bejelentkezes"` to `"/"` and keep the cookie assertions. This is the FR4.1 regression test.
- [x] **Step 5: Frontend behavior - implement.** In `app/bejelentkezes/page.tsx` redirect a visitor whose `currentSession()` is `signed-in` to `/`, remove the signed-in panel and the `SignOutButton` import, and keep the signed-out form and forgotten-password link unchanged.
- [x] **Step 6: Frontend behavior - write and run its tests.** In `tests/integration/identity-screens.test.tsx` replace the signed-in-panel expectation with: a signed-in session throws a redirect to `/` and renders nothing; a signed-out session and an `unavailable` session render the form (FR2.1, FR2.2). This is the FR4.2 regression test.
- [x] **Step 7: Remove the unused copy.** Delete `signedInHeading` and `signedInMessage` from `src/identity/copy.ts` and any test that only checked them (FR2.3); run typecheck so no reference remains.
- [x] **Step 8: Browser helper - implement.** In `tests/browser/support/seeded-schema.ts` change `signInAs` to open the sign-in page, sign out first when the visit was redirected away (an existing session), submit the form, and wait until the page left `/bejelentkezes` and shows the sign-out button. Add one exported helper `expectSignedIn(page)` with that wait for the specs to share.
- [x] **Step 9: Browser specs - update.** Replace the 12 waits for the removed signed-in panel in `identity.spec.ts` (8), `directory-coordination.spec.ts` (2), `notifications-import.spec.ts` (1) and `visual-overhaul.spec.ts` (1) with `expectSignedIn`, and adjust the assertions that read the removed heading so they check the role home instead (FR4.3).
- [x] **Step 10: Browser regression for the reported symptom.** Add a spec to `tests/browser/identity.spec.ts` that signs in as each seeded role and asserts the landing path and the menu: super admin `/admin` with 9 menu items, group admin `/admin` with 5, parent `/szulo/ertesitesek` with 3, teacher `/teacher/schedule` with no menu but the schedule heading and the sign-out button; the accessibility scan of the landing page reports no serious or critical violations (FR1, FR3).
- [x] **Step 11: Prove the regression tests fail before the fix.** Temporarily put back only the two production lines (Steps 3 and 5) and run the Step 4 and Step 6 tests to see them fail; restore the fix and see them pass. Record both outcomes in `code-summary.md`.
- [x] **Step 12: Quality gates and documentation.** Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run test:coverage`, `npm run build`, and the Chromium browser run of the changed specs with `VERIFY_BROWSER_PROJECTS=chromium`. Update `README.md` ("Run the application locally": after sign-in the app opens the home page of the role) and `HASZNALATI_UTMUTATO_HU.md` if it describes the old screen. Write `code-summary.md` and `traceability.json`.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "Implement each testable layer, then write and run its tests before moving to the next layer.",
  "scope": "bugfix",
  "test_strategy": "minimal",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: Implement each testable layer, then write and run its tests before moving to the next layer.\n\nWe write tests in the same change as the code and add a regression test for every defect. We enforce at least 80% line, branch, and function coverage across all production source.\n\nBefore merge, we require strict type checking, tests, a production build, deterministic start smoke, the critical browser flow, and dependency scanning that blocks high and critical findings. The critical browser flow must have no serious or critical automated accessibility violations. Provisioned integrations do not count as verified until they are exercised against their real targets."
    },
    {
      "layer": "project",
      "text": "- ALWAYS treat current executable test and coverage results as authoritative when historical summaries contain stale counts (learned 2026-08-06) \n- ALWAYS include security and performance instructions when explicit NFR or privacy risks require them, even under Standard strategy (learned 2026-08-06) \n- ALWAYS report provisioned environment checks as outstanding evidence until they are executed against real integrations (learned 2026-08-06) \n- ALWAYS block CI on high and critical dependency vulnerabilities (learned 2026-08-06)"
    }
  ],
  "obligations": {
    "strategy": "minimal",
    "strategy_volume": [
      "One verifiable test per requirement at the narrowest effective level.",
      "At least one happy-path unit test per component.",
      "Unit tests are the default; a bugfix/security scope floor may require an integration or E2E regression when that is the narrowest level that reproduces the defect."
    ],
    "scope_floor": [
      "Include a targeted regression for the bug or vulnerability.",
      "Keep the existing test suite green."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:0dbb24e082818d67bb4a2759f2e3b0e80eaa5e9ea8db6464cc687dc75ac9b9b8",
  "contract_sha256": "sha256:8e04002e90151bfcdb1fb4689b1f511c05063f263489bcef08e9e6f892efd023"
}
```
