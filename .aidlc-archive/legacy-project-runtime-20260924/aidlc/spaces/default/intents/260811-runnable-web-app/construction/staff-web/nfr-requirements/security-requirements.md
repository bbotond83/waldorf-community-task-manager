# Staff Web Security Requirements

## Sources

Derived from [business logic](../functional-design/business-logic-model.md), [requirements](../../../../inception/requirements-analysis/requirements.md), and [technology stack](../../../../../../codekb/waldorf-community-task-manager/technology-stack.md).

## Controls

Every list and detail request authenticates the Staff profile and authorizes route, granted group, schedule row, and returned fields on the server before retrieval. Authorized view models contain only date/time, activity, granted group, permitted location or coverage, and the required coordination display name. Contact details, locality, optional profile fields, protected reasons, assignment or family detail, unrelated rows, raw aggregates, and mutation capabilities are absent from responses, props, HTML, accessibility output, logs, and screenshots.

## Verification

Exercise permitted and forbidden route, group, row, field, and direct-request cases; 31-day and filter validation; immediate grant revocation on the next request; generic denial without counts; error redaction; XSS-safe rendering; and absence assertions across UI, API, logs, and evidence. Synthetic authorization must match the approved matrix and never imply real Supabase RLS verification.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

The staff targets are bounded, measurable, and privacy-minimized: two-second schedule responses, a 31-day cap, server authorization, exact field allowlisting, next-request revocation, negative direct-request coverage, and a read-only Next.js boundary with no deployment or real-target claim.
