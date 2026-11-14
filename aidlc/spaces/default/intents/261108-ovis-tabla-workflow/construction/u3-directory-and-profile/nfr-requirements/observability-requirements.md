# Observability Requirements: u3-directory-and-profile

Sources: NFR4 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C1 in `contract-summary.md`, and `technology-stack.md`. The app runs only on the owner's computer, so no monitoring, alerting or SLO applies yet.

## Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.4 | The audit action check constraint gains `profile.sharing_changed`, `account.password_changed`, `account.email_change_requested`, `account.email_changed`, `family.added`, `parent.added`, `parent.removed` and `invitation.sent`, and past audit events stay readable. | A test applies the change over an audit row of each existing kind. |
| NFR4.5 | A failed read or refusal shows the existing error or denied state, never an empty directory ("Még nincs szülő a névsorban.") or "Nincs találat". | A browser or component test covers each state. |
| NFR4.6 | A refusal names its code in the result envelope (VERSION_CONFLICT, PROFILE_FIELD_INVALID, PASSWORD_CURRENT_WRONG, PASSWORD_INVALID, EMAIL_INVALID, EMAIL_UNAVAILABLE, EMAIL_LINK_INVALID, PARENT_LAST_IN_FAMILY, PARENT_HAS_ACCOUNT) so the screen can explain it and tests can assert it. | Each code has a test that asserts it. |
| NFR4.7 | The sign-in service's existing event lines cover password and email changes with keyed hashes, never an address or name. | A test reads the emitted lines. |
| NFR4.8 | A failed email send emits one event line and no address (as `invitation_mail_failed` does today). | A test fails the mailer and reads the line. |
