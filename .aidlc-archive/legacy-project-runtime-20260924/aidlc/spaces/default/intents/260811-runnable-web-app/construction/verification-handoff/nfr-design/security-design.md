# Verification Handoff Security Design

## Sources

Implements [security requirements](../nfr-requirements/security-requirements.md) and [technology decisions](../nfr-requirements/tech-stack-decisions.md). Performance, scalability, reliability, and business-logic inputs are inapplicable to this packaging-only unit; their application behavior is verified through the scenario manifest rather than redesigned here.

## Evidence Pipeline

A versioned manifest maps every critical current and inherited story to scenario identifiers, runtime mode, profile/fixture, authorization-matrix row, command, expected result, and required artifact. Focused runners emit machine-readable results into a temporary evidence directory; a deterministic aggregator validates schema, required coverage, tool exit status, fixture/runtime identity, timestamp, and artifact existence before producing the human-readable local acceptance report.

## Fail-Closed Status Model

Only an executed mandatory local scenario with matching current metadata can be `PASS`; an executed failure is `FAIL`; a real-target/browser check that cannot run in the documented environment is `OUTSTANDING`; a dated human exception is distinct and cannot satisfy a required gate unless the approved requirement explicitly permits it. Missing, malformed, stale, mismatched, or privacy-unsafe evidence fails aggregation. Synthetic results never satisfy Supabase, provider, Safari, preview/staging, or production rows.

## Privacy and Security Controls

Fixtures use synthetic identifiers and allowlisted copy. Automated scans inspect source fixtures, generated logs/reports, HTTP bodies, saved screenshots/traces, and accessibility snapshots for secrets, contact fields, optional profiles, protected reasons, unrelated-family data, and raw infrastructure errors. Authorization negatives use public routes/actions and fresh sessions, including next-request revocation. Test-only reset/profile controls are gated by synthetic runtime validation and cannot compile into or activate in production composition.

## Execution Boundary

The aggregate verification command may invoke local npm tooling, browsers, the built Next.js process, and localhost HTTP only. Environment validation rejects target credentials and deployment-mode ambiguity. No evidence step publishes, deploys, promotes, or contacts a staging/production target.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

The manifest-driven pipeline, strict evidence schema, fail-closed status model, privacy scans, public-boundary authorization tests, synthetic-control isolation, and localhost-only execution boundary are concrete and automatable. Missing or unsafe evidence fails, while real-target checks remain explicitly outstanding rather than being silently omitted or inferred.
