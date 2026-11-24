# Security Requirements: u8-animal-care-and-information

Sources: `functional-spec.md` and `rules.md` of this Unit, NFR1, NFR3, NFR4 and NFR10 in `requirements.md`, contracts C1, C5, C7, C8, C9, C10, C18, C19 and C20 in `contract-summary.md`, and `technology-stack.md`. Contains no names or contact details.

## Authentication

Sign-in, sessions and password rules do not change. A signed-out visitor receives no slot, fair-share or information data and is sent to sign-in. This Unit adds no service-role entry point of its own: its two daily checks are run by the existing daily run (C9), and the duty-link read is internal.

## Authorization Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR3.1 | Every new read and write checks the caller on the database side, as its rule says (BR80 to BR88). | Database tests acting as real roles and accounts pass for each rule. |
| NFR3.2 | Reading the animal-care calendar (`animal_calendar_get`), saving it and creating slots are refused for a working-group admin (including a coordinator of the alert group), a parent and a teacher (BR80.1). | A test calls the read and both commands as every role. |
| NFR3.3 | Signing up for a slot is refused for a caller with no current family (a teacher, a super admin with no parent record) and for a family that may not hold a duty that day (BR81.1, C10). | A test signs up as each role and as a leaving family after the changeover and a new family before it. |
| NFR3.4 | Giving up a slot is refused for anyone but a parent of the holding family, including a super admin, a coordinator of the alert group and a parent of another family. A refused caller gets the same denied refusal for a real place and a made-up one (BR82.1). | A test calls `slot_give_up` as each role and compares the refusals. |
| NFR3.5 | Editing a section's text is allowed only for an active coordinator of the group that BR87.6 resolves and for a super admin; changing the title, owner, season, order or hiding, and adding a section, only for a super admin (BR87.1 to BR87.3, BR87.6). A coordinator whose grant was revoked, a coordinator of another group, a parent and a teacher are refused. | A test calls each information command as each role, and again after a new school year with a group of the same name is made current. |
| NFR3.6 | The slot list, the fair-share read and the information list are readable by every signed-in member of the community and refused outside it; hidden sections are returned only to super admins (BR81.6, BR86.1, BR86.3). | A test reads each as every role and as an account of another community. |
| NFR3.7 | `animal_fair_share_check`, `animal_empty_slots_check` and `info_links_for_duty` cannot be executed by any signed-in role. `info_links_for_duty` is called only from inside two reads that run with raised rights and check the caller's right to the duty first: `animal_slots_list` (for slots) and the existing duty card read `rota_duty_card` (for the weekend animal-care duty and its weekend slots). `rota_duty_card` is replaced by a new migration file that adds an `info_links` field and changes nothing else. The links name visible sections only, and only for a duty the caller may read. | The catalogue test lists their grants, and a direct call as a signed-in account is refused. A test reads both duty reads as each role with a hidden section and with a duty the caller cannot see, and finds no link to either. |
| NFR3.8 | Signed-in accounts get no write right on the new tables (slot calendars, slots, fair-share rounds, information sections), and, stricter than the existing tables, no direct read either: the tables are read only through this Unit's functions, which apply BR81.6, BR86.1 and BR86.3, as U7 did for `change_requests`. Every new function starts with `revoke all` and an explicit `grant execute`, pins its search path, and grants no table write right. | The catalogue test lists each function's grants and shows no table right for `authenticated` on the four tables; a select from each table as each signed-in role gets a permission error. |
| NFR3.9 | A right lost while signed in applies at the next request: a revoked coordinator grant stops section editing, and a family marked leaving is refused a slot after the changeover, on the next command. | A test changes the right between two requests. |
| NFR3.10 | Every command of this Unit uses the existing repeated-click mechanism (`idempotency_records`, bound to the account, the command and a fingerprint of its inputs) and keeps no key store of its own. | Tests replay a key as a second account and as the same account with changed inputs. |
| NFR3.11 | `verification/authorization-matrix.json`, `role-policy.ts`, `authorization.ts` and the navigation gain rows for the new functions and screens for every role, and each new screen is walked through for every role. | Evidence is in the Unit's test results before merge. |

## Data Protection

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR1.1 | The seed, fixtures and tests use invented families and people only; any address or phone number in a test is on the privacy allowlist. | Secret scanning and the privacy check stay green. |
| NFR1.2 | The slot list and the fair-share read return family display names (C6) and slot facts only: no contact detail, no child's name, no sharing choice (BR81.6, BR83.4). | A test asserts the exact fields each read returns. |
| NFR1.3 | The starting text of the six information sections, copied from the spreadsheet review's appendices, holds no person's name, phone number or email address (BR86.2). | The privacy check runs over the migration file; the owner reads the sections in the screenshots. |
| NFR1.4 | Section text written by a coordinator is shown to every signed-in member, so the editor says under the text box, in Hungarian, that the text is seen by every parent and teacher and should hold no phone number, email address or child's name. | The form text is checked in the screenshots. |

## Safe Display of Section Text

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR3.12 | Section text is shown through the app's own renderer for the allowed formatting, never as raw HTML: any tag, script, style or event attribute in the text appears as plain text (BR87.5). The accepted syntax is fixed: a blank line separates paragraphs; a line starting with `- ` is a bulleted item and one starting with a number, a full stop and a space (`1. `) a numbered item; `**text**` is bold; `[text](address)` is a link. Anything else, including an unclosed `**` or `[`, is shown as written. The editor's help text shows these four forms in Hungarian. | A test saves text with a script tag, an image with an error handler and an inline style, and the page shows them as text with no element created. A component test renders each accepted form and each malformed one. |
| NFR3.13 | A link address is accepted only with `https://`, `http://` or a single leading `/` followed by a character other than `/` or `\`. Refused on saving, and never rendered as a link: `javascript:`, `data:` and any other scheme, `//host`, `/\host`, an address with leading or trailing spaces, with a control character or line break anywhere, or with a `\` anywhere, including inside an `https://` address (BR87.5). Links to other sites open with no access to the app's window. | A database test saves each of these addresses through the saving function; a component test feeds the same list to the renderer and checks the rendered link attributes. |
| NFR3.14 | Title and text lengths (1 to 120 and at most 20 000 characters) are enforced in the database, not only on the form. | A test saves too long and empty values directly through the function. |

## Email Content

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR10.1 | The empty-slot message, the day-before alert, the fair-share reminder and the start-time notice name days, parts, times and counts only, and the family's own share; no family name in the reminder, and no phone number, email address or child's name in any of them. | A test reads each kind's text from the local test mailbox. |

## Audit

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.1 | Saving the animal-care calendar (`animal_calendar.saved`) and creating slots (`animal_slots.created`, with the number added) each write one audit entry with opaque ids and the actor, like rota publishing; the change rolls back when the entry cannot be written. | A test reads the entry for each command, and a forced audit failure (a temporary failing trigger, inside the test only) leaves the calendar and slots unchanged. |
| NFR4.2 | Sign-up, give-up and section edits write no audit entry; the place and the section's update time are their record (NFR4 names none of them). | A test performs each and counts audit rows. |
| NFR4.3 | Denied attempts are audited as they are today, under the existing rate limit. | The existing denied-audit tests pass. |

## Threat Considerations

| Threat | Control |
|---|---|
| A parent gives up another family's slot by calling the function directly | The holding family is checked inside the function (NFR3.4) |
| A family gives up a slot at the last minute through an old page | The 24-hour limit and the version are checked in the database at the moment of the call (BR82.3, BR82.5) |
| A coordinator of last year's group keeps editing, or a new year's coordinator is locked out | The owner resolves to the current year's group by name on every check (NFR3.5, BR87.6) |
| A coordinator puts a script or a misleading link in a section | Own renderer with no raw HTML, link schemes limited (NFR3.12, NFR3.13) |
| A signed-in user runs the daily checks to spam families | The checks have no grant to signed-in roles (NFR3.7), and send-once keys stop repeats |
| A function running with raised rights is steered to another schema | Every function pins its own schema (NFR3.8) |
| Another parent replays a repeated-click key | Keys are bound to the account, command and inputs (NFR3.10) |
