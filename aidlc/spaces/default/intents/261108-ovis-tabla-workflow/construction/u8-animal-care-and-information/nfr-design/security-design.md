# Security Design: u8-animal-care-and-information

Sources: `security-requirements.md` and `tech-stack-decisions.md` of this Unit, `functional-spec.md` and `rules.md` (BR80 to BR89), and C1, C5, C7, C8, C9, C10, C18, C19 and C20 in `contract-summary.md`. Contains no names or contact details.

## Defence in Depth

| Layer | Control |
|---|---|
| Database role | Every new function starts with `revoke all` and an explicit `grant execute`, and pins its search path (NFR3.8). The four new tables (slot calendars, slots, fair-share rounds, information sections) have row-level security on, no policy for signed-in accounts and no `select` grant to `authenticated`, so they are read only through this Unit's functions. This is stricter than the existing tables, which grant `select` to `authenticated`, and is what NFR3.8 asks: the reads must apply the hidden-section and community rules, which a plain table read would skip. The catalogue test's table-rights list and scope probes gain these four tables with no right for `authenticated`, and a test selects from each table as each signed-in role and gets a permission error. |
| Function check | Each function checks the caller itself with the existing helpers (active session, the caller's family, super scope, the coordinator grant), so a direct call gets the same answer as a screen (NFR3.1). |
| Internal functions | `animal_fair_share_check`, `animal_empty_slots_check` and `info_links_for_duty`, and the owner resolver `info_section_owner_group(section)`, have no grant to any signed-in role (NFR3.7). |
| Application layer | `authorization.ts`, `role-policy.ts`, the navigation and `verification/authorization-matrix.json` gain the new reads and commands; each new screen is walked through for every role (parent, group admin, super admin, teacher, signed out) with the result in the Unit's test results (NFR3.11). |

## Authorization Design

| Function | Who is allowed | Everyone else |
|---|---|---|
| `animal_calendar_get`, `animal_calendar_save`, `animal_slots_create` | Super admin (BR80.1, NFR3.2) | Denied, including the alert group's coordinators |
| `animal_slots_list`, `animal_fair_share`, `info_sections_list` | Every signed-in member of the community (BR81.6, BR86.1). `info_sections_list` returns hidden sections, marked as hidden, to super admins only; everyone else gets visible sections only (BR86.3, NFR3.6). A test reads the list as each role with one hidden section. | Denied outside the community; signed out is sent to sign-in |
| `duty_sign_up` on a slot | A parent of a current family that may hold a duty that day (C10) | Denied with no family; DUTY_INELIGIBLE with the reason |
| `slot_give_up` | A parent of the family holding the place (BR82.1) | Denied, the same for a real and a made-up place (NFR3.4) |
| `info_section_update`, text only | An active coordinator of the group BR87.6 resolves, or a super admin | Denied |
| `info_section_update`, any other field; `info_section_create`; `info_section_set_hidden` | Super admin | Denied |

- **Same answer for real and made-up ids.** `slot_give_up` first reads the place and its holding family without a lock and tests the caller's family in one condition, so "not yours" and "does not exist" return the same denied refusal before any lock is taken; neither case waits for a lock, so their timing does not differ either. Only for the caller's own place does it then lock the duty and the place (the order of `scalability-design.md`), test the holder again under the lock, and check the origin kind, the 24-hour limit, the open swap and the version. A family that lost the place between the two reads gets the denied refusal.
- **Owner resolution (BR87.6).** `info_section_owner_group(section)` takes the community's school year for today's Budapest date (C3 `school_year_for`), then the active working group of that year whose name equals the section's owner name, compared in lower case as the group-name index does. The coordinator test asks for an unrevoked group-admin grant on that group (C7, ADR-010). No owner is cached; each call resolves it again, so a new school year or a revoked grant applies at the next request (NFR3.9).
- **Duty links (NFR3.7).** `info_links_for_duty(duty, on_date)` returns keys and titles of visible sections only. It is called from inside `animal_slots_list` and the replaced `rota_duty_card`, both of which run with raised rights and check the caller's right to the duty before they call it. A direct call by a signed-in role fails.
- **Rights lost while signed in.** Nothing about rights is cached in the app; each function re-reads the account's family, role, grants and the family's standing (NFR3.9).

## Input Validation

| Input | Rule | Where |
|---|---|---|
| Start times | Both present, morning earlier than afternoon (BR80.4) | `animal_calendar_save`, and a table check (NFR7.5) |
| Alert group | A working group of the same community and school year (BR80.5) | `animal_calendar_save` |
| Section title and text | 1 to 120 characters and at most 20 000 (NFR3.14) | The saving functions and table checks |
| Owner name | Empty, or the name of a working group of the current school year (BR87.2) | `info_section_create`, `info_section_update` |
| Season months | A list of distinct whole numbers from 1 to 12, or empty | The saving functions and a table check |
| Link addresses | Every `[text](address)` in the text is checked by the rule of NFR3.13; one bad address refuses the save with INFO_TEXT_INVALID | The saving functions, with the same list re-checked by the renderer |
| Repeated-click keys | Bound to account, command and input fingerprint through `idempotency_records` (NFR3.10) | Every command |

## Safe Display of Section Text (XSS)

- The stored text is the author's text. The page never passes it to the browser as HTML; the app's renderer turns it into React elements for the four allowed forms of NFR3.12 (paragraph, bulleted or numbered item, bold, link), and everything else becomes text nodes, so a tag or event attribute in the text is shown, never run (NFR3.12).
- Links are rendered only when the address passes the same check as on saving (NFR3.13); a failing address is shown as text. Links to other sites get `rel="noopener noreferrer"` and open in a new tab; in-app paths use the app's own link component.
- Titles, family names and the editor's preview use the same rule: text only.

## Data Protection

- **Display names only (NFR1.2).** Slot and fair-share reads return the family display name through C6 and the slot facts; no contact detail, no child's name, no sharing choice.
- **Starting text (NFR1.3).** The migration's section text is copied from the spreadsheet review's appendices; the privacy check scans the migration file, and the owner reads the sections in the screenshots.
- **Editor warning (NFR1.4).** Under the text box: a Hungarian note that every parent and teacher sees the text and that it should hold no phone number, email address or child's name.
- **Email content (NFR10.1).** The four notice kinds have fact functions that return days, parts, times, counts and the family's own share only; the reminder names no family.

## Audit

- `animal_calendar_save` and `animal_slots_create` write one audit entry each (`animal_calendar.saved`, `animal_slots.created` with the number added) inside the same transaction, with opaque ids and the actor; a failure to write it rolls the change back (NFR4.1).
- Sign-up, give-up and section edits write none (NFR4.2). Denied attempts are audited by the existing denied-audit path under its rate limit (NFR4.3).

## Threats and Controls

| Threat | Control |
|---|---|
| A parent gives up another family's slot | Holder check inside `slot_give_up` (NFR3.4) |
| Last-minute give-up through an old page | Limit and version checked under the place lock (BR82.3, BR82.5) |
| Last year's coordinator keeps editing, or this year's is locked out | Owner resolved by name in the current year on every call (BR87.6) |
| Script or misleading link in a section | Own renderer, no raw HTML, link rule on saving and on rendering |
| A signed-in user runs the checks to spam families | No grant to signed-in roles; once keys |
| Reading the tables directly | No `select` grant and no policy for signed-in accounts |
| Key replay by another account | Keys bound to account, command and inputs (NFR3.10) |

## Review follow-up

A coordinator never reaches a hidden section by id (it answers as missing), and `info_section_update` checks the caller on an unlocked read before it locks the section row, so a stranger never waits on the lock. The teacher page `/teacher/allatok` uses the same read function as the parent page, read-only, and returns no contact detail.
