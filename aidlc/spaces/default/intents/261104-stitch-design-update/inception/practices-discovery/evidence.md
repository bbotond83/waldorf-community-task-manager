# Evidence (lead-only re-run, 2026-11-04)

## What was inspected (read only; nothing executed)

- Baseline: `aidlc/spaces/default/memory/team.md` (five sections) and `project.md` (`## Mandated`, `## Forbidden`), as supplied in the rule bundle.
- Git history: `git log --oneline -15` at head `251c4b33ec426d5dd0a80105388ed20683f8da44`; squash-merged pull requests with conventional prefixes (#1 to #3 in the new public repository, #36 to #45 before it).
- `.github/workflows/ci.yml`, `package.json` scripts, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`, `playwright.config.ts`, `proxy.ts`.
- `scripts/verification/run-local-verification.ts` (stage list, browser stage), `tests/unit/design-tokens.test.ts`, test folder listings, and a search for computed-style and axe usage in `tests/`.
- Code-map files: `code-quality-assessment.md` (read fully, including the "Styling area (2026-11-04)" section). Other code-map files were not re-read; their content is reflected through the assessment.

## What the evidence shows (matches the baseline)

- Trunk-based, squash-merge, pull-request flow: matches.
- Test-after, tests in the same change, regression tests with fixes: matches. 80/80/80 coverage threshold is configured in `vitest.config.ts` and in the domain coverage script.
- Gates: `npm run verify:local` runs type check, lint, format check, domain, scripts and delivery tests, database suites on a local Supabase stack, production build, start smoke, browser specs in Chromium, Firefox and mobile Chrome (all on every pull request), `verify:security` with privacy, secret, SAST and no-deploy scans and `npm audit --audit-level=high`. Matches.
- Actions pinned by commit SHA: matches (checkout, setup-node, upload-artifact).
- SBOM and evidence wording: matches `build_evidence` (CycloneDX SBOM, build archive, `signed: false` metadata, SHA256SUMS, 14-day retention, no cryptographic attestation).
- Content-Security-Policy already allows `font-src 'self'`.

## Drift found

1. **Deployment wording is ahead of reality (wording drift, not a rule change).** `team.md` says changes are automatically deployed to staging. No deploy workflow, `vercel.json` or linked project exists, and `verify:no-deploy` actively checks for that. The rule "keep executable deployment workflows disabled until a deployable application and linked target project exist" is the true state. The two sentences can coexist as intent versus current state, but a reader may think staging receives this restyle automatically. It does not.
2. **Mandated rule versus team wording on attestations.** `project.md` still carries "ALWAYS generate an SBOM and artifact attestation when a deployable artifact exists". `team.md` states the evidence is deliberately unsigned and "not cryptographic artifact attestations" and says it supersedes the older attestation wording. The `project.md` rule has not been updated and says something different. This is a contradiction in the stored rules, not a change in practice.
3. **Stale comment in code, not a practice change.** `run-local-verification.ts` and `playwright.config.ts` comments still say "CI pull requests: Chromium only"; `ci.yml` and `team.md` say every browser runs on every run. The workflow is authoritative.
4. **Not in the baseline, relevant to this intent:** CSS is formatted by Prettier but not linted by anything; `DESIGN.md` says "No webfonts"; colour tokens are checked by a regex-based test that expects `--name: #rrggbb` inside `:root`; several dev dependencies float on `latest`; there is no screenshot-comparison test. These are recorded in the Testing Posture and Code Style sections of the draft as evidence, not as new rules.

## Interview decisions (six questions, all answered)

- **Q1 = A.** Fonts and shared look first as a gated first step the owner checks, then one flow at a time. Recorded in `## Walking Skeleton` as a thin first slice, then flow by flow.
- **Q2 = free text (X).** The owner's exact words: "I have a local backend which allows me to run the app locally and test all the changes". **Interpretation, for the owner to confirm at the gate:** no staging deployment exists today; changes are verified locally against the local backend; nothing deploys automatically. `## Deployment` now says this plainly and keeps the staging wording only as the long-term goal. The owner may have meant something different (for example, that staging is not wanted at all); the gate is the place to correct it.
- **Q3 = A.** Unsigned build records only. The older "SBOM and artifact attestation" mandate is dropped from the drafts and is not carried into `discovered-rules.md`. This supersedes the older rule.
- **Q4 = B.** Add a style-file check for `app/globals.css` (a CSS linter such as Stylelint wired into the project's checks). New work to plan in later stages. Recorded in Code Style and Testing Posture, and as a hard constraint in the human's phrasing: ALWAYS check app/globals.css with an automated style check.
- **Q5 = A.** The owner reviews each restyled screen against the Stitch design using screenshots from the assistant. No automatic picture-comparison tests.
- **Q6 = B.** Pin the floating `latest` versions (`react`, `react-dom`, `zod`, `@axe-core/playwright`, `@playwright/test`) during this work. New work to plan in later stages; recorded in Testing Posture, not as a hard rule.

## Open follow-ups for the owner

1. **Manual removal in `project.md`.** The promotion tool only appends to `project.md` and never deletes. The old line "ALWAYS generate an SBOM and artifact attestation when a deployable artifact exists. (affirmed 2026-08-12)" stays there after promotion and contradicts the unsigned-records decision (Q3). The owner needs to remove it by hand.
2. Confirm the interpretation of the Q2 free-text answer (see above).
3. Plan the new work this stage surfaced: the CSS linter (Q4), pinned versions (Q6), updating `DESIGN.md` ("No webfonts"), and a fonts/shared-look first step (Q1).
4. The stale "CI pull requests: Chromium only" comments in `run-local-verification.ts` and `playwright.config.ts` remain a small cleanup candidate.

## Remaining uncertainty

- Test and coverage results were not re-run in this stage; the numbers in older summaries are not authoritative (per the project rule on stale counts).
- Whether a linked hosting project will ever exist for staging is not visible in the repository.

## Questions that were put to the interview (now answered above)

1. Should a UI-only restyle of this size get a first small step that is checked before the rest (for example the shared look and fonts first, then the screens one flow at a time)? Or should it go as one piece?
2. The stored rules say changes are deployed to staging automatically, but nothing is set up for that yet. Should we keep the wording as the goal, or reword it so nobody expects the new look to appear on a staging site by itself?
3. One stored rule asks for a signed "attestation" of builds, while the team text says the build records are deliberately unsigned. Which of the two is the rule you want to keep?
4. Nothing checks the CSS file for mistakes other than the browser tests. Are you happy with that for this change, or do you want an extra check added (more effort, earlier warning of broken styles)?
5. The existing tests would catch contrast and layout problems but not a changed look as such. Should we add any picture-comparison check, or is manual review of the screens enough?
6. Some tools are set to always take the newest version, so an accessibility check could start failing on its own. Do you want those versions fixed during this work, or left as they are?
