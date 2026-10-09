# Technology Stack

| Area | Technology | Version (installed) | Notes |
|---|---|---|---|
| Language | TypeScript | 5.9.3 | strict, ES2024 target, bundler resolution, `.ts` import extensions |
| Runtime | Node.js | 24.x (`.nvmrc` 24, `engines` 24.x, npm 11.x) | enforced by `scripts/validate-toolchain.mjs` |
| Framework | Next.js | 16.4.0 | App Router, `proxy.ts`, `next dev --hostname 127.0.0.1` |
| UI | React / React DOM | 19.2.8 | declared `latest` |
| Validation | zod | 4.4.3 | declared `latest` |
| Styling | Plain global CSS | n/a | `app/globals.css`; system font stack; no Tailwind/CSS modules/font loader |
| Unit/domain tests | node:test | Node 24 | `--experimental-strip-types`, 80% coverage flags |
| Delivery tests | Vitest + jsdom + Testing Library | 4.1.11 | istanbul and v8 coverage providers |
| Browser tests | Playwright + axe-core | 1.62.1 / 4.13.0 | chromium, firefox, Pixel 7 |
| Lint / format | ESLint 9.39.5 (eslint-config-next), Prettier 3.9.6 | | print width 100, double quotes |
| Backend data | Supabase/PostgreSQL migrations | n/a | `supabase/migrations/*.sql`; runtime uses synthetic in-memory adapters |
| CI | GitHub Actions | | actions pinned to commit SHAs |
| Hosting plan | Vercel (immutable promotion, rollback) | n/a | no executable deploy workflow yet (team rule) |

## Security Headers

`next.config.ts`: nosniff, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy. `proxy.ts`: CSP with nonce, `img-src 'self' blob: data:`, `font-src 'self'`, `style-src 'self' 'unsafe-inline'`.

## Fonts and Assets

No web font is loaded. Self-hosted fonts (`next/font/local` or `next/font/google`, which downloads at build) satisfy `font-src 'self'`; a `<link>` to fonts.googleapis.com would be blocked. Static images are served from `public/` (`public/brand/logo.png`, `cover.jpg`).
