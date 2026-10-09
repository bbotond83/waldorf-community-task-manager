# Refined Mockups Accessibility Checklist

## Verification Targets

These are implementation/verification targets, not completed checks. Retain the approved critical browser flow's **no serious or critical automated accessibility violations** requirement, keyboard operability and existing localization behavior. English development role name: Kindergarten teacher; Hungarian UI label: `Óvónő`.

- [ ] Current four-role selection has semantic card headings, native buttons and understandable scope summaries; no obsolete fifth-role option is accessible.
- [ ] Existing skip link and header/navigation/main landmarks remain available, with logical heading order and Hungarian document language.
- [ ] Native group/date inputs have visible associated labels; filter submit/reset actions work by keyboard with visible focus.
- [ ] Wider table has a descriptive localized caption and column headers; Owner, Assignees and Status values are correctly associated with their item.
- [ ] Narrow cards retain the same tracking information using semantic labels; the hidden table/card alternative is not focusable or redundantly announced.
- [ ] Status, read-only context, denial and missing data use meaningful text independent of color; missing owner/assignment never appears as an invented person.
- [ ] Authorized empty results announce the existing understandable status; no-group/denied states remain distinct without naming unauthorized content or showing a create-task action.
- [ ] Validation/dependency errors and session expiry offer the specified safe recovery, preserve appropriate focus and do not expose stale protected content.
- [ ] Detail headings/back links preserve the existing focus pattern and safe filter context; no keyboard trap or new modal is introduced.
- [ ] Labels, owner/assignee names and long task titles wrap at narrow widths/zoom; touch targets and spacing retain the current usable dimensions.
- [ ] Text, meaningful controls and focus indicators have sufficient contrast in the actual rendered state; CSS token inspection alone does not count as a contrast measurement.
- [ ] Existing reduced-motion preferences are retained; no new animation or realtime announcement loop is added.
- [ ] The actual critical teacher flow is checked using the existing browser/accessibility tooling during Build and Test, with measured results recorded there.

## Security and Accessibility Boundaries

Hidden mutation controls are a usability decision, not authorization proof. Protected requests must independently enforce the current teacher's group scope, field allowlist and read-only permissions. Denied rows and hidden private fields must not remain in the DOM or response data. Screen-reader labels and error descriptions must not introduce unauthorized owner/group disclosure.

## Sources and Outstanding Evidence

[stories.md](../user-stories/stories.md), particularly AC2.1.6; [requirements.md](../requirements-analysis/requirements.md), NFR1–NFR3; [team-practices.md](../practices-discovery/team-practices.md); completed [refined-mockups-questions.md](refined-mockups-questions.md); current CSS focus/target/breakpoint conventions. Rough `wireframes` and `user-flow` are absent. No automated scan, manual keyboard check, browser render or measured contrast result has been obtained in this stage.
