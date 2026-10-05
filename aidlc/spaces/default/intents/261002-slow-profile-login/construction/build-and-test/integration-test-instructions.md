# Integration and browser instructions

## Upstream instructions

Use Node 24.x/npm 11.x and the installed lockfile dependencies. In this workspace prefix commands with `PATH=/opt/homebrew/opt/node@24/bin:$PATH`. Use synthetic local fixtures only.
Execute each exact command in `../code-generation/unit-test-instructions.md` once. The Code Generation plan and summary define the changed boundaries.

## Required quality checks

```bash
npm run test:coverage
npm run test:browser
```

Coverage must meet 80% lines, branches and functions for both configured domain/delivery projects. Existing browser suite covers Chromium, Firefox and mobile Chromium, role authorization and accessibility. Critical flows must have zero serious/critical axe findings. Do not double-count focused tests already included in coverage. No external integration was changed or exercised.
