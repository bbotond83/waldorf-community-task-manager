# Team Practices (re-run, 2026-11-04)

## Way of Working

We use trunk-based development. We work in short-lived feature branches, squash-merge to `main`, and require green automated checks before merge.

## Walking Skeleton

We use a scope-dependent walking skeleton, which means a thin first slice that runs the whole way through, built first to prove the pieces connect. When the active scope enables it, we run a gated first Bolt. For this runnable-web-app feature, that Bolt proves the browser, composition, production-build, start, and smoke-test boundaries before broader delivery proceeds.

For the Stitch restyle we build the thin first slice first: the fonts and the shared look land first, the owner checks them, and only then do we restyle the screens one flow at a time.

## Testing Posture

- **Methodology**: test-after
- **Ordering**: Implement each testable layer, then write and run its tests before moving to the next layer.
- **Methodology evidence**: Unchanged. Tests sit next to the code or in `tests/` in the same pull request, and each fix commit carries its regression test. No history shows tests written ahead of the code as a rule.

We write tests in the same change as the code and add a regression test for every defect. We enforce at least 80% line, branch, and function coverage across all production source (Vitest with the Istanbul provider, thresholds 80/80/80 in `vitest.config.ts`).

Before merge, we require strict type checking, tests, a production build, deterministic start smoke, the critical browser flow, and dependency scanning that blocks high and critical findings. The critical browser flow must have no serious or critical automated accessibility violations. Provisioned integrations do not count as verified until they are exercised against their real targets.

For a style-only change the existing gates are the safety net, and they react to styling: browser specs assert computed styles, element sizes, layout at several widths and class hooks, and `tests/unit/design-tokens.test.ts` reads colour tokens only in the form `--name: #rrggbb` inside `:root` of `app/globals.css`. Restyled screens keep those class names, measurements and token format, or the matching tests change in the same pull request.

We check how restyled screens look by owner review: the owner compares each restyled screen with the Stitch design using screenshots provided by the assistant. We do not add automatic picture-comparison tests.

We want an automated check on `app/globals.css` (a CSS linter such as Stylelint wired into the project's blocking checks), because nothing but the browser specs catches style mistakes today. This is new work for this change and is planned in later stages.

We want the floating `latest` versions of `react`, `react-dom`, `zod`, `@axe-core/playwright` and `@playwright/test` pinned during this work, so check results do not change without a code change. This is new work, planned in later stages.

## Deployment

We aim to automatically build and deploy eligible changes to staging, and to promote immutable deployments to production only after protected manual approval, keeping the prior deployment as the rollback target. That is the long-term goal and is not in effect yet.

Today nothing deploys automatically. The owner runs the app locally against a local backend and verifies changes there, including this restyle. We keep executable deployment workflows disabled until both a deployable application and a linked target project exist; until then, the tested git SHA is our artifact-provenance claim.

## Code Style

We use strict, idiomatic TypeScript with English technical identifiers and Hungarian user-facing copy. We use Prettier and ESLint as blocking checks. We preserve functional module boundaries, explicit ports, constructor injection at infrastructure seams, and colocated `*.test.ts` files.

We represent expected application failures as explicit result states and map unexpected infrastructure errors at the application boundary. CI includes secret scanning and SAST, with high and critical SAST findings blocking delivery. We pin CI actions to immutable revisions. For this repository, validated changes produce a CycloneDX SBOM, a synthetic build archive, explicitly unsigned commit/run metadata and SHA256 checksums retained as Actions artifacts for 14 days. These are unsigned build records only, not cryptographic artifact attestations, and we do not add signing or attestation.

Prettier already formats `app/globals.css`; ESLint does not read CSS. We add a CSS linter for it as described under Testing Posture. CSS classes are kebab-case with an area prefix (`parent-`, `teacher-`, `admin-`, `filter-`). The Content-Security-Policy already allows self-hosted fonts (`font-src 'self'`), so the new fonts need no policy change. `DESIGN.md` currently says "No webfonts"; it is updated together with the restyle.
