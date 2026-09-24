# Verification Handoff Security Requirements

## Sources

Derived from approved [requirements](../../../../inception/requirements-analysis/requirements.md) and brownfield [technology stack](../../../../../../codekb/waldorf-community-task-manager/technology-stack.md). Functional behavior is owned by the production-code units; this packaging unit verifies rather than redefines it.

## Evidence Integrity

Every scenario record identifies requirement/story, authorization-matrix row, fixture version, runtime mode, command/browser, result, timestamp, and evidence path without secrets or personal data. Synthetic results are labelled `PASS` or `FAIL`; Supabase, provider, Safari, preview/staging, and other unexecuted real-target checks are labelled `OUTSTANDING`, never inferred from synthetic success. Generated reports are deterministic, reviewable, and fail when required evidence is missing, stale, mismatched, or contains prohibited content.

## Security Gates

Verification covers route/action/resource/field authorization, direct requests, unrelated-family/out-of-scope access, next-request revocation, validation parity, idempotency and conflict/recovery states, sensitive-field absence, audit/log/error redaction, XSS-safe rendering, fixture/screenshot privacy, secret scanning, SAST, and dependency scanning. High or critical findings block acceptance. Test helpers cannot bypass the same application authorization/projection contracts exercised by the browser.

## Deployment Boundary

Commands may install, test, build, start, and issue localhost smoke requests only. They contain no Vercel/Supabase/provider credentials, deployment tokens, target project identifiers, publish/promote command, or network invocation to staging or production.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

The packaging requirements define deterministic evidence identity, fail-closed local gates, privacy/security coverage, Node/npm/tooling baselines, full command and artifact inventory, and a strict `PASS`/`FAIL` versus `OUTSTANDING` boundary. They allow local build/start verification while prohibiting deployment credentials, commands, and target calls.
