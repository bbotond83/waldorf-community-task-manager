# Logical Components: u2-first-rota-slice

Where the designs in `security-design.md` and the other files of this folder apply. Requirements come from the NFR requirement files of this Unit, behaviour from `functional-spec.md` and boundaries from `contract-summary.md`.

## Components

Everything runs in one application and one database, with no service boundary.

| Component | Part in this Unit | If it fails |
|---|---|---|
| Identity helpers | The super-admin decision point, called by every command | Calendar and rota commands are denied |
| Calendar | School year changeover date, break weeks | The school-year page shows its error state |
| Rota | Plan, weeks, draft, adjust, discard, publish, overview | The page shows its error state; publish rolls back |
| Duties (today's tasks) | Origin columns, `DUTY_ROTA_MANAGED` check, duty and place functions, done mark | Task pages show their error state; rota changes roll back |
| Notifications | New notice kind for a published rota; list, link and mark-read handle a notice with no task | Publish rolls back as a whole; a read failure shows the error state |
| Lifecycle | Archiving refuses a family with a rota place | Archiving is refused with its reason |
| Audit | Two new action names | The change rolls back |
| WebApplication | School-year page, rota page, parent overview, duty card, message mapping | The page shows its error state |
| Seed and reset | A year with a changeover date and invented break weeks | The local stack is not rebuilt; no effect on rules |

## Blast Radius

Publish touches duties, places, notices and audit in one transaction, so a defect rolls back instead of half-applying. The `DUTY_ROTA_MANAGED` check sits in today's change functions, so a defect there affects the existing task pages; it gets the full fixed test list.

## Shared Resources

One Postgres database and the audit log. The place functions and the done mark built here are consumed by U7, U8 and U9, so their names and meanings are fixed in this Unit.
