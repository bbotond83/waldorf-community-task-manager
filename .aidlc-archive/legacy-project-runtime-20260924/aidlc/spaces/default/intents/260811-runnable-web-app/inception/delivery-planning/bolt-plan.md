# Bolt Plan

## Sources and Practices

This sequence implements approved [requirements](../requirements-analysis/requirements.md), [stories](../user-stories/stories.md), [refined mockups](../refined-mockups/mockups.md), Application Design [components](../application-design/components.md), Units [definitions](../units-generation/unit-of-work.md), [DAG](../units-generation/unit-of-work-dependency.md), [story map](../units-generation/unit-of-work-story-map.md), and [team practices](../practices-discovery/team-practices.md). Construction uses short-lived worktrees, squash merge, green checks, and a gated walking skeleton. No Bolt deploys.

## Bolt 1 — Runnable Parent Walking Skeleton

- **Units:** `runtime-foundation`, `application-facades`, `parent-web`
- **Walking skeleton:** Yes; gated before later Bolts.
- **Definition of Done:** Node/npm/runtime contract; Next.js dev/build/start; synthetic composition and privacy-safe profiles; AppShell; authorization/result contracts; invitation/auth entry; parent duties, one eligible signup, denial, pending/success/failure; focused tests; deterministic HTTP smoke.
- **Confidence hypothesis:** The existing domain library can be composed through a secure accessible browser boundary and production build without production credentials or deployment.
- **Demo:** fresh install → start → select Parent → view/signup duty → switch profile/deny route → production build/start smoke.

## Bolt 2 — Staff Visibility

- **Unit:** `staff-web`
- **Walking skeleton:** No.
- **Definition of Done:** schedule filters/detail, loading/empty/failure/retry/denied states, exact permitted-field projection, no mutation controls, browser/accessibility tests.
- **Confidence hypothesis:** Read-only coordination value can be exposed without leaking contacts, protected fields, assignments, or unrelated rows.
- **Demo:** Staff profile views a granted schedule, filters it, then receives generic denial for a mutation/out-of-scope route.

## Bolt 3 — Administrator Core

- **Unit:** `admin-core-web`
- **Walking skeleton:** No.
- **Definition of Done:** scoped navigation/dashboard, records, task/event, assignment/capacity, approval exact outcomes, archive/restore, event notes, Group Admin import denial, tests and redacted evidence.
- **Confidence hypothesis:** Existing access/directory/coordination/admin contracts support complete scoped administration with atomic results and no client-owned policy.
- **Demo:** Group Admin manages an in-scope record/task/assignment and approval, then fails outside-scope/import access safely.

## Bolt 4 — Administrator Advanced

- **Unit:** `admin-advanced-web`
- **Walking skeleton:** No.
- **Definition of Done:** seven-step import and recovery, reminder monitoring/retry, roles/governance/settings, immediate revocation, recipient selection, privacy lifecycle, synthetic job/event behavior, browser/security/accessibility tests.
- **Confidence hypothesis:** High-risk long-running and privacy-sensitive workflows remain deterministic, idempotent, recoverable, and authorization-equivalent under synthetic adapters.
- **Demo:** Kindergarten Admin previews/commits/recovers import and runs lifecycle; Super Admin revokes a grant and next request is denied.

## Bolt 5 — Verification and Local Handoff

- **Unit:** `verification-handoff`
- **Walking skeleton:** No.
- **Definition of Done:** scenario manifest covers every inherited/current story; strict type/format/lint/test coverage ≥80%; build/start smoke; Chromium/Firefox/mobile emulation; accessibility/security/dependency evidence; fresh-checkout README/env example; synthetic vs linked-target report; no executable deployment workflow/network invocation.
- **Confidence hypothesis:** An independent developer can reproduce and objectively accept the full local application while distinguishing outstanding real-target evidence.
- **Demo:** clean-checkout runbook and one command sequence produce green local evidence and explicit OUTSTANDING linked-target rows.

## Parallel Batch

After Bolt 1, Bolts 2 and 3 may run in parallel because the approved DAG contains no dependency between `staff-web` and `admin-core-web`. Bolt 4 waits for Bolt 3. Bolt 5 waits for all runtime/UI units. This is the chosen economic path through the topology.

