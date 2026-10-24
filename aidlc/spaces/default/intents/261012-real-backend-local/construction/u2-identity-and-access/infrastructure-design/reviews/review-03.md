## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-20T16:09:39Z
**Iteration:** 2

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261012-real-backend-local/construction/u2-identity-and-access/infrastructure-design/infrastructure-specification.md > Configuration Changes, row "open sign-up" | The row sets `enable_signup` to false in both `[auth]` and `[auth.email]` and says both are true today. In the repository, `[auth]` is already false, and `supabase/config.toml` lines 77-81 keep `[auth.email] enable_signup = true` on purpose. In this CLI version, setting it to false turns off the whole email provider, so password sign-in and recovery stop working. A developer following the row would break sign-in, and the stated fallback does not cover this case. | Change the row to: false in `[auth]`, and `[auth.email] enable_signup` stays true. State that open sign-up is refused by the `[auth]` setting and proved by the real sign-up call in the read-back test. Fix the matching traceability target for NFR1.11. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u2-identity-and-access/infrastructure-design/infrastructure-specification.md > Application Settings | The paragraph "How the key reaches the app" sits between the table rows and splits the table, so the `session secret` row renders outside the table. | Move the paragraph below the table, or move the session secret row above it. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u2-identity-and-access/infrastructure-design/infrastructure-specification.md > Configuration Changes, mail server row, and cicd-pipeline.md > Files That Change | The mail server row says the SMTP port is read from the CLI status output at start. `config.toml` pins `smtp_port = 54325` and `ci.yml` hard-codes `SMTP_PORT: "54325"`. The CI file list names only `SMTP_HOST` and `SMTP_FROM`, not `SMTP_PORT`. | State one source of truth for the SMTP port, either the pinned value or the status output, and list `SMTP_PORT` in the CI file changes. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Manual check of `supabase/config.toml` against the design | Every other key matches: `inactivity_timeout` 720h, `jwt_expiry` 3600, `otp_expiry` 3600, `minimum_password_length` 8, the rate limits, `max_frequency` 1m0s, the recovery template and the `[local_smtp]` section. The one exception is the sign-up row above. | The design is implementable, apart from the sign-up discrepancy. |
| Manual check of `.github/workflows/ci.yml` and the recovery template | The masked secret generation, the service-role key step, the build-only placeholders, the pinned actions and the recovery link shape all match the design. | The CI claims hold. |
| Traceability coverage | All 18 upstream IDs have targets. | No unmapped upstream IDs. |

### Summary

Hosted infrastructure is unchanged, and the design traces to the NFRs, config.toml and ci.yml. One Major remains: the sign-up row prescribes a setting that would disable email logins. It does not block readiness, but correct it before approval.
