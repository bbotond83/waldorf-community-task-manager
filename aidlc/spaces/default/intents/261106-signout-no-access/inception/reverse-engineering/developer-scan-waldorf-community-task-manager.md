# Developer Code Scan: no-access screens and sign-out (focused)

Head commit: `1672d981444bce3d9558b10e13e0a0a584df2dc6` (branch `main`). Read-only scan; no tests, builds or programs were run. Focus per the dispatch brief: the sign-in, role and "Nincs jogosultság" area.

## Developer Code Scan Results

### Scan Coverage
- **Analyzed deeply**:
  - `app/_identity/` (all seven files: `AccessStateExit.tsx`, `SignOutButton.tsx`, `actions.ts`, `shell-action.tsx`, `production-home.ts`, `production-request.ts`, `current-session.ts`)
  - `app/hozzaferes-megtagadva/page.tsx`
  - `app/page.tsx`
  - `app/szulo/layout.tsx`, `app/szulo/_lib/session.ts`, `app/szulo/_components/ParentAccessState.tsx`
  - `app/teacher/layout.tsx`, `app/teacher/_lib/session.ts`, `app/teacher/_components/TeacherAccessState.tsx`
  - `app/admin/layout.tsx`, `app/admin/_lib/session.ts`, `app/admin/_components/AdminAccessState.tsx`
  - `src/identity/copy.ts` (sign-out and no-access strings; copy test checked by name and the generic Hungarian test), `src/identity/session.ts`
  - `src/runtime/production/access.ts`, `src/runtime/AppShell.tsx`, `src/runtime/BackToHomeLink.tsx`
  - `proxy.ts`
  - `tests/coverage/app-entrypoints.test.tsx` (lines 60-135, plus a grep of the file), `tests/coverage/parent-pages.test.tsx` (lines 228-257), `tests/coverage/app-session-boundaries.test.ts` (lines 25-60)
- **Skimmed only**:
  - `src/access/` (import sites and `index.ts`; `role-policy.ts` used by `src/application/authorization.ts`, `types.ts` as type source; the rest not read)
  - `src/identity/` sign-in, cookies, service, refresh and mail modules (not opened)
  - `src/runtime/` navigation, composition, config, database (not opened); `AppNav.tsx` and `StatusBadge.tsx` by name
  - `app/szulo/`, `app/teacher/`, `app/admin/` other pages (by name)
  - `tests/coverage/` other files (grep for denied and sign-out terms only)
- **Left out**: `.claude/`, `.kiro/`, `.codex/`, `.cursor/`, `.opencode/`, `.aidlc/`, the `aidlc/` workspace, AI-DLC generated runner files under `.github/` and `.agents/`; `node_modules/`, `.next/`, `coverage/`, `test-results/`, `playwright-report/` (ignored by `.gitignore`).

### Packages Found
- `app/` — Next.js App Router routes and role layouts — TypeScript/TSX — pages, server actions, access-state components
- `app/_identity/` — shared identity UI and actions — TypeScript/TSX — sign-out, home resolution, session per request
- `src/identity/` — sign-in and session logic, Hungarian copy — TypeScript
- `src/runtime/` — composition, role access resolvers, shell — TypeScript/TSX
- `tests/coverage/` — Vitest render tests of entry points — TypeScript/TSX

### Build System
- **Type**: npm project with Next.js (not re-read in this run; `package.json` was not opened)
- **Config Files**: `proxy.ts` (request proxy, read); `package.json` and `next.config.ts` referenced only
- **Build Dependencies**: not checked in this run

### APIs Discovered
- Server action `signOutAction` — `app/_identity/actions.ts` — 1 action, no arguments; clears cookies and redirects to `/bejelentkezes`
- Pages on the no-access path: `/` (`app/page.tsx`), `/szulo/*`, `/admin/*`, `/teacher/*` (layouts), `/hozzaferes-megtagadva` (static page)

### Frameworks & Libraries
- Next.js App Router — server components, `redirect`, `cookies()`, `cache` from React — no version checked
- React `useFormStatus` in `SignOutButton.tsx` (line 3, 8) — client component
- `server-only` import guard in server modules

### Test Coverage
- **Test Directories**: `tests/coverage/`, `tests/integration/` (not opened in this run), `tests/browser/` (not opened in this run)
- **Test Frameworks**: Vitest (coverage tests), Playwright (browser; named in the store, not checked now)
- **Coverage Config**: not checked in this run

### Code Quality Indicators
- **Linting**: not checked in this run
- **CI/CD**: not checked in this run
- **Documentation**: JSDoc on the sign-out action, `AccessStateExit`, `production-home.ts` and `production/access.ts`; doc comments explain the denied result states

### Technical Debt Signals
- `app/hozzaferes-megtagadva/page.tsx` has no inbound redirect in `app/` or `src/`; only `tests/coverage/app-entrypoints.test.tsx` (lines 6, 119-131) renders it. Possibly dead, and the only no-access screen with no sign-out.
- Five separate "Nincs jogosultság" renderings with duplicated markup (`ParentAccessState.tsx`, `AdminAccessState.tsx`, `TeacherAccessState.tsx`, the static page, `TeacherStatePanel`).
- `AccessStateExit` is shown for `configuration-error` too, but without guidance (`ParentAccessState.tsx` line 42, `AdminAccessState.tsx` line 39, `TeacherAccessState.tsx` line 24). The guidance text says "a csoport adminisztrátorától" and "jelentkezzen ki", which is wrong advice for a configuration problem; the guidance flag is what keeps it off.
- Hard-coded Hungarian strings inline in role pages (`COPY` is used only for identity features).
- Expired access token on page render: `src/identity/session.ts` line 49 returns signed-out when `canPersist` is false, so a denied account whose token has just expired sees "Bejelentkezés szükséges" with no sign-out button.

## Sign-out per no-access screen (HEAD 1672d98)

| Screen | Heading | Sign-out | Guidance | File and line |
|---|---|---|---|---|
| Parent area, `denied` | Nincs jogosultság | yes | yes | `app/szulo/_components/ParentAccessState.tsx` lines 22-44, `AccessStateExit` line 42 |
| Parent area, `configuration-error` | Nincs jogosultság | yes | no | same, line 42 |
| Parent area, `signed-out` | Bejelentkezés szükséges | no (login link) | no | same, lines 11-21 |
| Admin area, `denied` | Nincs jogosultság | yes | yes | `app/admin/_components/AdminAccessState.tsx` line 39 |
| Admin area, `configuration-error` | Az adminisztráció nem érhető el | yes | no | same, line 39 |
| Teacher area, `denied` | Nincs jogosultság | yes | yes | `app/teacher/_components/TeacherAccessState.tsx` line 24 |
| Teacher area, `configuration-error` | Nincs jogosultság | yes | no | same, line 24 |
| Static page `/hozzaferes-megtagadva` | Nincs jogosultság | no | no | `app/hozzaferes-megtagadva/page.tsx` lines 4-15 |
| Home `/`, role-less account | Biztonságos bejelentkezés | yes | "Ehhez a fiókhoz még nem tartozik szerepkör..." | `app/page.tsx` lines 31-38 |

Guidance source: `COPY.noAccess.guidance` in `src/identity/copy.ts` lines 25-28 (text: "Ehhez a fiókhoz nem tartozik megfelelő profil. Kérje a csoport adminisztrátorát, hogy kapcsolja össze a fiókját, vagy jelentkezzen ki, és lépjen be másik fiókkal."). Sign-out button label: `COPY.signOut` lines 21-24.

Role-to-screen routing for an account with a role but no linked parent record: `resolveParentAccess` returns `denied` (`src/runtime/production/access.ts` line 111). The home path of its role is the parent home (`homeOf`, lines 59-64), so `/` redirects to `/szulo/ertesitesek` (`app/page.tsx` line 17) and the parent layout shows the denied screen with sign-out and guidance. The home link is hidden there (`ParentAccessState.tsx` line 35).

Account with no grant at all: each area shows its denied screen with sign-out; its home link goes to `/`, which shows the role-less panel with sign-out. No loop.

Admin and teacher layouts redirect a signed-out visitor to `/` (`app/admin/layout.tsx` line 12, `app/teacher/layout.tsx` line 12). The parent layout does not redirect; it shows the signed-out state with the login link.

## Tests covering these screens

- `tests/coverage/parent-pages.test.tsx` lines 237-248: "gives a parent with a role but no linked record the guidance and a way to sign out" (asserts heading, `access-guidance`, `sign-out-button`, no home link). Regression comment at line 238.
- `tests/coverage/parent-pages.test.tsx` lines 249-257: role layout, denial and configuration error (asserts the layout does not render children for a teacher or when unavailable; does not assert sign-out).
- `tests/coverage/app-entrypoints.test.tsx` lines 72-79: role-less account at `/` shows `production-no-role` and "Kijelentkezés".
- `tests/coverage/app-entrypoints.test.tsx` lines 119-131: static page `/hozzaferes-megtagadva` checked for `href="/"` and the brand link only; no sign-out assertion.
- `tests/coverage/app-session-boundaries.test.ts` lines 25-37 and 55: resolvers return `denied` with the right `homePath` (for example parent on admin gets `/szulo/ertesitesek`), and an empty parent grant list gives `denied`.
- No file in `tests/coverage` renders the admin or teacher denied screens (`AdminAccessState`, `TeacherAccessState`).
- `src/identity/copy.test.ts`: generic check that every COPY string is non-empty Hungarian (no English words); covers the guidance text by that rule, not by content.
- Not opened in this run (from the store): `tests/integration/parent-components.test.tsx` and `admin-components.test.tsx` (denied blocks), `identity-screens.test.tsx` (`SignOutButton`), `production-home.test.tsx` (no-role panel), and `tests/browser/identity.spec.ts` (denied page guidance and sign-out).

## Handoff Summary
- **Intent-relevant finding**: The sign-out button and the Hungarian guidance already exist on the parent, admin and teacher "Nincs jogosultság" screens (`AccessStateExit`, `app/_identity/AccessStateExit.tsx` lines 8-15, added in `78a0ab5`), and on the role-less home panel (`app/page.tsx` lines 31-38). The one no-access screen without any exit is the static page `app/hozzaferes-megtagadva/page.tsx` (lines 4-15). The intent therefore points at that page, unless the owner means the configuration-error screens, which already show sign-out without guidance.
- **Risks / follow-up**:
  - The guidance text tells the person to "jelentkezzen ki" and to contact the group administrator. It is shown only for `denied`, not for `configuration-error`, which keeps the advice correct there. Any new text must keep that split.
  - `ParentAccessState` is also what a teacher or admin sees on a parent page. The sign-out and guidance there must stay correct for them (existing specs click "Vissza a beosztáshoz"; testids and labels must stay stable).
  - The static page is the only candidate for the change and has no inbound redirect. Its sign-out, if added, should reuse `SignOutButton` from `app/_identity/SignOutButton.tsx` (client component, `signOutAction`), with the same `COPY.signOut` label.
  - Any change keeps the single `<h1>` and the `id="hozzaferes-megtagadva"` focus target on the denied sections (`src/application/results.ts` and `facade-pipeline.ts` point at it); axe serious and critical rules block the critical flow.
  - Expired-token case: a denied account with an expired access token sees the signed-out state without sign-out (`src/identity/session.ts` line 49). Not changed by this intent unless the owner asks.
