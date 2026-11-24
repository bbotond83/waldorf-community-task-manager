# Logical Components: u8-animal-care-and-information

Sources: the five design files of this Unit, `functional-spec.md`, `tech-stack-decisions.md`, and C1, C3, C4, C5, C7, C8, C9, C18, C19 and C20 in `contract-summary.md`. The Unit stays inside the existing app and local database; nothing new is deployed.

## Inventory

| Component | Kind | Where NFR patterns apply |
|---|---|---|
| Tables: slot calendars, slots, fair-share rounds, information sections | New tables, no direct read for signed-in accounts | Guards (NFR7.5), no direct select (NFR3.8) |
| AnimalCareSignup commands: `animal_calendar_save`, `animal_slots_create` | Named Postgres functions, C1 template | Super admin only (NFR3.2), lock order (NFR5.9), atomic (NFR7.1, NFR7.2), audit (NFR4.1) |
| AnimalCareSignup reads: `animal_calendar_get`, `animal_slots_list`, `animal_fair_share` | Named Postgres functions returning one document | Fixed calls per page (NFR9.5), display names only (NFR1.2) |
| DutyChanges: `slot_give_up` | Named function in U7's block, resting on C5 `place_release` | Holder check (NFR3.4), limit and version under lock (NFR5.3, NFR5.4, NFR5.6) |
| Duties: `duty_sign_up` (C18), C4 `duty_create` | Existing functions used unchanged; the origin list gains `animal_slot` | DUTY_FULL race (NFR5.2) |
| Information: `info_sections_list`, `info_section_create`, `info_section_update`, `info_section_set_hidden`, `info_section_owner_group`, `info_links_for_duty` | Named functions; the last two internal | Owner by name in the current year (NFR3.5), safe text (NFR3.12 to NFR3.14), version (NFR5.7) |
| Duty card read `rota_duty_card` | Existing function replaced to add `info_links` | Links for visible sections and readable duties only (NFR3.7, NFR11.2) |
| TimedChecks: `animal_empty_slots_check`, `animal_fair_share_check` | Two registry rows for U5's daily run | Once keys and round key (NFR5.8), recorded outcome (NFR4.5, NFR7.7) |
| Notifications: four notice kinds and the `animal_signup` target type | U5 registry rows and this Unit's fact functions | Days, times and counts only (NFR10.1) |
| Screens: `/szulo/allatok`, `/informacio` with its editor, the animal-care settings screen, duty-card links | Next.js pages and components; the section-text renderer as a colocated component | Hungarian copy (NFR8.1), Stitch, keyboard and phone width (NFR8.2), no raw HTML (NFR3.12) |
| Application layer entries | Ports and facades for the parent, admin and information areas, `authorization.ts`, `role-policy.ts`, navigation, `authorization-matrix.json` | NFR3.11 |

## Failure Domains and Blast Radius

- **One database transaction per command:** a command either completes or leaves nothing.
- **Email outside the transaction:** a failed email affects one notice and is listed on the delivery-problems screen.
- **Daily run:** a failing check of this Unit is recorded and the other checks still run.
- **Information page:** a bad section cannot break the page for others; an address that fails the link rule is shown as text.
- **Shared resources:** duty and place rows (with U2, U6, U7, U9 and later units), U7's DutyChanges block, U6's duty card read, U5's registries and the audit table. The one migration changes `rota_duty_card` and re-creates the duty origin and audit action checks, with those units' tests kept green.
