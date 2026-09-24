# Migration Mapping Register

Source: `source-materials/waldorf-community-app/Ovis tábla v2.xlsx`. Import rows use normalized source workbook version, sheet name, row number, and source content hash as a repeat-safe staging key; approved canonical records use resolved family/person and domain identifiers. Ambiguous names, aliases, multi-person cells, and family links enter the administrator preview queue.

| Sheet | Target records | Preserved fields / treatment |
|---|---|---|
| Szülők elérhetősége | Parent, Family, Child | name, child relation, phone, email, residence, occupation, hobbies, community support; restricted fields follow role matrix |
| Kinti - benti takarítás 2025-26 | Task, Assignment | cleaning area, date window, family, child/graduation lists |
| Állatos hétvégi beosztás 2025-2 | Task, Assignment | weekend, opening/closing sub-shift, cleaning/garden duties, family |
| Vízhordás 2025-26 | Task, Assignment | source/location, date window, family |
| ÁLLATOK | Procedure, Task template | animal-care steps, safety/operational instructions |
| Gödöllői Bazár 2025 | Event, EventTask | event date, time slot, responsibility |
| Állatok etetése info | Procedure, Material note | feeding, supplies, references, safety instructions |
| Nagytakarítás | Task, Assignment | area, assignee, timing, preserved completion/status, safety notes |
| Nagytakarítás szervezés | EventPlan, Procedure | cleaning periods, organizer notes, dependencies |
| Állatos beosztás 2025 Nyári szü | Task, Assignment | summer-week duty, family, closure notes |
| Hajó javítás | MaintenanceTask | topic, status, priority, subtask, material, owners, due date, cost, progress, notes |
| Munkacsoportok | Workgroup, Membership | topic, lead, members, organizer scope |
| Nyárünnep 2026 | Event, EventTask | activity, owner, location, materials, notes |
| Kertfejlesztés | MaintenanceTask | topic, status, priority, subtask, material, owners, date, cost, progress, notes |
| Kert- és bazárpénzek | FinanceRecord | income/expense label, amount, date, garden/bazaar category |
| Könyvtár | LibraryItem, Loan | title, author, description, owner, borrower, due date, waitlist |
| Vízvizsgálat | CostShare, Assignment | family response, opted-in status, per-family share, supplier/context |

## Import Controls

- Preview binds to workbook content hash and mapping-register version; commit is atomic and idempotent.
- Reject hostile/unsupported files, duplicate source hashes, malformed values, and unresolved required identities; report changed and already-imported rows.
- Roll back the full commit on failure; preserve the preview and audit evidence for a one-hour recovery objective.
- Optional occupation, hobbies, skills, and community-support values are omitted unless the parent gives explicit, versioned, auditable consent in the approved account flow; withdrawal deletes those values. No historic workbook value creates consent.
- Canonical writes remain invisible until a staged publish transaction succeeds. If a migration must batch, each batch writes only import-scoped staging records and one final publish transaction makes the version visible.
- Rollback is allowed only while a cutover freeze is active; otherwise it creates a reconciliation run that preserves post-import parent/administrator changes and requires authorized review before applying compensating changes.

## Legacy Workflow Destinations

| Sheet | MVP destination | Permitted user action |
|---|---|---|
| Munkacsoportok | Read-only, scoped workgroup archive | View topic, membership, and named organizer; contact organizer outside the product. |
| Könyvtár | Read-only, scoped library archive | View catalogue/loan history; lending and returns use the named kindergarten library process. |
| Vízvizsgálat | Read-only, scoped cost-share archive | View own family response/share and named organizer; payments remain outside the product. |
| Kert- és bazárpénzek | Read-only administrator finance archive | Authorized admins view historic balances; reconciliation and payments remain outside the product. |

## Row-Level Contract

Every table below uses `workbook-hash/sheet/row/content-hash` for staging and an approved administrator override for any ambiguous identity. Blank cells inherit only explicit merged-cell context; otherwise they are null. Required-field failure blocks commit; optional-field failure is reported and omitted only after preview approval.

| Sheet class | Required source fields | Canonical key | Validation/conflict outcome |
|---|---|---|---|
| Contacts | parent name; child relation where present | normalized parent + child/family | alias, multi-person, duplicate contact → preview queue; residence imports as municipality/locality only and street address is redacted/rejected |
| Cleaning/animal/water schedules | family, date window, duty/sub-shift | task template + date window + family | unresolved family/date/sub-shift → block row |
| Procedures/info | non-empty instruction text | procedure title + normalized text hash | duplicate → reuse; unsafe/malformed text → review |
| Events/bazaar | event title/date, activity or slot | event title + date + activity/slot | missing date/title → block row |
| Maintenance/garden/cleaning | topic, subtask/area | topic + subtask + source row | invalid priority/status/cost/date → block row |
| Workgroups | topic, lead/member value | workgroup topic + normalized person | unresolved person → preview queue |
| Finance/cost share | category, amount; date where supplied | category + date + amount + source row | invalid amount/date → block row |
| Library | title, author where supplied | normalized title + author | duplicate title/author → preview queue |

### Sheet-Specific Procedure Contracts

| Sheet | Required fields | Canonical key | Outcome |
|---|---|---|---|
| ÁLLATOK | instruction text | `animal-procedure` + text hash | blank/duplicate → reject/reuse; safety text → admin review |
| Állatok etetése info | instruction, supply/reference where present | `animal-feeding-info` + text hash | blank → reject; URL/supply text preserved as procedure note |
| Nagytakarítás szervezés | cleaning period or organizer instruction | `cleaning-plan` + period/text hash | blank → reject; duplicate → reuse; dependencies retained as plan notes |

For schedule sheets (cleaning, animal, water-carrying, summer animal), each populated assignment row maps `family`, `mikor/date-window`, duty column, and sub-shift text to `Task` + `Assignment`; blank merged cells inherit the prior row's duty/date context, and unresolved family names enter preview review. For maintenance sheets (`Hajó javítás`, `Kertfejlesztés`), each non-header row maps `Téma`, `Státusz`, `Prio`, `Részfeladat`, materials, owners, date, cost, progress, and notes to one `MaintenanceTask`; required title/subtask and valid priority are enforced. `Nagytakarítás` maps area/task, assignee, date, completion, and safety text similarly.

For tabular sheets, source-column contracts are: contacts = parent/child/phone/email/location/occupation/hobby/community-support; workgroups = topic/lead/member columns; event sheets = activity/time-slot, owner, location, materials, notes; library = title/author/description/owner/borrower/due/waitlist; finances = label/amount/date/category; water testing = family/response/share/supplier. Required natural identifiers are normalized parent/family name plus child where present, event title/date, library title/author, and finance category/date/amount. Missing required identifiers, invalid phone/email/amount/date, conflicting canonical identity, or ambiguous multi-person cells create a blocking preview outcome; approved corrections persist as import aliases.
