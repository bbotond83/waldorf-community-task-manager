# Code Generation Plan: sign-out and guidance on the "Nincs jogosultság" screens

## Summary

- Builds: a shared "exit" block (short Hungarian guidance plus the existing sign-out button) on the parent, teacher and admin denied screens, and hides the "back" link where it only reloads the same screen.
- Touches: `src/identity/copy.ts`, a new `app/_identity/AccessStateExit.tsx`, the three `*AccessState.tsx` components, and their tests plus one browser spec.
- Tests: about 12 vitest tests (one per requirement, plus the regression) and 1 Playwright test with an accessibility check.

## Scope and traceability

Zero-Unit work (express): one implementation iteration, no Unit directory. Requirements: `inception/requirements-analysis/requirements.md`.

| Requirement | Plan steps |
|---|---|
| FR1 Sign-out on the denied screens (FR1.1 reuse, FR1.2 behaviour, FR1.3 every variant) | 3, 4, 6, 8 |
| FR2 Short Hungarian explanation (FR2.1 not on configuration error, FR2.2 independent of the link) | 2, 3, 4, 6 |
| FR3 Looping "back" link on the parent screen (FR3.1 shown when it leads elsewhere) | 5, 6 |
| FR4 No regressions (heading, id, test ids, static page, no-role branch) | 6, 7, 9 |
| NFR1 Accessibility | 8 |
| NFR2 Language | 2 |
| NFR3 Quality gates | 9 |
| NFR4 Tests with the change, regression test | 3, 6, 8 |
| NFR5 Security (reuse of the existing action only) | 3 |

## Design decisions

- Reuse `SignOutButton` and `signOutAction` unchanged. A small shared server component `AccessStateExit` renders the guidance paragraph (only when asked) and the button, so the copy and the button live in one place for all three screens.
- Guidance copy goes in `COPY` (`src/identity/copy.ts`), next to the existing `signOut` copy. Draft text (assumption A2, owner to confirm): "Ehhez a fiókhoz nem tartozik megfelelő profil. Kérje a csoport adminisztrátorát, hogy kapcsolja össze a fiókját, vagy jelentkezzen ki, és lépjen be másik fiókkal."
- Variants: `denied` shows guidance and button; `configuration-error` shows the button only; `signed-out` shows neither (nobody is signed in).
- Back link: on the parent screen it is hidden when `homePath` points inside `/szulo` (any such page renders the same denied screen). The admin screen applies the same rule for `/admin`. The teacher screen receives no home path from its session today, so its link ("/") is left unchanged. This narrows assumption A3 and is recorded in the code summary.
- Existing ids, headings, test ids and link labels stay unchanged.

## Steps

- [x] Step 1: Project structure and production configuration skeleton. No new folders, packages or configuration; the new file sits beside `SignOutButton.tsx` in `app/_identity/`.
- [x] Step 2: Verify the existing test runner and record the exact command (`npx vitest run --project delivery <test file paths>`; see `unit-test-instructions.md`). Add the guidance text to `COPY` in `src/identity/copy.ts` (Hungarian copy, English key `noAccess.guidance`).
- [x] Step 3: Frontend behavior, shared block - implement `app/_identity/AccessStateExit.tsx` (props: `explain: boolean`; renders `<p data-testid="access-guidance">` when true, then `<SignOutButton />`). Then write and run its tests in `tests/integration/access-state-exit.test.tsx` (renders guidance and button; omits guidance when `explain` is false; submitting the form calls the mocked `signOutAction`).
- [x] Step 4: Frontend behavior, screens - wire `AccessStateExit` into `ParentAccessState` (denied: explain; configuration-error: button only), `TeacherAccessState` (same rule; not for signed-out) and `AdminAccessState` (denied: explain; configuration-error: button only; works in the embedded and full-page forms). Keep the `Nincs jogosultság` heading, ids and test ids. Then write and run their tests (extend `tests/integration/parent-components.test.tsx`, `admin-components.test.tsx` and the teacher state test where it lives).
- [x] Step 5: Frontend behavior, back link - hide the parent link when `homePath` starts with `/szulo` and the admin link when it starts with `/admin`; show it as before otherwise. Then write and run the tests (regression: a parent with a role but no linked record sees guidance and sign-out and no looping link; a teacher who opened a parent page still sees "Vissza a beosztáshoz").
- [x] Step 6: Page and layout behavior - add a page-level test in `tests/coverage/parent-pages.test.tsx` using the request double in `tests/support/request-world.ts` (parent grant, no linked parent record): the layout output contains `sign-out-button`, the guidance and no `parent-access-home-link`. This is the regression test: it fails on the current code (no button, link present) and passes after the change.
- [x] Step 7: Confirm the unchanged areas - the static page `app/hozzaferes-megtagadva/page.tsx` and the no-role branch of `app/page.tsx` are not edited; run their existing tests.
- [x] Step 8: Browser behavior - add one Playwright test in `tests/browser/identity.spec.ts` (or a new colocated spec if cleaner) using a purpose-made account with a parent grant and no `parents` row: after sign-in the "Nincs jogosultság" screen shows the guidance and the sign-out button, axe reports no serious or critical violations, and clicking sign-out returns to the sign-in page. Run it on a development port other than 3000.
- [x] Step 9: Environment/build configuration and checks - run `npm run format:check`, `npm run lint`, `npm run typecheck`, the delivery tests, `npm run test:coverage` (80% floor, no threshold change) and the production build.
- [x] Step 10: Documentation and traceability - write `code-summary.md` and `traceability.json` (every FR sub-requirement and NFR mapped to a file).

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "Implement each testable layer, then write and run its tests before moving to the next layer.",
  "scope": "express",
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
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
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
  "input_sha256": "sha256:3d292c6045d13da5e4d7456ce512bed1710e7c19d4cd1fcfbb8c23797b5346c2",
  "contract_sha256": "sha256:ccfc2d241c3297baee8acc2adf0300e8dd8d3a3c089e4a5c084dd757a212e135"
}
```
