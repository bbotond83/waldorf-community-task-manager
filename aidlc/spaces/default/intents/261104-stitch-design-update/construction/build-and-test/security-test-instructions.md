# Security Test Instructions

The change does not touch authentication, data handling or the database, but the team rules require dependency, secret and SAST scanning to block delivery on high and critical findings, and the Content-Security-Policy must keep allowing only self-hosted fonts.

## Commands

```bash
npm run verify:security
```

This runs the privacy scan, the secret scan, the SAST scan, the "no deployment workflow" check (the project forbids executable deployment workflows until a deployable app and a linked target exist) and `npm audit --audit-level=high` (dependency scan; the audit contacts the npm registry).

## Checks specific to this change

- `tests/unit/fonts.test.ts`: no font is loaded from another host, `font-src 'self'` stays in `proxy.ts`, no `@import url(...)` in the stylesheet.
- `tests/unit/dependency-pins.test.ts`: the five pinned packages stay pinned.
- Font licences (`app/fonts/vollkorn-OFL.txt`, `app/fonts/karla-OFL.txt`) stay beside the font files.

## Pass criteria

No high or critical finding in any scan; no moderate or lower finding is hidden. Findings below high are reported, not silently ignored.
