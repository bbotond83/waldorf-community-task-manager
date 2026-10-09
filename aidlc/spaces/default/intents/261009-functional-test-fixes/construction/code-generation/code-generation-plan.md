# Code Generation Plan: Functional test fixes

## Summary

- Builds: notifications that stay under Értesítések, get marked read when opened and look greyed out when read; Értesítések first in the parent menu; back links, matching status filters and form messages in the admin area; pending-request notices for parents; demo and technical text moved out of normal screens.
- Touches: `app/szulo/` (notification list, task detail, request pages, actions), `src/parent-web/synthetic-parent.ts`, `src/runtime/` (`AppNav.tsx`, `synthetic/profiles.ts`, new small components), `app/admin/` (detail pages, new forms, filter bar, reminders and privacy pages), `app/globals.css`, `playwright.config.ts` (test-mode switch), about 20 existing tests and the user guide.
- Tests: about 6 new test files (helpers, component, page-render) and updates to about 20 existing ones, plus two Playwright journey specs (notification journey, pending request) on chromium, firefox and mobile-chrome.

## Scope and Blast Radius

Zero-Unit work (bugfix scope, no Unit DAG). Source: `requirements.md` (FR1 to FR9, NFR1 to NFR7) and the scan handoff `inception/reverse-engineering/developer-scan.md`. No business rule, authorization matrix, page guard or data model changes. The review points of the requirements stage are settled here:

- R-01 (marking read on a prefetch or reload): the task page marks a notification read only from a small client component (`MarkNotificationRead`) that runs after the page has really been opened in the browser (an effect on mount), never during server rendering, so a link preview or prefetch cannot trigger it. The action revalidates `/szulo/ertesitesek` so that returning by link or the Back button shows the read state.
- R-02 (id of another task): the notification context applies only when the notification belongs to the signed-in parent and its target is this task; otherwise the page behaves as opened from the task list (no marking, "Feladatok" current, back link to the task list).
- R-03: a notification whose target is the notification list itself (the stale one) keeps linking to the list without context and is never marked read by opening; only its checkbox marks it.
- R-04: when both a swap and a cancellation request are pending, the task page shows both notices, one line each.
- R-05: required-field limits are the existing ones in `app/admin/actions.ts` (`normalizeRequiredText`, 120 characters for titles); the new messages name the limit.
- R-06: the approvals filter offers Függőben, Jóváhagyva and Elutasítva (the decision action can reject, so rejected items exist after use); a unit test checks that every offered value is a valid status for that list's type and that every value present in the demo data is offered.

| File or group | Consumers / tests | Impact |
|---|---|---|
| `src/parent-web/synthetic-parent.ts` (duty and notification fixtures, request state) | `tests/browser/parent-web.spec.ts` (`projectSuffix`), `tests/coverage/parent-*.test.ts*`, `app/szulo/*` | high: per-browser copies move behind a test-mode switch |
| `playwright.config.ts` and the start scripts it uses | all browser specs | medium: sets the test-mode environment variable for the test servers |
| `src/runtime/synthetic/profiles.ts` (parent menu order) | `tests/unit/runtime-boundaries.test.ts:34-35`, `navigation-access.test.ts`, `runtime-shell.test.tsx`, `tests/browser/support/profile-login-measurement.ts`, `navigation-polish.spec.ts` | medium |
| `src/runtime/AppNav.tsx` | `app-nav.test.tsx`, shell tests | medium: current item can come from the notification context |
| `app/szulo/ertesitesek/page.tsx`, `_components/NotificationReadForm.tsx`, `actions.ts` | `notification-read-form.test.tsx`, `parent-pages.test.tsx`, `parent-actions.test.ts`, `parent-web.spec.ts`, `navigation-polish.spec.ts` | medium |
| `app/szulo/feladatok/[id]/page.tsx`, `csere/`, `lemondas/` | `parent-pages.test.tsx`, `parent-components.test.tsx`, `parent-web.spec.ts` | medium |
| `app/admin/_components/AdminFilterBar.tsx` and four list pages | `admin-components.test.tsx`, `admin-pages.test.tsx`, `navigation-polish.spec.ts:160-171`, `admin-core.spec.ts` | medium |
| `app/admin/**/[id]/page.tsx`, `nyilvantartasok/uj`, `feladatok/uj`, `AdminMutationForm` | `admin-pages.test.tsx`, `admin-actions.test.ts`, `admin-core.spec.ts`, `admin-advanced.spec.ts` | medium |
| `app/admin/emlekeztetok`, `adatvedelem`, `feladatok/[id]`, `nyilvantartasok/[id]` (technical text) | `admin-advanced.spec.ts:79` and other specs that read "Korreláció", scenario selects and "Verzió" | medium |
| `app/globals.css` | every page; axe `@a11y` specs; `tests/unit/design-tokens.test.ts` | high (cross-cutting) |
| `tests/coverage/production-inventory.test.ts` | asserts an exact production file count | low, must be updated |

Rules kept: stable `data-testid` hooks stay wherever the element survives; copy is Hungarian, identifiers English; no new remote origins; the existing design tokens are reused (any new colour is added as a token and checked by the contrast test). Commands need Node 24 and npm 11 first on `PATH`: `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.

## Implementation Steps

- [x] Step 1: Project structure and configuration skeleton. Confirm branch `feature/functional-test-fixes`; no dependency change. Do not commit anything.
- [x] Step 2: Verify the existing test runner and record the baseline: run the commands in `unit-test-instructions.md` (baseline section) before editing anything and record pass counts in `code-summary.md`.
- [x] Step 3: Data layer (demo data) - implement (FR8.1). In `src/parent-web/synthetic-parent.ts`, create the per-browser copies (duty-garden-firefox/-mobile, duty-assigned-firefox/-mobile, notice-7-day-firefox/-mobile) only when the test-mode switch is on (environment variable `SYNTHETIC_TEST_COPIES=1`, read once through the existing runtime configuration pattern); `resetSyntheticParentState` honours it. Set the variable in the Playwright web server environment (`playwright.config.ts`, and the login-performance config if it starts its own server).
- [x] Step 4: Data layer - write and run tests. Unit test for the fixture builder: switch off gives only the base entries (no "próba" titles), switch on gives the base entries plus the copies. Update `tests/coverage/parent-*.test.ts*` where they count entries. Verify `tests/browser/parent-web.spec.ts` still isolates per project (suffix helper) with the variable set.
- [x] Step 5: Business logic - implement (FR1, FR2, FR7). Pure helpers in `src/parent-web/` (or `src/application/` where facades live): `resolveNotificationContext(parentNotifications, notificationId, dutyId)` returning the notification only when it belongs to the parent and targets that duty (R-02, R-03); `pendingRequests(duty)` returning which of swap and cancellation are pending (R-04); the parent duty state label moved to the shared label source (`src/application/status-labels.ts`, FR7.4) so the list and detail page use one map. `markNotificationRead` stays the single write path and stays idempotent.
- [x] Step 6: Business logic - write and run tests. Node-runner tests for the helpers: own notification for this duty resolves; foreign id, unknown id, other duty's id and the stale (list-targeted) notification do not; both pending; none pending; the shared label map covers every parent duty state.
- [x] Step 7: API and actions - implement (FR2.1, R-01). `markNotificationReadAction` in `app/szulo/actions.ts` calls `revalidatePath("/szulo/ertesitesek")` (and the task page path) after marking; it stays safe to repeat. A thin action or the same action is used by the new `MarkNotificationRead` client component. Request actions keep their result states.
- [x] Step 8: API and actions - write and run tests. Extend `tests/coverage/parent-actions.test.ts`: marking twice is a success with no change, revalidation is called, denied and validation results are unchanged.
- [x] Step 9: Frontend, parent - implement (FR1, FR2, FR3, FR4, FR7). Menu order in `src/runtime/synthetic/profiles.ts`: Értesítések, then Feladatok. Notification cards link to the task page with `?ertesites=<id>` (only for task-targeted notifications; the list-targeted one links to the list). `app/szulo/feladatok/[id]/page.tsx` resolves the context with the helper: with it, the back link reads "Vissza az értesítésekhez" and goes to `/szulo/ertesitesek`, and the page renders `MarkNotificationRead` (client component, marks on mount, ignores failure, shows nothing); without it, today's behaviour. `AppNav.tsx` marks "Értesítések" current when the parent is on a task page opened with a valid notification context (a small `currentNavigationId` rule using the search parameter, inside a Suspense boundary). A read notification card gets a `notification-card-read` class: muted text, greyer background, text "Olvasott" kept; `app/globals.css` adds the tokens and keeps contrast at 4.5:1 and 3:1. The task page shows pending notices ("Cserekérelem folyamatban", "Lemondási kérelem folyamatban") and hides both request links while any request is pending; the request pages show the notice and a back link to the task instead of the form; after a successful submit the form shows its confirmation and replaces itself with the notice and link.
- [x] Step 10: Frontend, parent - write and run tests. Update `tests/unit/runtime-boundaries.test.ts`, `navigation-access.test.ts`, `tests/integration/runtime-shell.test.tsx`, `app-nav.test.tsx` (order, current item with and without context); extend `notification-read-form.test.tsx` and add a `MarkNotificationRead` component test (marks once on mount, ignores failure); extend `tests/coverage/parent-pages.test.tsx` (context back link, no context back link, read card class and text, pending notices, hidden links, request page notice) and `parent-components.test.tsx`.
- [x] Step 11: Frontend, admin - implement (FR5, FR6, FR8, FR9). `AdminFilterBar` takes the list's status options as a prop; each list passes its own (records: active, archived; tasks and events: open, scheduled; approvals: pending, approved, rejected), labels from the shared label map, "Minden állapot" first; an unknown status value in the address shows the unfiltered list with a short Hungarian note (FR6.3). A small shared `AdminBackLink` component (Hungarian label per list, keeps the list's filter and page when the list address is known) is rendered in the header of every admin detail page and both "new" forms; `AdminMutationForm` shows the list link beside its success message (FR5.3). A shared `DeveloperDetails` component (a collapsed `details` titled "Fejlesztői részletek") holds the "Korreláció" line, the scenario selects ("Kapacitási helyzet", "Forgatókönyv") and "Verzió: N", keeping every field name, hidden input and test id as is. `saveRecordAction` and `saveTaskAction` return field-level Hungarian messages for empty and too-long titles (limit named), and `AdminMutationForm` shows them next to the field and in the summary, announced, with focus moved.
- [x] Step 12: Frontend, admin - write and run tests. Update `tests/integration/admin-components.test.tsx` and `admin-pages.test.tsx` (back link per page, per-list filter options, unknown status note, developer section collapsed and containing the technical text, no technical text outside it), `admin-actions.test.ts` (empty and long title messages), and a unit test that every offered filter value is a valid status for its list and every demo status is offered (R-06).
- [x] Step 13: Browser journeys - write and run. New `tests/browser/functional-fixes.spec.ts`: (a) notification journey: open a notification, menu keeps Értesítések current, back link goes to the list, the notification shows read and greyed, tick another and reload persists; (b) pending request journey: submit a swap, see the confirmation and the notice, no second submit, links hidden; (c) admin: every detail page and both new forms show a back link that returns to the list; each list's filter options return results or an explicit empty state only by user action; empty submit of both new forms shows the message; (d) no "próba" entries in the demo lists and no technical text outside "Fejlesztői részletek". Update `parent-web.spec.ts`, `navigation-polish.spec.ts` (:160-171 filter options, :175-210 notification card), `admin-core.spec.ts` and `admin-advanced.spec.ts` (open "Fejlesztői részletek" before reading "Korreláció", scenario selects and "Verzió"). Run on chromium, firefox and mobile-chrome after `npm run build`; the `@a11y` tests stay free of serious and critical findings and also load the changed pages.
- [x] Step 14: Environment and build configuration. Update `tests/coverage/production-inventory.test.ts` for the new production files; run `npm run lint`, `npm run format:check` (format first with Prettier where needed) and `npm run typecheck`.
- [x] Step 15: Documentation and traceability. Update `HASZNALATI_UTMUTATO_HU.md` (notifications open under Értesítések and are marked read, menu order, back links, filters, pending requests, "Fejlesztői részletek"); write `code-summary.md` (files, decisions R-01 to R-06, deviations, baseline counts) and `traceability.json` mapping every FR and NFR id to an existing file.

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
