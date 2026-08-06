# Story Analysis — Waldorf Ovi Community Task Manager MVP

## Bottom Line

- **Will you get what the story asked for?** 🟡 — The plan is strong for secure family-based coordination, reminders, privacy lifecycle and a safe import path, but it still does not turn every promised legacy workflow into a buildable, testable product capability.
- **Confidence:** Medium — the requirements and unit contracts cover the high-risk core, while the work plan and several migration destinations remain incomplete or undecided.
- **Live reference UI:** No reference UI — not applicable. The approved review used the legacy workbook as the independently inspected baseline; no browser was launched.
- **Must sort out before building:** 4 items.
- **Fix first:**
  1. Decide and plan the product destination for the workgroup, library, cost-sharing and finance workflows.
  2. Add one complete, ordered build-and-test plan that demonstrably covers every promised capability and release gate.
  3. Approve the remaining import and privacy release decisions before production data is handled.
  4. Make the user-facing and API quality thresholds executable rather than descriptive.

## What the Story Asks For

| # | Capability (what the user wants) | What "done" looks like | Status |
|---|---|---|---|
| 1 | Safe community access | Each role sees and changes only the people and coordination information it is allowed to use. | ✅ Delivered |
| 2 | Family-owned duties | Linked parents can see and act on the same family responsibility without exposing another family's data. | ✅ Delivered |
| 3 | Tasks, events and change requests | Families can sign up and request swaps/cancellations; authorized organizers can resolve them safely. | 🟡 Partly delivered |
| 4 | Reliable reminders | The right active parent receives 7-day and 24-hour reminders, with stale messages stopped after changes. | 🟡 Partly delivered |
| 5 | Full workbook migration | Every one of the 17 sheets is accounted for without losing its operational meaning. | 🟡 Partly delivered |
| 6 | Privacy, retention and audit | Sensitive fields are limited by role, reviewed annually, and deleted/anonymized after the last child leaves. | 🟡 Partly delivered |
| 7 | Hungarian, mobile, accessible service | Core parent, administrator and staff journeys work accessibly on supported devices. | 🟡 Partly delivered |

_Status: ✅ Delivered · 🟡 Partly · 🔴 Missing · ⚠️ Changed_

## Feature-by-Feature Review

**Safe community access** — ✅ Delivered

- **You asked for:** Role- and group-scoped access to family, task, event and coordination information.
- **What you'll actually get:** Server and data-level checks, immediate denial after a role is removed, Hungarian generic denial messages, and redacted audit evidence.
- **Severity:** Minor · **Try this to check:** Remove a group administrator's scope while their page is open, then retry both a page action and a direct API request.

**Family-owned duties** — ✅ Delivered

- **You asked for:** A duty belongs to a family rather than one named parent.
- **What you'll actually get:** Multiple linked parents can see the assignment; an administrator may choose a primary reminder recipient; unrelated parents are denied.
- **Severity:** Minor · **Try this to check:** Link two active parents to one family, assign a duty, and verify both visibility and recipient selection.

**Tasks, events and change requests** — 🟡 Partly delivered

- **You asked for:** Safe sign-up, swaps, cancellations, event contributions and allergen visibility.
- **What you'll actually get:** Atomic, conflict-aware assignment changes; confirmed two-family swaps can complete automatically; other changes await an authorized organizer; only eligible participants can see allergen text.
- **The difference / concern:** The documented cases do not yet cover administrator-approved/rejected swaps, cancellation decisions, contribution-note ownership, or allergen allow/deny behavior for every participant type.
- **Severity:** Important · **Try this to check:** Submit each approval/rejection path and test contribution/allergen access as eligible and ineligible users.

**Reliable reminders** — 🟡 Partly delivered

- **You asked for:** Reminders at seven days and 24 hours, including correct behavior when duties change.
- **What you'll actually get:** Durable, recipient-specific jobs in the Budapest timezone, replacement of stale jobs, bounded retries, and redacted delivery status for authorized administrators.
- **The difference / concern:** The reminder design does not yet prove its in-app outcome, threshold behavior, or duplicate protection when a provider accepts an email just before a worker crash.
- **Severity:** Important · **Try this to check:** Exercise both threshold boundaries and the provider-acknowledgement crash window.

**Full workbook migration** — 🟡 Partly delivered

- **You asked for:** All 17 sheets and their operational meaning are preserved, not silently dropped.
- **What you'll actually get:** A detailed preview, identity-resolution and repeat-safe import plan maps every sheet. However, the plan names destination records for workgroups, lending, water-test cost sharing and garden/bazaar finances without giving those workflows a product owner, user journey, screen, permissions or build unit.
- **The difference / concern:** A migration can technically succeed while families lose the ability to borrow a book, join a water test, coordinate a workgroup, or understand a community balance.
- **Severity:** Blocker · **Try this to check:** For each of those four sheets, ask a user to find, view and perform its real-world next action after import; there is no complete planned journey to test.

**Privacy, retention and audit** — 🟡 Partly delivered

- **You asked for:** Restrict imported sensitive data, retain only what is needed, and delete/anonymize data after the final child leaves.
- **What you'll actually get:** Field policy, sibling and legal-hold handling, a 30-day grace period, redacted audit records and a yearly review workflow.
- **The difference / concern:** Historic optional profile data lacks a consent-import rule, and deletion needs a final atomic re-check for a new sibling, re-enrolment or hold.
- **Severity:** Blocker · **Try this to check:** Attempt optional-data import without consent, then race a sibling enrolment/hold against deletion.

**Hungarian, mobile, accessible service** — 🟡 Partly delivered

- **You asked for:** Hungarian mobile-first journeys with accessible core flows and defined performance/reliability expectations.
- **What you'll actually get:** The plan calls for Hungarian messages, responsive card alternatives and WCAG-oriented manual and automated checks. The browser/device matrix, core-flow data volumes, API contract coverage and the precise release evidence are not yet a single executable acceptance plan.
- **The difference / concern:** A team could claim the service is accessible and fast without testing the same users, devices, data volume or direct API behavior that parents and organizers will rely on.
- **Severity:** Important · **Try this to check:** Require a named device/browser and core-flow matrix, then execute each flow at the defined normal load and capture the outcome.

## Things the Plan Adds That You Didn't Ask For

**A separate developer-only production alert recipient** — Severity: Minor

- **The plan also builds:** Production alerts initially go only to the developer.
- **Your story asked for this?** No explicit owner or escalation model was requested.
- **Why it matters:** A failed reminder, security signal or import recovery may wait for an unavailable individual.
- **Your call:** Should a kindergarten operational owner and backup recipient receive these alerts too? → see Question 4.

## Where the Plan Disagrees With Itself or the Story

**A complete migration promise without complete post-import capabilities** — Severity: Blocker

- **The story implies:** Every legacy sheet retains its operational meaning.
- **The plan instead does:** It maps several sheets into named records but leaves their user-facing behavior and ownership undefined.
- **Which matches what you asked for:** The story's full-preservation promise.
- **Recommendation:** Explicitly choose, for every sheet, an interactive workflow, an accessible read-only archive, or a confirmed out-of-product destination; then include that choice in the build plan.

**A release-quality promise without a complete test task plan** — Severity: Blocker

- **The story implies:** The stated accessibility, security, reliability and recovery criteria are release gates.
- **The plan instead does:** It has requirements, unit contracts and construction work, but no single equivalent of an ordered tasks document that schedules all feature, API, migration, manual-accessibility and release-evidence work.
- **Which matches what you asked for:** A demonstrably complete release plan.
- **Recommendation:** Add a traceable task plan and make completion of each release gate an explicit task, not an aspiration.

## Acceptance Points That Can't Be Tested Yet

| Acceptance point (as written) | Why a tester can't pass/fail it | A testable version |
|---|---|---|
| All 17 sheets preserve their operational meaning | Some destination records have no defined end-user behavior. | For every sheet, identify the target capability, roles, actions, data retained, and acceptance scenario; approve archive-only treatment where applicable. |
| Core flows meet the performance target | "Normal" data volume and the exact core-flow/API list are not fixed in one test inventory. | Publish a fixture size, concurrent-user/load method and named journeys; each must complete within 2 seconds at the stated percentile. |
| WCAG 2.2 AA-aligned core flows | The final flow inventory, assistive technologies and pass criteria are not pinned. | List the journeys, browsers, keyboard/screen-reader checks and automated checks; require documented Pass/Fail evidence for each. |
| Import recovery completes within one hour | The start/end timestamps and drill data are not defined. | Run a documented failed import drill and measure from declared recovery start until administrators can verify correct service and data. |

## Risks, Assumptions & Quiet Gaps

| Item (plain language) | Why it matters | What QA should check | Severity |
|---|---|---|---|
| Remaining controller, lawful-basis, provider and EU-processing approvals | Real family data must not be processed in production on assumptions. | Block production until the named controller, agreements and regional configuration are evidenced. | Blocker |
| Workbook upload safety | A malformed, macro-enabled or oversized file can threaten service availability or import integrity. | Test supported template/version, encrypted/macro files, bad headers, merged cells, formulas, external links and size/time limits. | Important |
| Direct API parity | UI checks do not prove a caller cannot bypass privacy or validation. | Exercise each sensitive resource as every role through direct API calls, including revoked access. | Important |
| Responsibility change races | Simultaneous signup, swap and cancellation can leave wrong ownership or duplicate reminders. | Test final-slot races, retrying a request, cancellation during swap and stale browser versions. | Important |

## Questions for the PO / QA

| # | Question | Why we're asking | Suggested answer |
|---|---|---|---|
| 1 | For workgroups, library lending, water-test cost sharing and garden/bazaar finances, should each remain interactive in MVP, become a read-only archive, or move to a named external process? | The migration promise cannot be tested without a user-visible destination. | Decide one option per sheet before the related build work is approved. |
| 2 | Who owns the final, ordered build-and-test plan, and when will it include every release gate? | The current artifacts do not provide a complete task-level proof that the MVP can be delivered and certified. | Add and approve one traceable plan before feature completion is claimed. |
| 3 | May production launch before the data controller, lawful basis, provider agreements and EU-processing settings are recorded? | This determines whether handling real family data is permitted. | No — treat these as production-release blockers. |
| 4 | Who receives and escalates production alerts when the developer is unavailable? | Reminder/import/security failures need an operational response. | Name a kindergarten owner and backup, with a documented escalation path. |

## Summary Count

| Severity | Count |
|----------|-------|
| 🔴 Blocker | 6 |
| 🟠 Important | 9 |
| 🟡 Minor | 2 |

---

## Appendix (for developers) — technical traceability

| Capability | requirements.md | design / construction coverage | task-plan status | Notes |
|------------|-----------------|-------------------------------|------------------|-------|
| Authorization and family ownership | FR-01 to FR-04 | access-foundation, family-directory | no consolidated task plan | Strong contract coverage. |
| Coordination and reminders | FR-05 to FR-07, FR-13 to FR-14 | coordination-core, notification-jobs, parent-experience | no consolidated task plan | Strong state and retry contracts. |
| Migration | FR-08 to FR-12a | import-migration and mapping register | no defined product units for several sheet workflows | Must resolve legacy capability destinations. |
| Privacy | FR-15; NFR privacy baseline | privacy-audit | release decisions remain TBD | Block production until approved. |
| Quality | NFR locale/accessibility/reliability/release quality | interaction spec and checklist | no complete executable evidence plan | Pin scope and thresholds. |

## Challenger Review

Two fresh-context sub-agent passes challenged the report against the approved PRD, the independently inspected workbook baseline, the requirements, mapping register, and construction contracts. The coverage pass found missing PRD journey and state coverage; the adversarial pass found privacy, atomicity, delivery and lifecycle race gaps. The following deltas were confirmed and folded in.

### Challenger findings added to this review

1. **Optional profile data must not be imported merely because it appears in the workbook.** Occupation, hobbies and community-support values require recorded consent, but the import mapping does not state how historic values gain affirmative, auditable consent or are omitted pending it. This is a **Blocker** before real data import.
2. **The promised all-or-nothing import needs proof against its actual commit method.** The plan must show that a failure after work has started cannot reveal partial canonical records. If database-size chunks are used, it must define an equivalent staged-publish/compensating strategy. This is a **Blocker**.
3. **Rollback must protect legitimate changes made after import.** A later import rollback needs a cutover freeze or reconciliation rule so it cannot erase a parent's or organizer's subsequent change. This is **Important**.
4. **Reminder delivery needs a provider-side duplicate strategy.** A worker can crash after an email provider accepts a message but before the app records success. State the provider idempotency key or explicitly define and communicate at-least-once behavior. This is **Important**.
5. **The required notification outcome is incomplete.** Reminders need both in-app and email outcomes, including an exact rule for duties created or rescheduled inside the 7-day/24-hour thresholds and across Budapest daylight-saving changes. This is **Important**.
6. **Deletion needs a final atomic eligibility check.** A newly enrolled sibling, re-enrolment or a hold added just before deletion must defer it. This is **Important**.
7. **Several stated MVP journeys lack distinct acceptance traceability:** invitation/expiry/resend/setup, login-time upcoming-duty notice, notification centre read/link behavior, admin queue/filter behavior, and school-year archive/history. This is a **Blocker** because a release criterion can be lost despite apparently sound foundation contracts.
8. **The permission evidence must be a real role × resource × field matrix.** It must include group-admin cross-scope denial, read-only staff display-name-only behavior, sensitive reasons/contact values, audit access and direct API responses—not just one parent boundary. This is **Important**.
9. **The planned coordination tests must cover administrator-approved/rejected swaps, cancellation approval/rejection, own-only contribution editing, and allergen allow/deny behavior.** Until then this capability is **🟡 Partly delivered**, not fully delivered.
10. **Import acceptance must prove immutable preview binding, changed-row reporting, blocked-preview denial and validation parity across import, UI, API, invitations and profiles.** This is **Important**.

<!-- challenger-review: phase=requirement-qc mode=sub-agent passes=2 result=gaps-found -->

## Remediation Disposition

The previously open product and quality gaps are now specified in `aidlc/spaces/default/intents/260729-feature/inception/requirements-analysis/requirements.md` (FR-16 to FR-18 and NFR-08), `aidlc/spaces/default/intents/260729-feature/inception/requirements-analysis/migration-mapping-register.md`, and `aidlc/spaces/default/intents/260729-feature/construction/release-acceptance-plan.md`. Production controller, DPA/provider, and alert-escalation decisions remain explicit production-release gates rather than assumed approvals.
