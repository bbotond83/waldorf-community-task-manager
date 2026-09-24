**Collaborator:** aidlc-design-agent

## Contribution

### Overall assessment

The artifacts preserve the approved product direction better than a demo-oriented rewrite would: the five inherited product personas remain primary, the Developer/Product Owner is correctly framed as an acceptance enabler, US-01 through US-14 remain normative, and the local-runtime stories cover role-aware navigation, synthetic identity, authorization denial, privacy-safe evidence, responsive behavior, and pre-deployment boundaries.

The contribution is not yet fully design-ready. US-LR-04 and especially US-LR-06 aggregate too many distinct workflows and user-visible states to remain independently testable. Their references to inherited stories and requirements establish traceability, but do not by themselves prevent implementation as a shallow dashboard that merely demonstrates representative states. Before delivery planning, every inherited workflow named by FR-LR-08, FR-LR-10, and FR-LR-10a should map to a concrete runnable scenario with entry point, screen states, permitted action, system feedback, recovery action, and terminal outcome.

### Persona fidelity and role navigation

- Keep the Developer/Product Owner as a delivery persona only. It must not become a sixth product authorization role or displace Parent and Kindergarten Administrator as the primary value journeys.
- Preserve separate Group Administrator, Kindergarten Administrator, and Super Administrator scenarios. The generic actor “Administrator” in US-LR-06 obscures materially different navigation, resource scope, settings access, and governance permissions. At minimum, acceptance examples must name the acting admin profile and expected scope in each scenario.
- The shell story correctly requires forbidden destinations to be absent. Add direct-navigation recovery: denied deep links should show a generic Hungarian denial, move focus to the denial heading, expose no resource existence or protected fields, and provide a safe route back to the current role’s home or previous permitted screen.
- Define the synthetic-profile chooser’s first-run/no-selection state. A user should see what each synthetic identity can exercise without revealing sensitive fixture detail; after selection, the current role and scope should remain visible. Switching should clear transient form state and prior session data, announce the new identity, move focus to the destination H1, and never carry the user into a route the new role cannot access.
- Navigation acceptance should cover desktop and collapsed mobile navigation, current-page indication that is not color-only, menu open/close semantics, Escape behavior, focus return, and consistent ordering across roles.

### End-to-end states and recovery

- US-LR-04 needs explicit Parent states for initial loading, no linked duties/empty schedule, available duty, full/ineligible duty, mutation pending, success, conflict/invalidated, dependency failure, retry, and rejected/approved request detail. “Match US-01 through US-04” is too implicit for a runnable browser acceptance slice.
- US-LR-05 has the clearest state and recovery coverage. Retain its loading → empty/error → clear filters/retry loop as the pattern for other surfaces, including preservation of filter context after retry where safe.
- Split or scenario-map US-LR-06 by operator workflow: records; tasks/events; assignments; approval detail; import preview/commit/recovery; reminder queue/status; archive/lifecycle; and permitted settings. Each destructive or consequential action needs review/confirmation, pending protection against duplicate submission, success feedback, partial/atomic-failure behavior, and a deterministic recovery path. Import and lifecycle flows must state whether the user resumes, retries, rolls back, or receives an explicit non-recoverable outcome.
- Add edge-state acceptance for long Hungarian labels/names, missing optional data, large queues, stale data after revocation, and slow operations. Loading beyond the normal response window should provide an actionable status rather than an indefinite spinner.
- Simulated provider/database effects must be visibly labelled as synthetic in the UI and evidence, without changing the product workflow semantics. The label must not be the only distinction between success and outstanding real-target verification.

### Accessibility acceptance

- US-LR-03 provides a good baseline with a skip link, landmarks, one H1, visible focus, status region, keyboard use, zoom, and touch targets.
- Extend story-level acceptance to form errors: visible labels, error text associated with the field, error summary for multi-field submissions, focus moved to the summary or first invalid field, and no color-only error indication.
- Specify route-change and asynchronous feedback announcements. Page changes should move focus predictably to the H1; pending/success/error changes should use an appropriate polite or assertive live region without duplicate announcements.
- Cover dialogs and menus where used: focus containment, Escape close where cancellation is safe, focus return to the trigger, and no background interaction. Destructive confirmation dialogs must name the affected object and consequence.
- Require accessible names and state for controls, logical heading order, non-color status indicators, reflow without loss of action at inherited zoom expectations, reduced-motion behavior for non-essential animation, and keyboard alternatives for any drag/reorder interaction.
- Automated accessibility scans in US-LR-08 are necessary but insufficient. Keep explicit keyboard, focus, zoom/reflow, and screen-reader announcement assertions in the critical Parent, Staff, and administrator journeys.

### Preservation of the prior application

The normative-inheritance statement should explicitly encompass the previously approved UX and application-design behavior, not only prior personas and stories. The implementation should preserve inherited information architecture, Hungarian domain terminology, workflow sequence, privacy boundaries, and detail-screen states. The new shell, synthetic selector, adapters, and evidence surfaces are delivery scaffolding around that product; they are not permission to replace it with role-labelled demo cards or a generic task list.

A practical preservation gate is a trace table from every inherited US-01–US-14 acceptance path to at least one local route and browser scenario, with the relevant populated, loading, empty, denied, failure/retry, and invalidated states. Any inherited path without a route and observable scenario remains unimplemented, even if the shared shell and representative role dashboards run.

## Positions

1. **Retain the chosen persona model.** Five inherited product personas plus one delivery persona is the correct hierarchy; the delivery persona must not become a product role.
2. **Do not accept US-LR-06 as one delivery-sized story.** Preserve its umbrella traceability, but split or scenario-map it by administrator role and workflow before implementation planning.
3. **Make preservation testable.** Add an explicit inherited-story-to-route/browser-scenario matrix so “runnable application” cannot be satisfied by representative demo screens.
4. **Standardize the five user-visible states.** Every primary surface needs loading, empty, populated/success, error with recovery, and partial/edge behavior; consequential mutations additionally need pending, conflict/invalidated, and duplicate-submit prevention.
5. **Treat denial as a recoverable UX state.** Forbidden navigation stays absent; direct access receives privacy-safe denial, predictable focus, and a safe permitted destination.
6. **Make profile switching an accessible session transition.** Clear prior state, recalculate authorization, announce the selected role/scope, and move focus to the new page heading.
7. **Keep accessibility in story acceptance, not only in the quality gate.** Automated scans must be supplemented by keyboard, focus, form-error, announcement, zoom/reflow, touch-target, and non-color assertions in critical journeys.
8. **Keep synthetic simulation unmistakable but workflow-faithful.** Users must be able to distinguish simulated effects from real-target evidence without weakening authorization, validation, privacy, or recovery behavior.
