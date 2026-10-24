## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-20T16:20:00Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261012-real-backend-local/construction/u2-identity-and-access/infrastructure-design/infrastructure-specification.md > Configuration Changes, row "open sign-up" | The row sets `enable_signup` to false in both `[auth]` and `[auth.email]` and says both are true today. In the repository, `[auth]` is already false, and `supabase/config.toml` lines 77-81 keep `[auth.email] enable_signup = true` on purpose. In this CLI version, setting it to false turns off the whole email provider, so password sign-in and recovery stop working. A developer following the row would break sign-in, and the stated fallback does not cover this case. | Change the row to: false in `[auth]`, and `[auth.email] enable_signup` stays true. State that open sign-up is refused by the `[auth]` setting and proved by the real sign-up call in the read-back test. Fix the matching traceability target for NFR1.11. | Unresolved |
| R-02 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u2-identity-and-access/infrastructure-design/infrastructure-specification.md > Application Settings | The paragraph "How the key reaches the app" sits between the table rows and splits the table, so the `session secret` row renders outside the table. | Move the paragraph below the table, or move the session secret row above it. | Unresolved |
| R-03 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u2-identity-and-access/infrastructure-design/infrastructure-specification.md > Configuration Changes, mail server row, and cicd-pipeline.md > Files That Change | The mail server row says the SMTP port is read from the CLI status output at start. `config.toml` pins `smtp_port = 54325` and `ci.yml` hard-codes `SMTP_PORT: "54325"`. The CI file list names only `SMTP_HOST` and `SMTP_FROM`, not `SMTP_PORT`. | State one source of truth for the SMTP port, either the pinned value or the status output, and list `SMTP_PORT` in the CI file changes. | Unresolved |

> R-01 Reviewer note: Line 19 of infrastructure-specification.md still reads "false in both places (both are true today)". `supabase/config.toml` keeps `[auth.email] enable_signup = true` on purpose (lines 77-81), because false would disable email sign-in and recovery. The traceability target for NFR1.11 still says "false in both places".

> R-02 Reviewer note: The "How the key reaches the app" paragraph (line 41) still sits between the Application Settings table rows, so the `session secret` row (line 42) renders outside the table.

> R-03 Reviewer note: The mail server row (line 27) still says the SMTP port is read from the CLI status output. `config.toml` pins `smtp_port = 54325`, and `ci.yml` hard-codes `SMTP_PORT`. The CI file list in cicd-pipeline.md (line 9) names only `SMTP_HOST` and `SMTP_FROM`.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Manual re-read of the specification, cicd-pipeline.md and traceability.json | None of the three cited sections has changed. | All three prior findings are still open. |

### Summary

One Major and two Minor findings remain open, and none has been fixed. This is within the READY limit of at most two Major findings. The Major (R-01) should still be corrected before approval, because following the sign-up row would disable email sign-in.
