# Build Instructions: IPv6 coverage of the stack exposure check

The change touches a tooling script (`scripts/db/`), its tests, one help text and one README sentence. It adds no dependency and no production-app code.

## Prerequisites

Node 24 and npm 11. Write the PATH export before the `&&` chain: `export PATH=/opt/homebrew/opt/node@24/bin:$PATH && <command>`.

## Install and build

```
npm ci
npm run format:check
npm run lint
npm run typecheck
```

`npm run build` (`next build`) does not include `scripts/`, so this change does not alter the production build; the full build is part of the repository's own verification (`npm run verify:local`, which needs the stack settings loaded) and of CI.

## Troubleshooting

- Local database and browser suites need Docker and the stack started by the owner (`npm run db:start`); they are not needed for this change.
- A real `db:start` on a machine with an IPv6 address is the one check that exercises the probe against real interfaces; the owner runs it.
