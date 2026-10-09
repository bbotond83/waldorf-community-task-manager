# Code Quality Assessment

## Testing

- Layers: colocated domain tests (`src/**/*.test.ts`, node:test), Vitest `tests/unit|integration|coverage`, Playwright `tests/browser` on three projects, DB migration tests.
- Coverage: 80% lines/branches/functions enforced across production sources (`vitest.config.ts`; `tests/coverage/support/production-inventory.ts` enumerates files, so new production files need tests).
- Accessibility: `@a11y`-tagged axe checks in `runtime-foundation`, `admin-core`, `admin-advanced`, `teacher-web` specs (serious/critical must be zero).
- Tests that assert on the UI affected by the intent:
  - `tests/integration/runtime-shell.test.tsx` lines 12, 13, 61, 91: button role named "Profil használata" (four), `profile-selector-<id>-button`, `type="submit"`, form `method=post` / `action=/api/synthetic/session`.
  - `tests/browser/{runtime-foundation,teacher-web,admin-core,admin-advanced,parent-web}.spec.ts` and `support/profile-login-measurement.ts:110`: click `profile-selector-<id>-button`.
  - `tests/browser/parent-web.spec.ts:62-63`: `duty-card-<id>` visible then click `duty-open-<id>`.
  - `tests/browser/admin-core.spec.ts:32`, `admin-advanced.spec.ts:97,114`, `profile-login-measurement.ts:28,58-61`: dashboard test IDs `admin-dashboard-page`, `-summary`, `-records-state`, `-tasks-state`, `-queue-state`.
  - No test asserts the literal "Részletek" text; `tests/coverage/parent-pages.test.tsx` covers the detail pages only.

## Linting and Formatting

ESLint (zero warnings) and Prettier are blocking, but scripts cover only `app src/application src/runtime tests scripts *.config.* proxy.ts` (verification and other `src/*` folders are excluded).

## CI/CD

`.github/workflows/ci.yml`: `verify:local` (typecheck, lint, format, tests, coverage, build, start smoke, browser, a11y, security scans) then SBOM/build-evidence artifacts. Actions pinned by SHA.

## Documentation

`README.md`, Hungarian guide `HASZNALATI_UTMUTATO_HU.md` (mentions "Profil használata" at line 26 and "Részletek" at line 97), `verification/RUNBOOK.md`.

## Technical Debt

- `latest` ranges for react, react-dom, zod and dev tools.
- Monolithic 857-line `app/globals.css`; literal colours (`#eef6fb`, `#fff1ed` at lines 329, 334, 461, 467, 600, 787 and `rgb()` in `body` and `--shadow`); `overflow-wrap: anywhere` on headings and paragraphs causes mid-word breaks of long Hungarian words; no typography tokens.
- Duplicate "Részletek" link implementations (parent page, admin `ResponsiveCollection`).
- Dashboard cards are not navigable although target list routes exist.
- Contrast of `--color-primary #8c3f2f`, `--color-muted #655d53` on surfaces passes today; any new palette must be rechecked against axe.
- `public/` untracked in git at scan time; `next-env.d.ts` shows as modified.
