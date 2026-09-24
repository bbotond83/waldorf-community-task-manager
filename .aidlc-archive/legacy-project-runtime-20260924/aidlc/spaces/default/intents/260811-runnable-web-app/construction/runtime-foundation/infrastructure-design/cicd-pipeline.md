# CI/CD Pipeline Design

## Sources

Pipeline checks implement [security design](../../nfr-design/security-design.md), Application Design [components](../../../../inception/application-design/components.md), and [services](../../../../inception/application-design/services.md).

## CI Quality Pipeline

On supported Node/npm: deterministic install; runtime/config checks; Prettier; ESLint; strict typecheck; unit/integration tests; ≥80% line/branch/function coverage; production build; deterministic start smoke; Chromium/Firefox/mobile browser flows; accessibility; secret/SAST/dependency scan; SBOM/attestation once deployable artifact exists. High/critical findings fail.

## Artifact Provenance

The tested git SHA, lockfile, Node/npm versions, build result, and evidence manifest identify the local artifact. Actions must be immutable-pinned before CI acceptance.

## CD Disabled

There is no executable deploy job, Vercel CLI invocation, target secret, or staging/production environment. Future deployment configuration is a separate linked-target workflow with automatic eligible staging and protected manual production promotion.

