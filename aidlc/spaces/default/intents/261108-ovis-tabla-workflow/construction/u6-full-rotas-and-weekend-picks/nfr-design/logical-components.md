# Logical Components: u6-full-rotas-and-weekend-picks

Where the designs in `security-design.md` and the other files of this folder apply. Requirements come from `performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md` and `tech-stack-decisions.md` of this Unit, behaviour from `functional-spec.md` and boundaries from `contract-summary.md`.

## Components

Everything runs in one application and one database, with no service boundary.

| Component | Part in this Unit | If it fails |
|---|---|---|
| Identity helpers | The super-admin decision point and the caller's family, used by every command | Commands are denied |
| Community | Family standings, the eligibility function, the standing reads | A command that gives a duty is refused or rolls back; the calendar page shows its error state |
| RotaPlanning | Four-rota draft, adjust and publish; weekend slots and picks; the rota-rule and rota-week functions; the removal pair | The page shows its error state; publish or a pick rolls back as a whole |
| Duties (today's tasks) | Origin `weekend_slot`, source `weekend_pick`, the protection check, `place_reassign` used by picks | A pick rolls back; task pages show their error state |
| Notifications | Six registered notice kinds, the notice facts for rota and weekend duties, the rota-plan notice text | A refusal rolls the caller back; a failed email is retried and listed for the administrator |
| TimedChecks | Three registered checks inside U5's run | The failing check is recorded and the others still run |
| Audit | Two new action names | The change rolls back |
| WebApplication | Changed calendar, planning, overview and duty-card screens; the unpicked list; message mapping | The page shows its error state |
| Seed and reset | Invented standings and a four-rota draft | The local stack is not rebuilt; no effect on rules |

## Blast Radius

The eligibility check is added to sign-up, manual assignment and today's swap functions, so a defect there affects existing pages; it gets the full fixed test list and the existing tests of those functions must stay green. Publishing and picks each run in one transaction, so a defect rolls back instead of half-applying. A failing check cannot stop the daily run or the other units' checks.

## Shared Resources

One Postgres database, the audit log, U5's notice and run registries and its email queue. The functions delivered for U7, U8, U9, U13 and U14 have their names and meanings fixed in this Unit, with the contract deltas listed in `functional-spec.md`.
