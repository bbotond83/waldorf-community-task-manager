# Test Cases — Waldorf Ovi Community Task Manager MVP

_Source: derived from the story analysis on 2026-08-06. Live UI: Not explored; the inspected baseline was the legacy workbook. Status legend: Not Run · Pass · Fail · Blocked · Cannot Verify Yet._

## How to use

Run each case from the stated starting point. Record the observed result and any defect in Comment. A case marked **Cannot Verify Yet** remains open until its Question is answered.

## Safe community access

| Test ID | Summary | Steps | Expected Result | Status | Comment | Question |
|---|---|---|---|---|---|---|
| TC-ACCESS-1 | Deny a parent another family's data | 1. Sign in as Parent A. <br> 2. Try to open Parent B's family, assignment and contact information through the app and a direct saved link. | Each attempt is denied without revealing whether the record exists or exposing personal details. | Not Run | Covers privacy boundary. | |
| TC-ACCESS-2 | Revoke access immediately | 1. Sign in as a scoped administrator. <br> 2. Remove that user's group scope in a second session. <br> 3. Retry an open page action and a direct API request. | The next protected request is denied; no cached or returned sensitive data remains usable. | Not Run | Covers immediate revocation. | |

## Family-owned duties and coordination

| Test ID | Summary | Steps | Expected Result | Status | Comment | Question |
|---|---|---|---|---|---|---|
| TC-DUTY-1 | Show one family duty to linked parents | 1. Link two active parents to one family. <br> 2. Assign the family a duty. <br> 3. Sign in as each linked parent. | Both parents see the same duty and permitted actions; an unrelated parent does not. | Not Run | Covers family ownership. | |
| TC-DUTY-2 | Prevent an overbooked final slot | 1. Make one task slot available. <br> 2. Submit sign-up from two families at the same time. | Exactly one assignment is created; the other receives a clear conflict/full result. | Not Run | Covers race condition. | |
| TC-SWAP-1 | Complete a confirmed two-family swap | 1. Give two eligible families active duties. <br> 2. Have both confirm a swap. | The two assignments exchange atomically, audit evidence is redacted, and reminders are recalculated. | Not Run | Covers auto-approved change. | |
| TC-CANCEL-1 | Keep assignment stable during a conflicting cancellation | 1. Submit a cancellation. <br> 2. In another session submit a competing change. <br> 3. Resolve the cancellation. | The system shows a clear outcome and never leaves duplicate or orphaned assignments. | Not Run | Covers conflict state. | |

## Reminders and privacy lifecycle

| Test ID | Summary | Steps | Expected Result | Status | Comment | Question |
|---|---|---|---|---|---|---|
| TC-REMINDER-1 | Schedule both required reminders | 1. Create a duty in the Budapest timezone. <br> 2. Inspect its reminder schedule. | One reminder is scheduled 7 days before and one 24 hours before, at the correct local times. | Not Run | Covers required schedule. | |
| TC-REMINDER-2 | Stop stale reminders | 1. Queue reminders. <br> 2. Reassign, reschedule and cancel the duty before sending. | Old recipient jobs are cancelled/suppressed; only the correct current recipient can receive a reminder. | Not Run | Covers stale-message risk. | |
| TC-PRIVACY-1 | Delete after the final child leaves | 1. Mark a family's only enrolled child as left. <br> 2. Complete the grace-period lifecycle. | Eligible contact/profile data is deleted, allowed history is anonymized, and redacted audit evidence remains only as approved. | Not Run | Covers mandatory deletion. | |
| TC-PRIVACY-2 | Preserve data when a sibling remains | 1. Use a family with two children, one still enrolled. <br> 2. Start the lifecycle for the departing child. | Family data remains active while the sibling is enrolled; the review is auditable. | Not Run | Covers sibling exception. | |

## Workbook migration

| Test ID | Summary | Steps | Expected Result | Status | Comment | Question |
|---|---|---|---|---|---|---|
| TC-IMPORT-1 | Account for every workbook sheet | 1. Upload the approved workbook. <br> 2. Open the preview. | All 17 sheets have a visible mapping/result; none is silently omitted. | Not Run | Covers core migration promise. | |
| TC-IMPORT-2 | Send ambiguous people to review | 1. Use a row with an alias, spelling variation or multiple people in one cell. <br> 2. Preview the import. | The row waits in a clear review queue and is never silently merged. | Not Run | Covers identity safety. | |
| TC-IMPORT-3 | Reprocess without duplicates | 1. Commit a valid workbook. <br> 2. Submit the same content again. | The second run reports already-imported/changed rows and creates no duplicate people, families, tasks, events or assignments. | Not Run | Covers repeat-safe import. | |
| TC-IMPORT-4 | Recover a failed import safely | 1. Trigger a controlled failure during commit. <br> 2. Follow the authorized recovery route. | No partial data remains exposed; recovery/rollback is auditable and verified within the agreed hour. | Not Run | Covers recovery objective. | |
| TC-IMPORT-5 | Verify legacy workflow destinations | 1. Import a workbook containing a workgroup, library loan, water-test contribution and finance row. <br> 2. Attempt each user's next real-world action. | CANNOT VERIFY YET — the product destination and permitted actions for these workflows must first be approved. | Cannot Verify Yet | Covers Blocker. | Q1 |

## Accessible, mobile and release-ready service

| Test ID | Summary | Steps | Expected Result | Status | Comment | Question |
|---|---|---|---|---|---|---|
| TC-UX-1 | Complete a parent core journey without a mouse | 1. Use keyboard only to open duties, sign up, request a change and read the outcome. | Focus, labels, errors and status announcements are usable in Hungarian; no action requires a mouse or colour-only cue. | Not Run | Covers accessibility core flow. | |
| TC-UX-2 | Verify responsive administration | 1. Use a supported mobile viewport. <br> 2. Review records, approvals and an import conflict. | Card/table alternatives retain every action and context without horizontal-only interaction. | Not Run | Covers mobile-first promise. | |
| TC-RELEASE-1 | Execute the approved release matrix | 1. Load the named fixture volume. <br> 2. Run each approved core flow on every supported browser/device. | CANNOT VERIFY YET — the final flow inventory, devices, volume and evidence criteria must be approved. | Cannot Verify Yet | Covers Important release-quality gap. | Q2 |

## Coverage summary

| Source of the case | How many |
|--------------------|----------|
| Story acceptance points | 14 |
| Capabilities (happy path) | 8 |
| Negative / boundary / error | 8 |
| Unconfirmed extra scope | 0 |
| Cannot Verify Yet (needs a decision) | 2 |

## Challenger additions

| Test ID | Summary | Steps | Expected Result | Status | Comment | Question |
|---|---|---|---|---|---|---|
| TC-ONBOARD-1 | Complete invite, expiry and resend | 1. Invite a user. <br> 2. Let one invite expire and resend it. <br> 3. Complete setup with each link. | Only the current, unexpired invitation permits setup; all messages and outcomes are Hungarian. | Not Run | Covers untraced MVP journey. | |
| TC-NOTIFY-1 | Keep in-app notification when email fails | 1. Cause a workflow notification with a forced email-provider failure. <br> 2. Open the notification centre. | The linked in-app notification is present, readable and can be marked read; authorized admins see redacted delivery failure status. | Not Run | Covers channel parity. | |
| TC-ADMIN-1 | Operate dashboard queues and archive | 1. Open pending swaps, cancellations, unfilled slots, failed deliveries and import issues. <br> 2. Filter by group/year. <br> 3. Archive a school year and open it as an authorized user. | Queues/filtering work by scope; archived history is read-only and unauthorized users cannot access it. | Not Run | Covers missing release journeys. | |
| TC-ACCESS-3 | Execute role/resource/field matrix | 1. Repeat sensitive record actions as every role. <br> 2. Include cross-group records, staff schedule, contact/optional fields, reasons and audit history through UI and direct API. | Every allowed action works; every denied action omits protected data and mutations. | Not Run | Covers role × resource × field evidence. | |
| TC-SWAP-2 | Resolve an administrator-pending swap | 1. Create a non-qualifying swap. <br> 2. Approve it, then repeat and reject it. | Each decision leaves one correct assignment, sends the right notifications and keeps history/audit consistent. | Not Run | Covers missing workflow outcomes. | |
| TC-EVENT-1 | Enforce contribution and allergen rules | 1. Try to edit another family's contribution. <br> 2. Test allergen visibility as assigned family, confirmed participant, admin and ineligible user. | Only the allowed person edits a contribution; allergen text is visible only to eligible participants and authorized administrators. | Not Run | Covers safety/privacy boundary. | |
| TC-IMPORT-6 | Require consent for optional historic profile data | 1. Import optional occupation/hobby/support values without recorded consent. <br> 2. Repeat with explicit versioned consent, then withdraw it. | Without consent the values are not committed; consent permits the approved fields; withdrawal applies the approved deletion outcome. | Not Run | Covers Blocker privacy gap. | |
| TC-IMPORT-7 | Prevent partial visibility after a mid-import failure | 1. Inject a failure after import work starts. <br> 2. Inspect all target records before recovery. | No partial canonical records become visible, or the documented staged-publish strategy preserves equivalent all-or-nothing visibility. | Not Run | Covers Blocker atomicity gap. | |
| TC-IMPORT-8 | Protect changes made after import during rollback | 1. Import valid data. <br> 2. Change an imported assignment/contact as an authorized user. <br> 3. Trigger later import rollback. | Recovery blocks or reconciles safely; it never silently deletes the later legitimate change. | Not Run | Covers recovery concurrency. | |
| TC-IMPORT-9 | Bind approval and validate consistently | 1. Change previewed data or mapping version before approval. <br> 2. Try to approve a blocked preview. <br> 3. Submit the same bad contact through import, profile, invitation and API. | Changed/blocked previews cannot commit; each surface gives the same validation outcome; changed rows are reported without duplicates. | Not Run | Covers import integrity/parity. | |
| TC-REMINDER-3 | Handle threshold and provider-acknowledgement failure | 1. Create/reschedule duties at 6d23h, 23h and immediately after each threshold, including a Budapest DST boundary. <br> 2. Simulate provider acceptance followed by worker crash. | The defined one-time outcome creates both in-app and email records; provider idempotency prevents an unintended duplicate or the documented at-least-once outcome is explicit. | Not Run | Covers notification reliability. | |
| TC-PRIVACY-3 | Defer lifecycle on a last-moment sibling or hold | 1. Expire a family's grace period. <br> 2. Immediately add an enrolled sibling, re-enrol a child, or add a scoped hold. | Deletion is skipped/deferred atomically; the status and redacted audit evidence explain why. | Not Run | Covers lifecycle race. | |
| TC-PRIVACY-4 | Review, hold and expire audit records | 1. Complete the annual review. <br> 2. Apply/release a narrow hold. <br> 3. Attempt audit access as an unauthorized user and after the one-year expiry. | Holds affect only the intended data; unauthorized access is denied; expired audit records are deleted/anonymized as approved. | Not Run | Covers privacy/audit failure paths. | |

## Challenger Review

Two independent sub-agent passes (coverage-gap and adversarial/corner lenses) re-grounded these cases in the PRD, workbook baseline and AI-DLC artifacts. Material gaps were folded in above.

<!-- challenger-review: phase=requirement-qc mode=sub-agent passes=2 result=gaps-found -->

## Remediation Traceability

The cases marked `Cannot Verify Yet` now have approved design destinations and executable evidence requirements in `aidlc/spaces/default/intents/260729-feature/inception/requirements-analysis/migration-mapping-register.md` and `aidlc/spaces/default/intents/260729-feature/construction/release-acceptance-plan.md`. They remain `Not Run` until implementation and release validation, while production governance remains blocked on the explicitly recorded controller/provider/escalation approvals.
