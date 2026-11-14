# Observability Design: u3-directory-and-profile

How the targets in `observability-requirements.md` are met, following `functional-spec.md`, `rules.md` and C1 in `contract-summary.md`. The app runs only on the owner's computer, so no metrics, tracing, alerting or SLO is designed.

## Audit

NFR4.4: the audit action check constraint is widened by the migration to add `profile.sharing_changed`, `account.password_changed`, `account.email_change_requested`, `account.email_changed`, `family.added`, `parent.added`, `parent.removed` and `invitation.sent`, keeping every existing action, so past rows stay readable. A test inserts a row of each existing kind before applying the change.

## Event Lines

Password and email changes and failed sends use the sign-in service's existing event lines with keyed hashes of the account and address, never the address or a name (NFR4.7, NFR4.8). New lines: `password_change_audit_failed`, `sessions_end_failed`, `email_change_mail_failed` and `email_rate_limited`. Each carries a reason code and no personal data. A test reads the lines emitted for each failure.

## Screen States

Each screen has three separate states: error, denied and empty. A failed read or a refusal shows the existing error or denied state and never the empty directory text or "Nincs találat" (NFR4.5). A browser or component test covers each state.

## Refusal Codes

Every refusal names its code in the result envelope so the screen can explain it and tests can assert it (NFR4.6): VERSION_CONFLICT, PROFILE_FIELD_INVALID, PASSWORD_CURRENT_WRONG, PASSWORD_INVALID, EMAIL_INVALID, EMAIL_UNAVAILABLE, EMAIL_LINK_INVALID, EMAIL_RATE_LIMITED, PARENT_LAST_IN_FAMILY and PARENT_HAS_ACCOUNT. EMAIL_RATE_LIMITED (retryable after the hour passes; the screen says "Túl sok levél, próbáld később.") is added to the refusal list of `rules.md` and NFR4.6 by this design; an invitation mail failure keeps today's existing line `invitation_mail_failed` (asserted by `src/identity/invitations.test.ts`), and `email_change_mail_failed` covers the email-change link and change notice only. The screens map each to a fixed Hungarian message in the existing message-mapping file.
