# Practices Discovery Evidence

Lead-only run by the pipeline-deploy lead, 2026-11-08, on a brownfield re-run, integrated after the owner's interview (`practices-discovery-questions.md`). No checks or tests were run for this stage; it records what the files and repository settings show and what the owner decided.

## What Was Inspected

**Knowledge-base files** (reverse-engineering output, `aidlc/spaces/default/codekb/waldorf-community-task-manager/`):

| File | Used for |
|---|---|
| `code-structure.md` (code-structure) | Database use-case template, styling hooks, naming and grant conventions. It says 41 migration files; the folder holds 40. |
| `technology-stack.md` (technology-stack) | Versions, what is switched off, no scheduler, no deployment, the 1000-row limit |
| `dependencies.md` (dependencies) | Pinned and floating packages, migration order facts, pairs of files that must change together |
| `code-quality-assessment.md` (code-quality-assessment) | Blocking gates, test layers, debt, risk notes for this work, `src/access/` outside lint and format |
| `architecture.md` (architecture) | Rules in Postgres, no direct table writes, row-level security, lock order, forward-only migrations |
| `business-overview.md` (business-overview) | Roles, business rules, fit against the spreadsheet workflow |

**Repository and GitHub:**

- `.github/workflows/ci.yml`; `scripts/verification/run-local-verification.ts`, `scan-core.ts`, `privacy-allowlist.json`
- `package.json` scripts and versions, `vitest.config.ts`, `playwright.config.ts`, `stylelint.config.mjs`, `.gitignore`, `proxy.ts`, `app/layout.tsx`, `DESIGN.md`, README deployment section
- `tests/unit/dependency-pins.test.ts`, `tests/database/stack-support.ts`, `scripts/db/shuffled-tests.ts`, `scripts/db/local-guard.ts`, `scripts/db/runner.ts`
- Git history of `main` (60 commits), the six merged pull requests since the repository went public, recent CI runs, the "Protect main" ruleset
- `aidlc/spaces/default/knowledge/documents/ovis-tabla-gap-analysis.md` (owner decisions); `.claude/scopes/aidlc-classic.md` (`skeleton: off`); the promotion code in `.claude/tools/aidlc-state.ts`

The real workbook, the anonymised copy, `~/Private` and `.env*` files were not opened.

**What this shows about how the team works:**

- **Branching:** one trunk. Pull requests #1 to #6 are single squash commits from short-lived branches named `feat/`, `fix/`, `docs/`, `ci/`. Numbering restarted at #1 when the repository went public on 2026-11-02. Older history (to #21) has merge commits; squash has been used since #22.
- **Enforcement:** the ruleset requires a pull request and the `Validate` check on `main`, with no force push or deletion. No approving review is required, all three merge methods are allowed, and repository admins can bypass the pull-request rule.
- **Cadence:** a merge every one to two days in recent weeks. Pull-request CI took about 27 to 47 minutes.
- **Environments:** one, local. Nothing deploys.

## Interview Decisions

| Question | Owner's decision | Where it landed |
|---|---|---|
| Q1. Where the real app will live | B. Hosted online as a separate piece of work afterwards. This work ends with everything working on the owner's computer. The migration script is built and tested in this work; loading real data into a hosted app belongs to the later piece. The local stack must not hold real data for go-live purposes. | `team-practices.md` Deployment |
| Q2. The standing deploy rule | A. Reword it so it applies only once a hosted site exists. | `team-practices.md` Deployment; new Mandated rule |
| Q3. Thin first slice | A. Yes: one community-wide rota, from the database to the parent's screen, checked by the owner before the rest is built. | `team-practices.md` Walking Skeleton |
| Q4. Half-finished features | A. Yes, they may be visible on `main` while only the owner runs the app. | `team-practices.md` Way of Working |
| Q5. Testing database rules | A. A fixed must-have list for every database rule (allowed, refused, out of reach, outdated screen, repeated click, two people at once); 80% coverage stays for application code. | `team-practices.md` Testing Posture; new Mandated rule |
| Q6. The anonymised workbook | A. Fix the anonymiser and re-run it; the owner checks the result again before it is used. | `team-practices.md` Testing Posture; new Forbidden rule |
| Q7. Where the migration script is kept | A. In the repository, tested only with an invented workbook. Q9 later refined what "tested" covers. | `team-practices.md` Testing Posture; new Mandated rule |
| Q8. How new screens are designed | B. Designed in Stitch first; the owner's screenshot review compares each built screen with the Stitch design. | `team-practices.md` Testing Posture; new Mandated rule |
| Q9. What the checked anonymised copy is for (follow-up) | A. The automatic checks use the invented workbook in the repository; the owner-checked anonymised copy is used for trial runs on the owner's computer only, to prove the script reads the real layout. | `team-practices.md` Testing Posture; new Mandated rule |

**The gap-analysis wording is superseded.** Owner decision 3 in `ovis-tabla-gap-analysis.md` says the script is "developed and tested against the anonymised copy only". Q9 supersedes that wording for this work. The document itself was not changed.

**The older automatic-staging rule.** `project.md` holds `ALWAYS automatically deploy eligible changes to staging...` twice (affirmed 2026-08-12 and 2026-11-04). This step can only add rules, so it cannot remove or reword those lines. The new rule, that automatic staging deployment applies only once a hosted site exists, narrows the older one. Removing the older lines would be a separate, deliberate edit of `project.md`.

**Proposed text dropped because the interview did not confirm it.** It can come back if the owner asks for it.

- From the thin slice: "through the admin planning screen" and "loaded by the first part of the migration script from invented data". The owner confirmed database to parent's screen; how the slice gets its data is for later stages.
- "Run by hand by the owner, only on the owner's computer, once at go-live". The real run now belongs to the later hosting work.
- From the privacy line: screenshots and logs (the confirmed rule covers the repository), and "code that reads real data prints counts, never values".

**Hard rules proposed in the draft and not adopted.** The draft listed further candidates (forward-only migration files, no edits to merged migrations, change data only through named functions, no direct write policies, test on the real local stack, limits on reading or running against the real spreadsheet, counts instead of values). The owner was not asked about them, so they are not hard rules. The database conventions among them remain described as practice in `team-practices.md`.

## Baseline Check

Each statement of `team.md` that was specific to the finished restyle or could have gone stale, against the repository today, and how it was integrated.

| Section | Baseline text | Found today | Result |
|---|---|---|---|
| Walking Skeleton | "For the Stitch restyle we build the thin first slice first" | Restyle merged (#5, 2026-11-04) | **Dropped** |
| Walking Skeleton | "For this runnable-web-app feature, that Bolt proves..." | Belonged to an earlier feature, but the list of boundaries is still useful | **Reworded** without the feature reference |
| Testing | "For a style-only change the existing gates are the safety net..." | Still true: `tests/unit/design-tokens.test.ts` exists, browser specs still assert styles | **Reworded** to cover new and changed screens |
| Testing | Owner compares restyled screens with the Stitch design using screenshots; no picture-comparison tests | No picture-comparison tests exist | **Reworded** to cover new screens designed in Stitch (Q8) |
| Testing | "We want an automated check on `app/globals.css`..." | Done: `stylelint.config.mjs`, `lint:css`, `lint-css` step in `verify:local`, exact versions | **Reworded** from a wish to a fact |
| Testing | "We want the floating `latest` versions ... pinned" | Done for all five, guarded by `tests/unit/dependency-pins.test.ts` | **Reworded** to a fact |
| Deployment | "...verifies changes there, including this restyle" | Finished work | **Dropped** the last clause |
| Code Style | "We add a CSS linter" | Done | **Reworded** |
| Code Style | Self-hosted fonts need no policy change | Done: `app/fonts/`, `next/font/local`, `font-src 'self'` in `proxy.ts`. Now documented in `DESIGN.md` | **Dropped** |
| Code Style | "`DESIGN.md` currently says 'No webfonts'" | No longer says so | **Dropped** |
| Code Style | "a synthetic build archive" | Synthetic mode was removed in #27; the job archives a build made with placeholder settings, on merges to `main` only | **Reworded** |
| All | Remaining text (trunk, 80/80/80, gates, deployment goal, no deploy, CI action pins, SBOM and 14 days, result states) | Confirmed in `ci.yml`, `vitest.config.ts`, `package.json` | **Kept**, with the deployment goal reworded per Q2 |

Still floating and left alone: `eslint`, `prettier`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@types/react`, `@types/react-dom` on `latest`, and `typescript` and `@types/node` on ranges. CI installs from the lockfile, so these move only when the lockfile is refreshed. Assumption: pinning them is not part of this work.

## What This Work Adds

**Database functions and row-level security as the home of business rules.** The earlier baseline did not mention them, although most new behaviour here will be SQL.

- Facts: rules are named `security definer` functions; application roles can only read (two exceptions); row-level security is on for every table with no write policies on ordinary tables; merged migrations are refused if changed (`scripts/db/runner.ts` line 149).
- Testing today: 50 test files in `tests/database/` run on the real local stack with the Node test runner. They switch to the real roles and signed-in accounts (`stack-support.ts`), and also cover races, privileges, timing, a shuffled order and worker schemas.
- The 80% coverage figure sees only TypeScript and JavaScript, which is why the fixed test list applies to database rules (Q5).
- Also: no linter reads SQL; `src/access/` is outside the `lint` and `format` paths and this work changes `role-policy.ts` there. Assumption: it joins those paths in the Bolt that changes roles.

**One-off migration script and personal data.**

- `.gitignore` excludes `*.xlsx`, `*.xls`, `*.ods`. The privacy scan fails on a tracked data file outside the allowed folders, and on email addresses and phone numbers. **It cannot detect personal names, and it skips `aidlc/`.** The repository is public, so the new Forbidden rule depends on people reading what they commit.
- The anonymised copy sits outside the repository, so CI cannot use it. The invented workbook goes in `tests/fixtures/fictitious/`, the one folder allowed to hold workbooks.
- The script's code counts toward the 80% figure because `scripts/**` is included, unless it is excluded.
- The owner's notes record known gaps in the anonymiser (some name and phone patterns are missed), and its main script was lost and must be rewritten before a re-run (Q6).
- `scripts/db/local-guard.ts` refuses anything but the local stack, so it would block a hosted target by design. That matters to the later hosting work.

## Remaining Uncertainty

1. **Resolved by Q9: decisions about the anonymised copy disagreed.** `ovis-tabla-gap-analysis.md` (owner decision 3) and Q6 pointed to the anonymised copy for building and testing, while Q7 said invented workbook only. The owner settled it in Q9: automatic checks use the invented workbook, and the owner-checked anonymised copy is for trial runs on the owner's computer only.
2. **The real layout is proven only by hand.** The automatic checks use invented data, so only the owner's trial runs show that the script reads the real layout, and they cannot start until the re-run anonymiser's output has been checked. Later stages need to plan those runs and keep the invented workbook matching that layout without personal data.
3. **The real data load is undecided.** Owner decision 3 says the owner's computer keeps the real data, while Q1 moves loading real data into a hosted app to the later work. That later work needs to settle how the data reaches the hosted app. The goal of retiring the spreadsheet is not reached by this work alone.
4. **The fixed test list and rules where a case has no meaning.** "Two people at once" or "repeated click" have no obvious meaning for a read-only rule. The interview did not say how such a case is recorded; later stages should settle it.
5. **Database test files can be missed.** Test files are listed by hand in `package.json`, and `scripts/db/shuffled-tests.test.ts` only checks that the two lists agree, so a new file added to neither silently never runs. With many new database tests coming, a check that compares the lists with the folder is worth adding.
6. **Untracked knowledge documents.** `aidlc/spaces/default/knowledge/` is untracked and would be committed under the framework's convention. A count of lines resembling email addresses or Hungarian phone numbers in `ovis-tabla-tab-review.md` found 0, but names cannot be checked this way. Someone should read its appendices before it is committed.
7. **Half-finished work on `main` has an end date.** Q4 holds only while the owner alone runs the app. The later hosting work needs to revisit it.

## Framework Notes for the Conductor

- `practices-promote` turns every non-blank, non-comment line under `## Mandated` and `## Forbidden` into a rule and skips a duplicate only when the date matches, so `discovered-rules.md` lists only the new rules. The earlier rules stay in force in `project.md`, which already holds two sets and a stray `None. (affirmed 2026-10-06)` line.
- The scope has `skeleton: off`, so the framework's skeleton ceremony will not run by itself. The owner's thin slice (Q3) must be planned as the first Bolt, with an owner check before the rest.
- CI ignores changes only under `aidlc/`, while `Validate` is required, so a pull request touching only `aidlc/` gets no `Validate` result and needs the admin bypass.
