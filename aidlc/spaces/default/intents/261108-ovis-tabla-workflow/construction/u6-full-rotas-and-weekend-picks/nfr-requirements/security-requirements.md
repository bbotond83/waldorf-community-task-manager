# Security Requirements: u6-full-rotas-and-weekend-picks

Sources: `functional-spec.md` and `rules.md` of this Unit, NFR1, NFR3, NFR4 and NFR10 in `requirements.md`, contracts C1, C2, C8 to C12, C16 and C20 in `contract-summary.md`, and `technology-stack.md`. Contains no names or contact details.

## Authentication

Sign-in, sessions and password rules do not change. A signed-out visitor receives no rota, weekend or standing data and is sent to sign-in. The daily and Friday-noon runs stay callable by the service role only (C9); this Unit adds checks to them and no new entry point.

## Authorization Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR3.1 | Every new read and write checks the caller on the database side, as its rule says (BR60.1, BR63.4, BR63.6, BR65.1 to BR65.4). | Database tests acting as real roles and accounts pass for each rule. |
| NFR3.2 | Setting a standing, assigning a pick, reading standings, flagged duties and the unpicked list are refused for a parent, teacher and working-group administrator, including by calling the function directly. A refused list is a denied refusal, never an empty list. | The fixed-list "out of reach" test passes for each. |
| NFR3.3 | Only a parent of the picking week's family can pick. A parent of another family gets the same denied refusal for a real week and a made-up one. | A test compares the two refusals. |
| NFR3.4 | The weekend's state (who has and has not picked, free slots) is returned only to parents of that week's indoor-cleaning, front-garden and weekend families and to super admins (BR65.3). Everyone else sees holders through the overview only. | Reach tests for each of the three families, an unrelated parent, a teacher and a super admin. |
| NFR3.5 | The functions for other units (`family_may_hold_duty`, `family_standing`, `families_with_standing`, `rota_check_change`, `rota_adjust_picks_after_change`, `rota_family_for`, the removal pair) and the three checks cannot be executed by any signed-in role. | The catalogue test lists their grants, and a call as a signed-in account is refused. |
| NFR3.6 | Today's change functions refuse a weekend duty with DUTY_ROTA_MANAGED for every role; a weekend place changes holder only through a pick (BR65.5). | A test calls each refused function on a weekend duty. |
| NFR3.7 | Signed-in accounts keep read-only table rights, and none on the standings table. Every new function starts with `revoke all` and an explicit `grant execute`, pins its search path, and grants no table write right (BR67.1, BR67.2). | The catalogue test lists each new function's grants and each new table's rights. |
| NFR3.8 | A right lost while signed in applies at the next request: a parent removed from the family, or a super admin whose role is revoked, is refused on the next pick, assignment or standing change. | A test revokes between two requests. |
| NFR3.9 | `verification/authorization-matrix.json` gains rows for the standing command, the pick command, the assign command and the unpicked list for every role, and each changed screen is walked through for every role. | Evidence is in the Unit's test results before merge. |

## Data Protection

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR1.1 | The seed, fixtures and tests use invented families and people only; any address or phone number in a test is on the privacy allowlist. | Secret scanning and the privacy check stay green. |
| NFR1.2 | The overview, the duty card, the weekend state and the unpicked list return family display names only: no contact detail, no child's name, no sharing choice, no standing. | A test asserts the exact fields each read returns. |
| NFR1.3 | A family's standing (leaving or new) is readable by super admins only. A parent learns it only through a refusal about their own family. | A test reads as a parent of another family. |
| NFR10.1 | Every notice and email of this Unit names the job, the week and the slot, and for the two administrator kinds the family name. None holds a phone number, an email address or a child's name (BR64.6). | A test reads each kind's text from the local test mailbox. |
| NFR10.2 | The publishing notice lists only the receiving family's own weeks, for all four rotas (BR62.5). | A test reads each notice after a publish. |

## Audit

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.1 | Setting a standing writes one `family.standing_set` event and an administrator's pick assignment one `weekend_pick.assign` event, each with opaque ids and the actor, and no name (BR60.1, BR63.6). | A test reads the event after each command. |
| NFR4.2 | A repeated click writes no second event, and publishing still writes exactly one `rota.publish` event for the four-rota plan. | The "repeated click" test counts events. |
| NFR4.3 | Denied attempts are audited as they are today, under the existing rate limit. | The existing denied-audit tests pass. |

## Threat Considerations

| Threat | Control |
|---|---|
| A parent picks for another family, or takes the shelter cleaning, by calling the function directly | The caller's family and the slot are checked inside the function (NFR3.3, BR63.4) |
| A parent marks their own family as staying to dodge the changeover rule | Standings are super admin only (NFR3.2) |
| A signed-in user triggers reminders or alerts | The checks are internal and run only inside the service-role run (NFR3.5) |
| A weekend duty is moved through the old task or swap functions, breaking the link to its pick | DUTY_ROTA_MANAGED until U7 (NFR3.6) |
| A notice or email leaks another family's details | Texts are built from the duty only (NFR10.1) |
| A family's leaving status leaks to other parents | Standings and flagged duties are read by super admins only (NFR1.3) |
| A function running with raised rights is steered to another schema | Every function pins its own schema (NFR3.7) |
