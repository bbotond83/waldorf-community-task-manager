# Component Inventory

These headings are the literal component identities used by the scope marker. Health ratings describe source boundaries and evidence gaps, not measured service health. Every listed component has deeply read implementation paths; complete directory coverage is not implied.

## Access

Authorization, role grants/revocation, authorization-version invalidation; owns access contracts. Depends on injected users/grants/audit/clock and optional Supabase RPC adapter. **At-risk:** real RPC/RLS behavior unverified.

## Directory

Family/parent/child/group relationships, archive/restore and field projection. Depends on access/grants and directory repository/audit. **Healthy source boundary;** persistence is synthetic/injected.

## Coordination

Signup, capacity/version checks, swap/cancellation requests and decisions. Depends on directory visibility, task/assignment repository and events/audit. **Healthy source boundary;** target durability unverified.

## Notifications

7-day/24-hour reminder creation, due-job dispatch and cancellation. Depends on store, queue, dispatcher/provider ports. **At-risk:** real provider/scheduler evidence outstanding.

## Parent Experience

Family assignments, request views, contribution eligibility and own notification reads. Depends on directory, role repository and optional commands. **Healthy source boundary.**

## Staff Schedule

Read-only bounded schedule projection; depends on authorizer and schedule repository. **Healthy source boundary.**

## Admin Experience

Queue/school-year/generic operations and archive destinations for legacy sheets. Depends on access and import mapping. **Healthy source boundary.**

## Import Migration

17-sheet registry, consent/cell checks, immutable previews, conflicts and commit/rollback. Owns migration orchestration via repository transaction port. **At-risk:** synthetic rollback snapshot limitations and real transaction validation remain.

## Privacy Audit

Departure grace period, sibling/hold eligibility, delete/anonymize and one-year audit retention. Depends on lifecycle repository/clock. **At-risk:** real retention and deletion execution unverified.

## Application

Result/DTO contracts, session and role facades, authorization/projection/idempotency and event/evidence ports. Depends on domain/access types and injected adapters. **Healthy explicit boundary;** parallel legacy/direct-adapter implementations can diverge.

## Parent Web

Synthetic duties, requests, notifications, contribution and invitation gateway. Depends on application facades; owns module-local state/cache. **At-risk:** nondurable state.

## Staff Web

Synthetic schedule fixtures and failure scenarios; depends on staff facade/authorization. **Healthy fixture boundary;** not live persistence evidence.

## Admin Core

Synthetic records/tasks/approvals, scope/version checks and idempotency; depends on admin facade and owns process-global store. **At-risk:** nondurable state.

## Admin Advanced

Import recovery, reminders, governance/revocation, lifecycle/settings; composite admin port over process-global state. **At-risk:** persistence/provider and lifecycle evidence incomplete.

## Runtime

Config/mode composition, five profiles, signed session, selector/shell and origin guard. Depends on Zod, Node crypto and application authorization. **At-risk:** shared login delay not reproduced or attributed; production composition unlinked.

## App Routes

Public authentication/invitation, three HTTP handlers and protected parent/staff/admin pages/actions. Depends on asynchronous Next cookies/params, runtime/role boundaries and facade helpers. **At-risk:** root and business-page latency require separate actual-environment measurement.

## Local Verification

Toolchain/environment checks, manifests, coverage/security, build/smoke/browser/evidence orchestration. Depends on Node APIs, Next environment loader and Playwright. **At-risk:** login timing suite is opt-in and current checks were not run.

## Supabase Schema

Six proposed application tables and three authorization RPCs using PostgreSQL/Supabase identity and RLS. **At-risk:** unlinked/unexercised target.
