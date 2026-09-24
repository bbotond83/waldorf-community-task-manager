# Refined Mockups Questions

## Resolved Design Decisions

These questions are answered from the approved `260729-feature` refined mockups and the current intent's approved rough mockups, requirements, user stories, and team practices. They preserve the existing application design and add only the states needed to run and test it locally.

## Q1 — Story Representation

How should the inherited user stories be represented in the locally runnable UI?

- A. Preserve every approved parent, staff, and administrator surface and add only synthetic local entry and verification states. *(Recommended)*
- B. Replace the inherited application with a smaller task demo.
- C. Redesign the product before local implementation.
- X. Other (please specify)

[Answer]: A — Preserve every approved surface; the local-runtime stories extend rather than replace US-01 through US-14. **Mode:** chat; resolved from the user's explicit reuse instruction and approved artifacts.

## Q2 — Interaction Patterns

Which interaction patterns should the local application use?

- A. Dedicated detail pages for complex workflows, inline feedback for simple actions, and a staged import flow. *(Recommended)*
- B. Modal dialogs for every workflow.
- C. One generic wizard for all actions.
- X. Other (please specify)

[Answer]: A — Reuse the approved interaction specification without redesign. **Mode:** chat; resolved from the approved `260729-feature` interaction specification.

## Q3 — Required Screen States

Which observable states must local synthetic mode expose?

- A. Initial, loading, empty, validation, pending, success, denied, conflict/invalidated, dependency failure, retry, and recovery states. *(Recommended)*
- B. Happy paths only.
- C. Loading, success, and generic error only.
- X. Other (please specify)

[Answer]: A — Expose the complete approved state inventory with privacy-safe synthetic fixtures. **Mode:** chat; resolved from FR-LR-03, FR-LR-08 through FR-LR-10a, and the approved rough mockups.

## Q4 — Design System Alignment

How should the implementation align with the existing design system?

- A. Reuse the approved semantic shell, Hungarian copy, status patterns, cards, forms, tables, and detail workflows. *(Recommended)*
- B. Introduce a new visual system for local mode.
- C. Leave component behavior unspecified.
- X. Other (please specify)

[Answer]: A — Preserve the approved component vocabulary and make local-only identity controls visually subordinate and development-only. **Mode:** chat; resolved from the prior design-system mapping and current team practices.

## Q5 — Accessibility Target

What accessibility baseline applies?

- A. WCAG 2.2 AA-aligned keyboard, focus, landmark, form-error, status, contrast, zoom, and touch-target behavior. *(Recommended)*
- B. Automated contrast checks only.
- C. Defer accessibility until deployment.
- X. Other (please specify)

[Answer]: A — Preserve the approved WCAG 2.2 AA-aligned baseline and require no serious or critical automated violations in critical flows. **Mode:** chat; resolved from NFR-LR-03 and team practices.

## Q6 — Responsive Breakpoints

Which responsive behavior should be specified?

- A. Mobile-first fluid layout with breakpoints at 768px, 1024px, and 1440px; dense tables become accessible cards. *(Recommended)*
- B. Desktop-only tables.
- C. Separate unrelated mobile and desktop experiences.
- X. Other (please specify)

[Answer]: A — Reuse the approved mobile-first layout and preserve reading/focus order across breakpoints. **Mode:** chat; resolved from the prior refined mockups and current rough wireframes.

## Q7 — Local Runtime Boundary

How should local identity and adapter behavior appear in the UI?

- A. Development-only synthetic profile selection with explicit startup/failure states; production configuration omits it and uses the approved authentication boundary. *(Recommended)*
- B. Show synthetic profiles in every environment.
- C. Require production credentials for local testing.
- X. Other (please specify)

[Answer]: A — Synthetic profiles and simulated outcomes are local-only, privacy-safe, and authorization-equivalent; this intent deploys nowhere. **Mode:** chat; resolved from FR-LR-02, FR-LR-03, FR-LR-13a, and the user's deployment clarification.

## Consolidated Summary Confirmation

The refined UX will preserve the approved full application, use its existing detail-page/inline-feedback patterns, expose the complete local state inventory, reuse the approved Hungarian design system, meet the WCAG 2.2 AA-aligned baseline, adapt mobile-first at the documented breakpoints, and confine synthetic identity/adapters to local development. Does this all look correct before I generate the artifacts?

- A. Looks correct. *(Recommended)*
- B. Request changes.
- X. Other (please specify)

[Answer]: A — Looks correct. **Mode:** guided; confirmed via structured question.

## Sources

- `../../ideation/rough-mockups/wireframes.md`
- `../../ideation/rough-mockups/user-flow.md`
- `../user-stories/stories.md`
- `../requirements-analysis/requirements.md`
- `../practices-discovery/team-practices.md`
- `../../../260729-feature/inception/refined-mockups/mockups.md`
- `../../../260729-feature/inception/refined-mockups/interaction-spec.md`
- `../../../260729-feature/inception/refined-mockups/design-system-mapping.md`
- `../../../260729-feature/inception/refined-mockups/accessibility-checklist.md`
