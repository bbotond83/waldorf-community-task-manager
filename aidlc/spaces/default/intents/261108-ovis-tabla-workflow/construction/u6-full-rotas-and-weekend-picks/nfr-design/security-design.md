# Security Design: u6-full-rotas-and-weekend-picks

How the targets in `security-requirements.md` are met, following `functional-spec.md`, `tech-stack-decisions.md` and contracts C1, C2, C8 to C12, C16 and C20 in `contract-summary.md`. Contains no names or contact details.

## Authorization Architecture

**Administrator commands and reads.** Setting a standing, assigning a pick, and reading standings, flagged duties and the unpicked list call U1's one super-admin decision point first, after the session check and before any lookup (NFR3.1, NFR3.2). Every other role gets the same denied result whatever it sends, and a list is never returned empty in place of a refusal.

**Picking.** The pick command resolves the caller's family with `current_family_id`, then looks the picking week up only where its family equals that family and its plan is published in the caller's community. A week of another family and a made-up id therefore fail the same lookup and give the same denied result (NFR3.3). The slot checks come after this, so a refusal code never reveals another family's week.

**Weekend state.** The duty card function decides in one place whether the caller belongs to one of the week's three families or is a super admin; only then does it add the pick state to the answer (NFR3.4). The overview never carries pick state.

**Internal functions.** The eligibility, standing, rota-rule, rota-week and removal functions and the three checks are created with `revoke all` and no grant. The checks are reached only through the registry of the service-role run (NFR3.5). The catalogue test lists them by name: `family_may_hold_duty`, `family_standing`, `families_with_standing`, `rota_check_change`, `rota_adjust_picks_after_change`, `rota_family_for`, `rota_planning_removal_preview`, `rota_planning_removal_apply`, and the three check functions.

**Protected duties.** The shared check that makes today's change functions refuse rota duties already tests for an origin other than `manual`, so weekend duties are covered by widening the origin list; a test calls each function on a weekend duty (NFR3.6).

**Rights.** Signed-in accounts keep select only, and get none on the standings table: its row-level rule admits no application role, and super admins read it through the calendar function. Every new function pins its search path and gets an explicit grant or none (NFR3.7).

**Revoked rights.** Each command resolves the caller's parent, family and role at the start of the call through U1's helpers, which check that the parent and the grant are still active, so a right lost between two requests is gone at the next one (NFR3.8).

## Data Protection Design

| Requirement | Design |
|---|---|
| NFR1.1 | The seed adds invented families, standings and a four-rota draft only. Any address used by a test is added to the privacy allowlist. |
| NFR1.2 | The read functions build their answers from family ids and `family_display_name` only. A test asserts the exact field list of each answer. |
| NFR1.3 | Standings leave the database only in the calendar read for super admins. A refusal with DUTY_INELIGIBLE and its reason is returned only to a caller acting for that family or to a super admin; the overview and cards never show it. |
| NFR10.1 | The notice facts for a duty build title and text from the duty's job, week and slot. The two administrator kinds add the family display name. No query in the facts function touches profile or contact tables. |
| NFR10.2 | The rota-plan notice facts list the weeks of the reading parent's own family for each rota; the query is keyed on that parent's family. |

## Audit Design

Setting a standing and assigning a pick write through the existing audit function in the same transaction as the change, with the family id, year and standing, or the picking week and slot (NFR4.1). A repeated call returns the stored result before the audit write, and publishing still writes one `rota.publish` event (NFR4.2). Denied attempts keep the existing audit path and rate limit (NFR4.3).

## Evidence Design

NFR3.9 is proven by the authorization-matrix test with rows for the standing command, the pick command, the assign command and the unpicked list, and by a browser specification that opens each changed screen as each role. NFR3.2 to NFR3.6 are proven by database tests that call each function directly as real accounts.

## Input Validation

The standing is one of three fixed values and the slot one of five, both checked by the table as well as the function. Ids go through the existing safe parser and are checked against the caller's community. The moment used for time rules comes from the database clock for signed-in commands; only the service-role run may pass a moment in. React escapes all displayed text.
