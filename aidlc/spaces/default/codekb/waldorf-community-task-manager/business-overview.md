# Waldorf Community Task Manager — Business Overview

> Focused merge, 2026-10-02 (`261002-slow-profile-login`): the earlier sections are preserved historical prose from an UNVERIFIED store, including the prior startup diagnosis and pending loader choices. They are not current defect claims. Fresh conclusions are in the profile-login update below; exact newly analyzed files appear in reverse-engineering-timestamp.md. No tests, latency measurements, browser sessions, or backend calls were performed.


> Focused update, 2026-10-01: earlier repository-wide prose is preserved as historical static knowledge; its freshness was UNVERIFIED. Only the deep files listed in reverse-engineering-timestamp.md were analyzed for this update. No tests or runtime/external checks were executed.

## Purpose and Domain

The repository implements a Hungarian-language web application for coordinating Waldorf community activities across parent, staff, and administrator roles. Its observed capability model includes family and child directory data, community task sign-up, staff schedules, administration, legacy-data migration, notifications, and privacy governance. These capabilities are evidenced in source and local synthetic flows; the scan does not establish that every interface is an approved or currently operated business process.

## Actors and Experiences

- **Parents:** role pages under /szulo for duties, sign-up, swaps, cancellations, contributions, and notification actions.
- **Staff:** schedule-oriented interface under /munkatars.
- **Administrators:** records, tasks, assignments, approvals, import, reminders, governance, privacy, and settings under /admin.
- **Invited users:** synthetic invitation acceptance, login, and access-denied flows.

The role names and Hungarian UI demonstrate the product's implementation surface, not validated live user journeys.

## Capability Areas

1. **Directory:** family and parent/child relationships, group and school-year assignment, visibility, and archive/restore.
2. **Coordination:** sign-up capacity, optimistic versions, assignments, swaps, cancellations, contributions, allergen checks, and audit/event ports.
3. **Import and migration:** a 17-sheet legacy workbook registry, validation, preview/fingerprint, conflict handling, commit, rollback, and recovery contracts.
4. **Notifications:** 7-day and 24-hour schedules with dispatch, retry, and cancellation jobs through ports.
5. **Privacy and audit:** family personal-data lifecycle, grace/hold deferral, anonymization, and retention behavior.

## Runtime and Production Boundary

The current local experience is synthetic and backed by deterministic in-memory profiles, fixtures, and adapters. The production composition validates configuration but explicitly remains unlinked and makes no target call. The minimal Supabase RPC adapter and one SQL migration are authorization scaffolding, not a complete production persistence integration.

Do not infer durable storage, production authentication, real email/scheduler delivery, or deployment readiness from local UI behavior. The source workbook was inventoried but not opened; no family or child records were inspected.

## Historical Evidence

The preserved 2026 archive describes an earlier domain-only repository and includes two intent records and a nine-document CodeKB. Current source now contains the Next.js application and broad synthetic role flows. Archived decisions and verification figures remain historical leads and were checked against current source; they are not fresh test evidence or the current backlog.

## Evidence Limits

This is static analysis at commit d7995af0aacf59ff7aa75880c45cc5e0a50eda9e. No tests, builds, installs, audits, app sessions, external calls, database operations, or deployments were run.

## Local Startup Investigation

This bugfix supports a contributor using the documented synthetic local experience. README setup assumes `nvm`; the reported machine has an existing Homebrew Node 24 installation and no `nvm`. Current-terminal toolchain selection must retain Node 24.x/npm 11.x requirements and avoid global shell changes. Machine versions in the intent are supplied observations, not fresh verification.

The local configuration recipe cannot reach framework startup when `APP_RUNTIME_MODE` is absent from the inherited shell: the shared npm validator runs before Next loads environment files. This affects dev, build, and start. See architecture.md for the process boundary and code-quality-assessment.md for verification gaps.

## Profile Login Update — 2026-10-02

The active bugfix requests profile login in no more than five seconds. In synthetic mode the selector offers five fixed profiles and, after selection, displays the home greeting and role navigation. Role dashboards are reached through a subsequent navigation. Parent `/belepes` is a separate action-driven entry with a success message and explicit continuation link.

Requirements must define whether readiness means the home greeting or the role work page, whether `/belepes` is included, and which development/built-start and first-use conditions apply. No elapsed baseline or proven cause exists. See architecture.md for the observed flow and code-quality-assessment.md for the timing coverage gap.
