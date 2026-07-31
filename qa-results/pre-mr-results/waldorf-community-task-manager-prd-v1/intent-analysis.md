# Intent analysis — Waldorf Ovi Community Task Manager PRD v1

<!-- approved-story-digest: sha256=c06fcc4da328de9d8f571f308bf7f832172e7e13a5d9f4e76543d8f6d187870c file=apps/waldorf-community-task-manager/source-materials/waldorf-community-app/waldorf-community-task-manager-prd-v1-en.md at=2026-07-31T12:58:49Z -->

## Review basis

- Product source: `source-materials/waldorf-community-app/waldorf-community-task-manager-prd-v1-en.md`
- Independent domain map: `.ai-qlc/memory-map/`
- Existing-workflow baseline: `domain/Ovis tábla v2.xlsx`, documented in `baseline-spreadsheet-evidence.md`
- Implementation check: no application source directories matching the configured code scope were present, so current implemented behavior could not be evaluated.

## Independent understanding of the intent

The product should replace a privacy-unsafe, manually coordinated workbook with a Hungarian, mobile-first system that tells parents what they need to do and when, while giving authorized organizers reliable control over people, families, school years, tasks, events, assignment changes, reminders, and migration. The highest-impact promise is not simply digitizing rows: it is preserving the community's real operating capability while improving privacy, accountability, and ease of use.

The PRD is strong on product vision, core personas, language rules, high-level RBAC, task/signup workflows, notification channels, dashboards, and release outcomes. Its main weakness is at the migration boundary: the verified workbook contains several domain workflows and data shapes that the generic task/event model does not yet explain.

## Affected areas and real-world risks

1. **People and privacy.** The source contains substantially more personal data than the planned profile model. Without field-by-field import and retention decisions, sensitive data may be silently lost, overexposed, or retained without purpose.
2. **Assignment ownership.** The workbook assigns many duties to families or child labels, while the PRD's assignment belongs to one user. A wrong decision here can duplicate obligations, notify the wrong parent, or make shared-family duties impossible to manage.
3. **Scheduling and recurring operations.** Free-text weekly ranges, school breaks, seasonal variants, and weekend sub-shifts need deterministic conversion. Ambiguity will create wrong reminders and missed animal-care, cleaning, or water duties.
4. **Operational detail and safety.** Animal care and large cleaning depend on procedures, materials, dependencies, and safety notes. Flattening these to title/description risks unsafe or incomplete work.
5. **Baseline capability loss.** Workgroups, maintenance backlogs, lending, water-test cost sharing, food/allergen planning, and finance tracking have no fully defined destination. A web replacement can be adopted only if users know what moves, what stays elsewhere, and what is intentionally retired.
6. **Migration correctness.** The workbook is free-form and inconsistent. Preview/validation alone is not testable until identity matching, duplicate handling, row mapping, retries, rollback, and reconciliation rules are defined.
7. **Authorization surface.** The product exposes UI and REST API. The PRD states server-side authorization but does not define resource-by-resource scope behavior or API outcomes for denied access.

## Gaps and ambiguities requiring a product decision

### Must resolve before requirements/design

1. **Workbook scope — decision recorded:** All 17 sheets must be migrated and none may be silently dropped. **Still open:** the target product record/capability for each sheet and row type.
2. **Assignment owner — decision recorded:** Duties belong to a family. **Still open:** which linked parent receives notifications, who may act for the family, and how shared responsibility is displayed.
3. **Extra personal fields — decision recorded:** Residence, occupation, hobbies, and “how you support the community” must be imported. **Still open:** their lawful purpose, role visibility, edit rights, and deletion behavior.
3a. **Contact-format policy:** Define accepted email forms (including plus-tags and the IDN/EAI policy), accepted Hungarian/international phone inputs, canonical E.164 storage, and blank/null versus invalid behavior. UI, invitations, profiles, REST, and import must use the same server-authoritative validation, stable English error codes, and Hungarian field messages. Why: inconsistent normalization can reject valid families, create duplicates, or let direct API calls bypass UI rules.
4. **Identity matching:** What uniquely identifies a parent, child, and family during import, and how should spelling variants, aliases, shared children, multiple parents, and multiple people in one cell be resolved? Why: incorrect matching can expose or assign one family's data to another.
5. **Import transaction and cutover behavior — partial decision:** Reprocessing must be repeat-safe and create no duplicates. **Still open:** atomicity, rollback, immutable preview binding, concurrency/cutover, and recovery after a later-discovered failure.
6. **Locale, Unicode, and time contract — decision recorded:** `hu-HU`, `Europe/Budapest`, RFC 3339 REST timestamps, UTF-8, consistent normalization, and Hungarian-aware search/sort are mandatory across UI, API, and import. **Still open:** deterministic conversion of every legacy week/range/break value.
7. **Task detail model:** Will tasks support structured sub-shifts, procedures, materials, safety warnings, dependencies, priority, and organizer notes, or will some of these remain unstructured text? Why: a generic description field may not preserve actionable and safety-critical detail.
8. **Completion/status — decision recorded:** Existing maintenance and large-cleaning status/progress/completion must be preserved. **Still open:** whether ongoing completion is supported or imported status is read-only/limited.
9. **Library workflow — partial decision:** Library data must be migrated. **Still open:** whether lending, due dates, and waitlists remain interactive capabilities or preserved records only.
10. **Water-testing workflow — partial decision:** Water-testing data must be migrated. **Still open:** whether provider pricing, opt-in, and cost sharing remain interactive capabilities.
11. **Workgroups — partial decision:** Workgroup data must be migrated. **Still open:** whether workgroups are first-class product concepts or mapped into another module.
12. **Finance ledger — partial decision:** Garden/bazaar finance data must be migrated. **Still open:** its target representation and how that coexists with the PRD's exclusion of payment management.
13. **Event contributions and allergens — decision recorded:** Supplies, food contributions, allergens, and related event-planning details may be free-text notes. **Still open:** edit permissions and how safety-relevant text is made prominent.
13a. **Eligibility and assignment collisions:** Define task eligibility by school year, group, family/parent relationship, visibility, deadline, and assignment state. Should overlapping duties or duplicate family responsibilities be blocked, warned, or admin-overridable? What happens when two users claim the final slot concurrently? Why: “eligible” and “capacity” are not currently testable and a race can overbook a duty.
13b. **Category and row mapping:** Approve the final category taxonomy and state whether each migrated sheet/row becomes a task, event, assignment, procedure/reference record, workgroup, specialized workflow, or archive-only record. Why: sheet-level inclusion alone does not define deterministic migration.
13c. **Supported and untrusted workbook contract:** Pin the supported file type/template/version, required sheets and headers, and handling for merged cells, formulas/cached values, hyperlinks/external relationships, hidden or extra columns, reordered sheets, malformed/encrypted/macro-enabled files, and compressed/expanded size limits. Define MIME/content validation, no network retrieval, parser time/memory caps, sanitization/quarantine, source-file retention/deletion, and which validation severities block commit. Why: uploads are both a data-integrity and hostile-file boundary.

### Must make acceptance testable

14. **Names versus contacts — decision recorded:** Parents and read-only staff may see participant display names for coordination; this does not grant access to contact or other restricted personal fields. **Still open:** exact screens/resources and scope boundaries.
15. **All-role authorization and revocation matrix:** Define what Super Admin, Kindergarten Admin, Group Admin, Parent, and Read-only Staff can read/change across organization, school year, group, family, child, event, task, assignment, notification, import, and audit resources—including direct REST calls and denial outcomes. Also define immediate behavior for deactivated users and removed roles/scopes: existing sessions/tokens, cached pages, open tabs, queued requests, and in-flight writes must not preserve sensitive access. Why: vague scope plus stale authorization can expose family data after permission loss.
16. **Notification trigger, retry, and privacy contract — partial decision:** Reminders are required both 7 days and 24 hours before a duty. **Still open:** deduplication, rescheduling, recipients, batching, manual reminders, retries, stale-message cancellation, reason visibility, link authorization, and delivery-log access.
17. **Atomic swap/cancellation state model:** Decide whether a takeover can auto-approve, whether every cancellation needs approval, and what happens when the task is full, near-term, started, cancelled, or archived. Define legal transitions and conflict behavior for simultaneous swap/cancellation requests, two reviewers, replacement signup, and repeated commands; exactly one resulting assignment, audit event, and notification set must be created. Why: competing workflow actions otherwise produce contradictory ownership and duplicate messages.
18. **School-year archive:** Define who can view archived data, which fields remain editable, how rollover copies or resets groups/tasks, and how source-year assignments are retained. Why: “read-only by default” leaves data integrity and continuity ambiguous.
19. **Privacy, leakage, deletion, and retention — partial decision:** Retention must be reviewed annually and deletion is mandatory when a child leaves the kindergarten. **Still open:** trigger/deadline, sibling cases, exact parent/family records affected, audit anonymization, export/correction, source-file retention, allowlisted API representations, caching, logging, analytics, provider metadata, and client storage controls.
20. **REST API contract:** Define which endpoints/resources are part of MVP, validation/error semantics, pagination/filtering, authorization outcomes, and idempotency expectations. Why: REST is in scope but the PRD currently specifies behavior mainly through UI journeys.
21. **Measurable quality gates:** Confirm supported browsers/devices, accessibility target and manual checks, normal data volumes behind the 2-second target, notification delivery/retry expectations, and availability/recovery expectations. Why: the current NFRs are directionally good but not consistently measurable.

## Explicit assumptions pending confirmation

- The PRD is the product-intent source, while the workbook is the real migration baseline.
- The application is greenfield at review time; no running app or implemented REST surface was available.
- The workbook's personal records must not be copied into QA artifacts or test fixtures.
- AI-DLC requirements, design, and tasks are intentionally deferred to a later Requirement QC run.

## Human Challenger decisions incorporated

The product owner confirmed: migrate every workbook sheet; make duties family-owned; import the extra personal fields; preserve baseline status/completion; keep event contributions/allergens as free text; make import repeat-safe; allow participant display names; send both 7-day and 24-hour reminders; mandate the proposed Hungarian/time/format standards; and review retention annually with mandatory deletion when a child leaves. The PRD now contains these decisions in Section 27. Unanswered sub-decisions remain explicitly open above.

## Intent verdict after the human gate

**Improved but not yet fully ready for requirements/design.** The product owner resolved the major direction choices. The remaining open details still affect deterministic workbook mapping, identity matching, import recovery, family-member behavior, exact permissions, concurrency, notification privacy, deletion scope, and measurable quality gates; they must be resolved in the affected requirements/design before approval.

## Challenger Review

Three fresh-context sub-agent passes challenged this analysis against the PRD, the 17-sheet workbook baseline, the memory map, and relevant accessibility, security, identifier, Unicode, and HTTP standards. The lenses were: coverage/parity; adversarial state, privacy, and migration failure; and UI/API standards consistency. All three found material gaps, which were folded into the questions above. The review stopped at the configured three-pass ceiling.

<!-- challenger-review: phase=intent mode=sub-agent passes=3 result=gaps-found -->
