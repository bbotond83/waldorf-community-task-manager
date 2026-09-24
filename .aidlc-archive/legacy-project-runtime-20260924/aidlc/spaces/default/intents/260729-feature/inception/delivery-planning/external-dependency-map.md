# External Dependency Map

## Gated Dependencies

| Dependency | Owner | Blocks | Mitigation |
|---|---|---|---|
| Final controller and EU DPAs | Kindergarten/legal entity | production release | use non-production data until approved |
| EU Supabase and email configuration | Platform owner | reminder and release validation | verify configuration before Bolt 2 release |
| Workbook mapping acceptance | Kindergarten administrator | Bolt 4 commit | preview queue and mapping-register sign-off |

## Internal Dependencies

The Unit DAG in `../units-generation/unit-of-work-dependency.md` remains the source for technical prerequisites.
