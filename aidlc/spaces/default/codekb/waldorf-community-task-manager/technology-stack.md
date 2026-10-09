# Technology Stack

| Area | Technology | Version / note |
|---|---|---|
| Language | TypeScript (strict, ESM, `.ts` import extensions), Node 24 | typescript ^5.9, engines node 24.x, npm 11.x |
| Framework | Next.js app router, server actions | 16.4.0 (pinned) |
| UI | React, react-dom | "latest" (unpinned in package.json) |
| Validation | zod | "latest" |
| Styling | Hand-written global CSS with custom properties | app/globals.css, no CSS framework |
| Unit/domain tests | node:test via `--experimental-strip-types` | src/**/*.test.ts |
| Delivery tests | Vitest + jsdom + Testing Library | 4.1.11, istanbul coverage |
| Browser tests | Playwright + @axe-core/playwright | chromium, firefox, Pixel 7 |
| Lint/format | ESLint (eslint-config-next 16.3.8), Prettier | blocking |
| Database | Supabase/PostgreSQL migrations (RLS, current roles); not wired at runtime | supabase/migrations |
| Security | CSP nonce in proxy.ts, security headers in next.config.ts, HMAC cookie session | |
| CI | GitHub Actions (SHA-pinned actions), SBOM, secret and SAST scans | .github/workflows/ci.yml |
| Hosting plan | Vercel (workflows disabled until a target exists) | project memory |
