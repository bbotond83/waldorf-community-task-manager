# Legacy workbook baseline evidence

- Source: `domain/Ovis tábla v2.xlsx`
- SHA-256: `66a24355f17cc13d3beb39af0116fa40da0a574800575e943b5825aae0a8eec8`
- Inspection mode: user-approved, read-only Open XML extraction plus macOS Quick Look visual verification.
- Privacy: the workbook contains names, children, phone numbers, email addresses, locations, occupations, interests, and assignment history. This evidence records structure and behavior only; it intentionally does not reproduce personal records.

## Verified workbook inventory

The workbook has 17 visible sheets and is predominantly manually maintained text rather than formulas. Only three formulas were found: one balance calculation and two water-testing cost calculations.

| Sheet | Verified baseline capability |
|---|---|
| Szülők elérhetősége | Parent/child contact register including address/location, occupation, hobbies, and ways a family can support the community. |
| Kinti - benti takarítás 2025-26 | Weekly indoor-cleaning and front/back-garden family rotations, week numbers, free-text date ranges, child lists, and school-break rows. |
| Állatos hétvégi beosztás 2025-2 | Weekend animal-care assignments with separate open/close/cleaning sub-shifts and ad-hoc handoffs. |
| Vízhordás 2025-26 | Weekly water-carrying family rotation, source/location information, and school-break handling. |
| ÁLLATOK | Detailed recurring animal-care, cleaning, feeding, watering, safety, and seasonal procedures. |
| Gödöllői Bazár 2025 | Event time slots with named assignees. |
| Állatok etetése info | Animal-care reference information and an external product link. |
| Nagytakarítás | Area-by-area cleaning checklist with assignee, timing, completion, and safety instructions. |
| Nagytakarítás szervezés | Seasonal rules, dependencies, lead-time, reminders, signup deadlines, and organizer guidance. |
| Állatos beosztás 2025 Nyári szü | Summer weekly animal-care rotation distinct from term-time weekend scheduling. |
| Hajó javítás | Maintenance backlog with topic, priority, status, subtask, materials, owners, deadline, cost, progress, and notes. |
| Munkacsoportok | Workgroup topics, main contacts, members, priorities, responsibilities, and chat channels. |
| Nyárünnep 2026 | Event activities, responsible people, locations, supplies, family food contributions, allergens, and narrative content. |
| Kertfejlesztés | Garden backlog with priority, status/completion, materials, owners, dates, cost, progress, and notes. |
| Kert- és bazárpénzek | Garden/bazaar income and expense headings plus calculated balances. |
| Könyvtár | Lending catalog with book metadata, owner, current holder, due date, and waiting list. |
| Vízvizsgálat | Family participation decisions, provider prices, and calculated per-family cost. |

## Baseline behaviors the PRD must explicitly preserve, transform, archive, or exclude

1. Assignments are frequently expressed against a family or child label, not a single authenticated parent.
2. Scheduling uses week numbers and Hungarian free-text ranges rather than normalized timestamps.
3. Several responsibilities have sub-shifts, procedural instructions, materials, safety constraints, prerequisites, and seasonal variants.
4. Existing maintenance sheets track completion/progress even though the PRD excludes completion tracking from MVP.
5. Library lending and water-test cost sharing are real workflows, not simply task-category labels.
6. The workbook contains community workgroups and a small finance ledger that do not have a defined MVP destination.
7. Event planning includes supplies, contributions, allergen constraints, and content beyond a generic event plus task slots.
8. Personal data exceeds the PRD's proposed model, creating a required import/retention decision for every extra column.
9. The source is inconsistent and human-entered: aliases/spelling variants, multiple people in one cell, mixed date formats, school-break rows, free-text statuses, merged cells, and formula cells require explicit migration rules.

## Verification limitations

- This was a file-level baseline review, not observation of the surrounding manual communication process (email/chat reminders, approvals, or conflict resolution).
- No application implementation existed in the configured code paths at inspection time.
