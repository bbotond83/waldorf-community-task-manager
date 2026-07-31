# Requirements Analysis Questions

These questions resolve the remaining decisions needed to make the approved MVP requirements testable. They build on the intent statement, scope definition, and affirmed team practices.

## Q1 — Product Decision Owner

Who makes final product and release decisions when priorities, privacy, swaps, or cancellation rules need clarification?

- A. A named kindergarten administrator owns product decisions; technical lead owns release readiness.
- B. A small steering group of administrator, parent representative, and technical lead decides by consensus.
- C. The project sponsor makes all final decisions.
- D. The delivery team decides within the approved scope.
- E. Define another named decision model.
- X. Other (please specify)

[Answer]:

## Q2 — Launch Boundary

What launch target should make the MVP release plan measurable?

- A. Pilot with one kindergarten group before broader rollout.
- B. Launch to all active families at the kindergarten in one school year.
- C. Run a limited administrator-only beta before inviting families.
- D. Set the launch target after the Excel-import data assessment.
- E. Define a different rollout boundary and date.
- X. Other (please specify)

[Answer]:

## Q3 — Privacy Operations

Which privacy operating baseline should be a release requirement for family and child data?

- A. Name a data controller, document retention/deletion rules, and complete a GDPR review before production. *(Recommended)*
- B. Use a standard privacy notice only; define retention after launch.
- C. Limit production to synthetic data until an external privacy review is complete.
- D. Assign the kindergarten administrator as data owner and defer formal documentation.
- E. Define a stricter privacy-governance baseline.
- X. Other (please specify)

[Answer]:

## Q4 — Service Reliability

What measurable availability and performance target should the initial release meet?

- A. Key parent and admin pages load within 2 seconds at normal expected use; scheduled reminders are retried and failures are visible to admins. *(Recommended)*
- B. Define only functional correctness for MVP; performance targets come after pilot feedback.
- C. Require 99.9% monthly availability and sub-second page loads.
- D. Require a documented recovery objective but no page-load target.
- E. Define different measurable service targets.
- X. Other (please specify)

[Answer]:

## Q5 — Notification Failure Handling

How must the system behave when an assignment reminder email cannot be delivered?

- A. Persist an in-app notification, retry delivery, and show the failure to an administrator. *(Recommended)*
- B. Retry email silently and keep no separate notification record.
- C. Show the failure only to the affected parent.
- D. Require manual administrator resend without automatic retry.
- E. Define another escalation policy.
- X. Other (please specify)

[Answer]:

## Q6 — Accessibility and Language

What baseline should apply to the Hungarian, mobile-friendly experience?

- A. Hungarian UI and WCAG 2.1 AA-aligned keyboard, contrast, and form-validation support for core flows. *(Recommended)*
- B. Hungarian UI only; accessibility improvements follow the pilot.
- C. Hungarian and English UI at launch with WCAG 2.1 AA support.
- D. Mobile responsiveness only; accessibility is out of scope for MVP.
- E. Define another language or accessibility commitment.
- X. Other (please specify)

[Answer]:
