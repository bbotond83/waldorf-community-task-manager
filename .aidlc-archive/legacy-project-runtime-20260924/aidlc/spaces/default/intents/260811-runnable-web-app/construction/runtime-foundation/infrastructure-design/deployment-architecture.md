# Deployment Architecture

## Sources

Implements runtime [security design](../../nfr-design/security-design.md) and approved Application Design [components](../../../../inception/application-design/components.md) and [services](../../../../inception/application-design/services.md).

## Local Topology

One Node 24 process runs the Next.js modular monolith on loopback. Synthetic adapters and versioned fixtures live in process. `npm run dev` supports development; `npm run build && npm run start` proves production output. Readiness is an HTTP application marker, not a deployment health claim.

## Future Target Boundary

The build remains Vercel-compatible, but this intent defines no linked project, environment ID, deployment token, deploy command, or executable deployment workflow. Future preview/staging may consume the tested artifact only after linkage; production promotion remains protected/manual.

## Isolation

Synthetic and production compositions are mutually exclusive. Local acceptance uses synthetic mode and makes no Supabase/provider/Vercel network call. No AWS runtime is introduced.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

The local topology, in-process synthetic services, readiness and redacted monitoring signals, deterministic CI gates, provenance, shared ownership, and future adapter slots are coherent with a single Next.js modular monolith. CD is explicitly disabled, no target secret or invocation is introduced, and future staging/manual-production rules remain separate.
