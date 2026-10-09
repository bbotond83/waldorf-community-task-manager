# Performance Test Instructions

## Scope

The only measurable performance target in this change is the weight of the cover image on the profile chooser (requirements NFR4: resized and compressed for the viewport). There is no load, latency or throughput target and nothing here needs a deployed environment.

## Target

- Cover banner at 375 px viewport width on a 2.6x device (the mobile-chrome device): at most 250 KB transferred. The original `public/brand/cover.jpg` is about 672 KB.
- The limit was relaxed from 150 KB to 250 KB at the person's request because quality 45 looked too soft; at quality 75 the largest variant a phone requests (width 1080) measured 202 KB.

## How to run

- `npx playwright test --config playwright.config.ts tests/browser/visual-overhaul.spec.ts --project=mobile-chrome` (the NFR4 test inside it asserts the limit).
- Manual cross-check against a production build: start it with `npm run start` and request `/_next/image?url=%2Fbrand%2Fcover.jpg&w=1080&q=75`; the response size should be under 250 KB.

## Out of scope here

The existing login-performance measurements (`npm run test:login-performance`) belong to an earlier piece of work and are not affected by this change; they were not re-run for the targets above.
