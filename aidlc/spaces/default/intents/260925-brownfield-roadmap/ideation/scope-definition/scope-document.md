# Scope Definition

## Scope Basis

This planning pass will describe the existing Waldorf Community Task Manager, inventory and assess archived AI-DLC artifacts against current code and project rules, then recommend a custom workflow for future feature development and bug fixes. The product boundary stays open until reverse-engineering evidence is available. [intent] [request] [Q1] [Q3]

This pass is limited to discovery and workflow planning. It will not change application code. [Q2]

## Current Project Snapshot (Initial Evidence)

- The README describes a responsive web application intended to replace Excel-based kindergarten parent-community coordination. Its product area includes users, families, children, school years, groups, tasks, events, signups, swaps, cancellations, notifications, and one-time Excel import. These are documented capabilities to verify against the current implementation, not a newly approved feature backlog. [readme]
- The README describes a Next.js App Router modular monolith, local synthetic profiles for Parent, Staff, Group Administrator, Kindergarten Administrator, and Super Administrator, with Hungarian user-facing copy. The package metadata declares Node.js 24.x and npm 11.x. [readme] [package]
- The README marks authentication/RLS, persistence, scheduled jobs, email providers, and linked Vercel execution as outstanding. It also states that local startup uses synthetic data and does not contact those targets. Treat these as current documentation claims to check against code, configuration, and project rules. [readme]
- `npm run verify:local` is documented as the canonical local acceptance command, covering formatting, linting, type checks, tests and coverage, security scans, build/start smoke, and browser checks. This assessment will inspect the defined gates; it will not run them or modify the code. [readme] [package] [Q2]
- The preserved archive at `.aidlc-archive/legacy-project-runtime-20260924/` contains two prior intent records. `260729-feature` is recorded as a completed Greenfield feature workflow that skipped reverse engineering; `260811-runnable-web-app` is recorded as a completed Brownfield workflow that included reverse engineering. The archive has 832 files under its intent tree, including authored artifacts and generated state, audit, runtime, and hook-health data. Inventory will distinguish decision-bearing artifacts from generated records. [archive]
- The archived runnable-app scope describes a local runtime, synthetic data, role-specific surfaces, existing domain contracts, verification gates, and deferred production activation. These claims are useful historical leads; each will be checked against the current repository before being carried forward. [archive-runnable-scope] [Q3]
- The README footer records AI-DLC 2.5.11, the active intent's initiative trigger records 2.9.0, and this session refreshed the installed helper to 2.10.0. This is a documentation/version discrepancy to reconcile during the archive review; the README footer alone does not establish the installed runtime version. [readme] [intent] [request]

## In Scope

- Build an evidence-backed description of the current repository structure, major user workflows, application boundaries, runtime configuration, quality checks, and integration/deployment posture. Keep the product boundary open until reverse engineering is complete. [intent] [request]
- Inventory the archived AI-DLC intent records and their decision-bearing artifacts, then compare their claims with current code and rules. Classify material findings as supported, contradicted, stale, unverified, or not applicable, with links to evidence. [Q1] [Q3]
- Separate historical decisions from generated runtime and audit data; do not promote an archived decision to current practice without current evidence. [Q3]
- Recommend one shared intake and discovery path for feature requests and bug reports, followed by distinct feature and bug-fix delivery paths. [Q4]
- Define a proposed prioritization method that combines user impact, risk, effort, and dependencies, and sequence early investigation around the highest-risk assumptions or defects. [Q5] [Q6]
- Identify dependencies and open questions needed to turn the recommendation into a reusable workflow for later development work. [Q4] [Q5] [Q6]

## Out of Scope

- Implementing a feature, fixing a defect, changing application code, or selecting a specific next product feature. [Q2] [intent]
- Editing current project rules or rewriting archived artifacts to make historical records appear current. [Q2] [Q3]
- Connecting or exercising production services, using real family or child data, or enabling deployment. [readme] [Q2]
- Automating workflow intake or adding repository tooling; these may be proposed for later consideration but are not part of this discovery pass. [Q2]

## Prioritization

All three requested outcomes are Must-have deliverables: a current project baseline, an evidence-based archive assessment, and a custom feature/bug-fix workflow recommendation. [request] [Q1] [Q3] [Q4]

For future feature and defect candidates, use this proposed relative score after evidence is collected:

`Priority score = (Impact + Risk + Dependency leverage) / Effort`

Rate each dimension from 1 to 5. Impact measures benefit to families and staff or harm prevented; Risk measures exposure such as security, privacy, data integrity, and reliability; Dependency leverage measures how much other work a change unblocks; Effort is relative implementation effort, so a higher value lowers the score. Use the score to rank candidates, not as a substitute for judgment. Validate the highest-risk assumptions or defects early even when their implementation score is not yet known. [Q5] [Q6]

Use Must for work required by the approved scope or for a confirmed critical risk/blocker; Should for high-value work that can follow the Must path; Could for useful work that does not displace higher-priority items. Do not assign scores to application changes until reverse engineering identifies evidence-backed candidates. These thresholds are a proposal for review, not an already affirmed team rule. [Q1] [Q5] [Q6]

## Delivery Boundary

The current workflow delivers planning artifacts only. Its discovery sequence is risk-first: establish the current baseline, examine archive claims that could affect privacy, authorization, reliability, or deployment boundaries, then complete the archive comparison and workflow recommendation. No application change is authorized by this scope. [Q2] [Q3] [Q6]

For later feature and bug-fix work, share intake, impact/risk/dependency triage, and evidence gathering. Then branch: feature work defines the user outcome, acceptance conditions, dependencies, and needed design/contracts before implementation; bug-fix work reproduces the defect, assesses severity and blast radius, identifies cause, adds a regression check, and applies a minimal correction. Both paths return to shared review, project quality gates, release decision, and feedback. The details remain subject to current-rule verification and later approval. [Q4] [Q5] [Q6]

## Value Stream

Current planning pass:

`Current project baseline -> risk-first evidence checks -> archived-artifact inventory and comparison -> custom feature/bug-fix workflow recommendation`

Recommended future work:

`Request -> shared intake and discovery -> impact/risk/effort/dependency triage -> feature path or bug-fix path -> shared verification and release decision -> feedback`

The feature path defines an outcome and acceptance conditions before design and implementation. The bug-fix path starts with reproduction and severity, then root-cause analysis and a regression check before the minimal fix. Both paths use current project rules and verification gates. [Q4] [Q5] [Q6]

## Success Boundary

- The current-project description is linked to repository evidence and clearly separates verified facts from documentation claims still under review. [request]
- Archived decision-bearing artifacts are inventoried and compared with current code and rules; generated runtime and audit data are identified separately. [Q1] [Q3]
- The recommendation includes a shared intake/discovery path, distinct feature and bug-fix paths, a transparent scoring method, and risk-first sequencing. [Q4] [Q5] [Q6]
- No application code or project rules are changed in this pass. [Q2]
- No specific feature or bug is selected before current-state evidence is available. [intent]

## Assumptions & Open Questions

- The product boundary remains open until reverse engineering confirms the current implementation and workflows. [intent]
- The project owner or development team's interests remain unanswered in the approved intent; confirm them before fixing scoring weights or declaring a product backlog. [intent]
- The proposed 1–5 scoring scales and Must/Should/Could criteria need calibration against evidence-backed candidates and team priorities. [Q5]
- The archive review must determine which historical artifacts are decision-bearing, which are generated records, and which claims remain applicable. [Q3]
- The README's AI-DLC version footer and historical/current intent references need reconciliation with the installed runtime record. [readme] [intent] [request]

## Sources

- [intent] `aidlc/spaces/default/intents/260925-brownfield-roadmap/ideation/intent-capture/intent-statement.md`
- [request] User request and confirmed scope-summary answers in this workflow.
- [Q1]–[Q7] `aidlc/spaces/default/intents/260925-brownfield-roadmap/ideation/scope-definition/scope-definition-questions.md`
- [readme] `README.md`
- [package] `package.json`
- [archive] `.aidlc-archive/legacy-project-runtime-20260924/aidlc/spaces/default/intents/`
- [archive-runnable-scope] `.aidlc-archive/legacy-project-runtime-20260924/aidlc/spaces/default/intents/260811-runnable-web-app/ideation/scope-definition/scope-document.md`
