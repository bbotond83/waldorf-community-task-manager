## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-13T07:07:25Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u3-directory-and-profile/functional-design/rules.md > BR31.5 and BR30.3 | The rule says sharing is switched off in the same transaction when an account is deactivated, but account deactivation is a U1 function (today `account_set_status` in `20261018_identity_access_changes.sql`) that does not touch the directory. BR30.3, BR30.4 and the Who Sees What matrix read only the sharing flag. A deactivated parent who ticked earlier would keep showing phone, email and profile fields, and would keep counting as "shared" toward showing the children. This is the main privacy control. | Make the read rules require a linked active account as well as the tick, or name the exact mechanism (a trigger or an explicit step in U1's status function) that clears the flag. Add the "deactivated account" case to the BR30 matrix tests. | New |
| R-02 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u3-directory-and-profile/functional-design/entities.md > Today's records, Parent, ParentProfile | The design drops `optional_profile`, `optional_profile_consent` and replaces `parent_contacts`, but never lists the existing code that uses them: `20261025_directory_functions.sql`, `20261032_lifecycle.sql`, `20261035_integrity_directory_reads.sql`, `20261035_integrity_lifecycle.sql`, `20261040_import_functions.sql`, `20261041_import_commit.sql`, `20261047_community_foundation.sql`, and `src/data/admin-records.ts`. The import commit and the anonymisation lifecycle write or erase these columns, so a forward-only migration that removes them would break those functions unless they are redefined in the same migration. | Add an "existing consumers" list to entities.md or functional-spec.md. State for each consumer whether it is redefined, kept through a compatibility view, or retired. Add the matching tests (import commit, lifecycle erasure, admin records) to the test notes. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u3-directory-and-profile/functional-design/rules.md > BR34.6, BR34.4 | Confirming the email change must update the sign-in user table, which `20261022_identity_email_change_guard.sql` blocks unless the transaction sets `app.identity_email_change` to allowed. The rule says only "may change a sign-in email" and does not name that mechanism. It also needs the sign-in identity record kept in step. Also, the confirmation link needs no sign-in, so the function is not a signed-in C1 call and needs a defined caller (server-side with a narrow grant). | State the mechanism in the spec: the guard setting, the identity record, and who may call the confirm function without a session. Test the guard still refuses every other route. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u3-directory-and-profile/functional-design/functional-spec.md > Concurrency and Repeats, W4 | "Every command takes the C1 idempotency key" and the version rule cannot hold for the password change, which goes through the sign-in service and is not a named database function. BR33 has no repeated-click, outdated or two-at-once behaviour, yet the fixed test list is promised for every database rule. | Say that BR33 is outside the C1 template and what a repeated submit does (second submit fails the "differs from current" check). Record in the test plan which of the six cases apply. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u3-directory-and-profile/functional-design/rules.md > BR36.4, BR36.2 | The removal step for a parent (called by U14) performs the BR36.3 clearing but the only-parent check sits in BR36.2 on the administrator command, so the C16 path can leave an active family with no active parent, against the Parent entity's own constraint. The open C16 question about a family's only parent is not answered here. | State that the apply step is for family removal in that case, or that BR36.2 also guards the C16 parent path. Say the order of archiving parents and the family. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u3-directory-and-profile/functional-design/rules.md > BR38.1 | The load payload carries "residence" but also says profile fields are not loaded; residence is one of the profile fields shared under the tick. Existing contacts' "locality" is the same field. | Settle that residence is loaded and stays hidden until the parent ticks, and state it in BR38.1 to avoid ambiguity at code time. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json parse (`python3 -m json.tool`) | PASS | Valid JSON. |
| BR ids cited in traceability.json resolve in rules.md | PASS (no missing ids) | Every cited rule exists; AC3.6.2, AC3.6.5 to AC3.6.7 are marked N/A to U14, matching the story map. |
| Sensors (required-sections, linter, type-check) | Not run | These are engine-run at the gate; no shell entry point was used. Noted for the person to weigh. |

### Summary

The design is coherent and implementable: the visibility matrix is decided in the database, the owner's seven answers are all reflected, and traceability resolves. Two Major gaps (deactivated accounts still counting as shared, and the unlisted existing consumers of the columns being dropped) are within the two allowed, so the verdict is READY, but both are worth settling before approval because they touch the privacy control and a forward-only migration.
