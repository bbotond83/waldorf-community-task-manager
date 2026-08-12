# Delivery Planning Questions

## Strategic Decisions

### Q1 — Sequencing Heuristic

- A. Hybrid: walking-skeleton first, then value/risk-balanced parallel role slices, advanced admin, final verification. *(Recommended)*
- B. Pure value-first.
- C. Pure risk-first.
- X. Other (please specify)

[Answer]: A — Use the affirmed walking skeleton to prove browser/composition/build/start, then complete independent role value and high-risk admin/recovery paths. **Mode:** chat; grounded in team practices and approved DAG.

### Q2 — Scoring

- A. Lightweight WSJF using value + risk reduction + time criticality divided by relative size. *(Recommended)*
- B. No scoring rationale.
- C. Detailed financial model.
- X. Other (please specify)

[Answer]: A — Use relative 1–5 factors to explain sequence, not to override dependencies. **Mode:** chat.

### Q3 — Bolt Granularity

- A. Bundle shared foundation/façades with parent UI for the walking skeleton; use one unit per later role/advanced/verification Bolt. *(Recommended)*
- B. One Bolt for all units.
- C. One Bolt per route.
- X. Other (please specify)

[Answer]: A — Five Bolts keep the first deliverable executable and later changes reviewable. **Mode:** chat.

### Q4 — Parallelism

- A. Staff and administrator-core Bolts may run in parallel after the walking skeleton; all other dependency edges remain serial. *(Recommended)*
- B. Strictly serial.
- C. All Bolts parallel.
- X. Other (please specify)

[Answer]: A — This is the only dependency-safe economic parallel batch in the approved DAG. **Mode:** chat.

### Q5 — External Dependencies

- A. No external target blocks synthetic local completion; linked Supabase/provider/Vercel/Safari evidence stays OUTSTANDING and blocks future release claims only. *(Recommended)*
- B. Require linked production targets now.
- C. Deploy before verification.
- X. Other (please specify)

[Answer]: A — Local work is AI-contained except dependency installation and available browser/runtime tooling; no deployment occurs. **Mode:** chat.

## Bolt Plan Confirmation

1. **Walking Skeleton:** `runtime-foundation` + `application-facades` + `parent-web`; prove install, synthetic entry, one parent journey, authorization, build/start/smoke.
2. **Staff Visibility:** `staff-web`; prove privacy-minimized read-only schedule and denials.
3. **Administrator Core:** `admin-core-web`; prove scoped records/tasks/assignments/approvals/archive. May run in parallel with Bolt 2.
4. **Administrator Advanced:** `admin-advanced-web`; prove import/recovery, reminders, governance/revocation, and lifecycle.
5. **Verification & Handoff:** `verification-handoff`; prove full gates/runbook/evidence and no deployment.

All Bolts are owned by the AI developer mob with architect/quality/security support as needed. Approve this Bolt sequence?

- A. Approve Plan. *(Recommended)*
- B. Revise Plan.
- X. Other (please specify)

[Answer]: A — Approve Plan. **Mode:** chat; confirmed by the user.

## Sources

- `../requirements-analysis/requirements.md`
- `../user-stories/stories.md`
- `../refined-mockups/mockups.md`
- `../application-design/components.md`
- `../units-generation/unit-of-work.md`
- `../units-generation/unit-of-work-dependency.md`
- `../units-generation/unit-of-work-story-map.md`
- `../practices-discovery/team-practices.md`
