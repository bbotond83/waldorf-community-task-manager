# Accessibility Checklist

## Scope and Sources

This checklist applies to the current [wireframes](../../ideation/rough-mockups/wireframes.md), [user flow](../../ideation/rough-mockups/user-flow.md), [stories](../user-stories/stories.md), [requirements](../requirements-analysis/requirements.md), [team practices](../practices-discovery/team-practices.md), and the inherited `260729-feature` refined experience. The target is WCAG 2.2 AA-aligned behavior for the complete locally runnable application.

## Page Structure and Navigation

- [ ] The document declares Hungarian language and each route has one `main` and one descriptive H1.
- [ ] A visible-on-focus skip link is the first focusable element.
- [ ] Header, role navigation, main content, and supporting regions use semantic landmarks.
- [ ] Role navigation exposes only authorized destinations and identifies the current page without color alone.
- [ ] Direct denial contains no protected heading, row, field, count, or cached content.
- [ ] Route changes focus H1; profile switching clears scoped content before focus moves.

## Keyboard and Focus

- [ ] Every action works by keyboard; no pointer-only, hover-only, drag-only, or horizontal-swipe-only operation exists.
- [ ] Focus order follows skip link → header → navigation → context → content → actions → feedback.
- [ ] Visible focus meets the 2px and 3:1 UI-contrast baseline.
- [ ] Dialogs trap focus, close with Escape where safe, and restore the trigger.
- [ ] Validation focuses the error summary and links each error to its field.
- [ ] Inline mutation retains focus; denial, invalidation, and terminal recovery focus their headings.

## Forms and Dynamic States

- [ ] Inputs have visible labels, instructions, autocomplete only where safe, and specific Hungarian error text.
- [ ] Required groups use `fieldset`/`legend`; optionality is communicated in text.
- [ ] Pending state disables duplicate submission and communicates progress textually.
- [ ] Loading and ordinary outcomes use polite status announcements; critical errors use alerts without repeated interruption.
- [ ] Empty, error, denied, conflict/invalidated, and recovery states each include an understandable permitted next action.
- [ ] Import step and conflict progress are announced; row-error links focus the affected control.

## Perceivability and Responsive Behavior

- [ ] Normal text contrast is at least 4.5:1; large text and UI components are at least 3:1.
- [ ] Status never relies on color alone; text and, where useful, an icon accompany it.
- [ ] Touch targets are at least 44×44 CSS pixels with sufficient separation.
- [ ] Layout remains usable at 320px width and 200% zoom without loss of content or action.
- [ ] Tables have header associations; mobile card alternatives retain every permitted label, value, and action.
- [ ] Motion is under 300ms and respects `prefers-reduced-motion`.

## Privacy and Authorization Accessibility

- [ ] Screen-reader output contains no prohibited route, field, hidden contact, unrelated-family row, or protected reason.
- [ ] Read-only staff schedule exposes only permitted schedule and coordination display-name fields.
- [ ] Immediate revocation removes protected content before announcing denial.
- [ ] Synthetic identity summaries contain invented role/scope data only and are absent in production composition.
- [ ] Error, audit, reminder, and provider statuses remain privacy-safe at visual and accessibility-tree levels.

## Critical Flow Evidence

- [ ] Local startup: resolving, selector, no-profile, session failure/retry, selection, switch, and direct-URL outcomes.
- [ ] Invitation/authentication: valid, expired, used, invalid/unknown, resend, validation, pending, upcoming-duty, no-duty, denied, retryable failure, and terminal failure with non-enumerating copy.
- [ ] Parent: duty list/detail, signup, swap, cancellation, notification, full/ineligible, invalidated, and failure/retry.
- [ ] Staff: schedule/filter/detail plus negative mutation, field, unrelated-row, and route checks.
- [ ] Administrator: dashboard, records, task/event, assignment, approval, import/recovery, reminders, access revocation, privacy lifecycle, and archive.
- [ ] Automated axe-style checks report no serious or critical violations on critical Chromium/Firefox/mobile-emulation flows.
- [ ] Manual keyboard, focus, 200% zoom, and screen-reader smoke results are versioned as Pass/Fail evidence.
- [ ] Safari desktop and mobile Safari smoke remain explicit release evidence; unavailable execution is recorded as a blocker or dated approved exception.

## Acceptance Boundary

Synthetic local checks must prove UI/API authorization parity, privacy-safe output, state recovery, and accessibility without real personal data or paid services. They must not be reported as evidence of real Supabase RLS, provider delivery, Vercel deployment, or production accessibility. Those checks repeat only after targets are linked; this intent deploys nowhere.
