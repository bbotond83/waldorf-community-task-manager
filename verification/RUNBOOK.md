# Local Acceptance Runbook

## Environment

1. Use Node 24.x and npm 11.x (`nvm install 24 && nvm use 24`).
2. Copy `.env.example` to `.env.local`; keep `APP_RUNTIME_MODE=synthetic` and fixture `waldorf-local-v1`.
3. Run `npm ci` from a fresh checkout and `npx playwright install chromium firefox` when browser binaries are absent.
4. Run `npm run verify:local`.

The command performs locked local installation-independent acceptance and calls only loopback. For a literal clean-install rehearsal, remove or relocate `node_modules` outside the repository, run `npm ci`, then execute the command. Do not add real credentials or personal data.

### macOS browser execution

Run browser verification from a terminal with permission to launch native applications. When running through Codex, request execution outside its filesystem/process sandbox for `npm run test:browser` or `npm run verify:local`; a sandboxed launch can abort Firefox during application registration and deny Chromium's Mach service registration.

On macOS, the Firefox project writes `waldorf-application.ini` beside the bundled browser's resources in Playwright's browser cache and selects it with `XUL_APP_FILE`. This keeps Gecko's application-data directory separate from personal Firefox data and addresses the macOS 27 startup hang tracked in [Playwright issue #42768](https://github.com/microsoft/playwright/issues/42768). The bundled browser executable and its sandbox settings remain intact. Install the browser revision matching the locked Playwright package before running verification. A launch failure remains a failed check; do not report skipped browser tests as passed.

## Profile routes

- Parent: `/szulo/feladatok`, `/szulo/ertesitesek`, invitation/authentication entry.
- Read-only Staff: `/munkatars/beosztas` with scoped filters and generic denials.
- Group Administrator: `/admin`, records/tasks/approvals/archive; direct import is denied.
- Kindergarten Administrator: core plus import/reminders/privacy/settings, excluding super-admin governance.
- Super Administrator: organization-wide administration and governance/revocation.

Use `Tesztprofil váltása` between profiles. Browser automation uses a synthetic reset endpoint through the public same-origin HTTP boundary; it does not import private repositories or bypass authorization.

## Result interpretation

- `PASS`: a mandatory local scenario actually ran against the current SHA/fixture/manifest and exited successfully.
- `FAIL`: a mandatory local command or scenario ran and failed; acceptance stops.
- `OUTSTANDING`: Safari or a real Supabase/provider/Vercel target was not executed. Synthetic success cannot upgrade it.

Reports are `verification/reports/local-acceptance.json`, `local-acceptance.md`, and `outstanding-targets.md`. Missing, duplicate, stale, mismatched, privacy-unsafe, or linked-target `PASS` evidence fails aggregation.

## Safari and linked targets

On supported Apple hardware, record Safari desktop and mobile Safari entry/navigation, Parent signup, Staff read/denial, Administrator approval, validation, keyboard/focus, and accessibility outcomes with browser/version/device metadata. Real Supabase auth/RLS/object/revocation/transactions, durable scheduler/provider delivery, and Vercel preview/staging remain a future approved repeat set. Do not run deployment commands as part of this runbook.
