# Logical Components: u14-removal-and-anonymisation

Sources: this Unit's `functional-spec.md`, its `security-requirements.md`, `reliability-requirements.md`, `performance-requirements.md`, `scalability-requirements.md`, `observability-requirements.md` and `tech-stack-decisions.md`, contract C16 in `contract-summary.md`, and both earlier reviews. Contains no names or contact details.

## Components

| Component | Lives in | Role | Failure domain |
|---|---|---|---|
| Lifecycle commands (`parent_remove`, `family_archive`, `lifecycle_run`, `family_restore`) | Database functions, new migration | Lock, check, run the steps, audit | One transaction; all or nothing |
| Lifecycle reads (`removal_preview`, `removal_flagged_items`, `lifecycle_family_still_referenced`) | Database functions | Count, list, decide | Read only |
| Eleven removal steps | Each owning component's functions; five changed here (duties new; events, checklists, recurring_duties, dutychanges empty own texts) | Clear, flag, empty | Inside the command's transaction |
| Name helpers (C6) | Community functions | Show former people | Every history read |
| Removal server actions | `app/admin/parent-actions.ts` and the family record's actions | Call the command, end sessions, route to the result page | Session ending can fail after commit; database check covers it |
| Screens | Admin area: parent and family confirmation, result, restore confirmation | Present preview, refusals, result | Designed in Stitch first |

Blast radius: a fault in one step stops the whole removal and changes nothing; no other family's records are touched.

## Which Text Wins

Later decisions replace these parts of the frozen functional design. Code Generation follows this table.

| Design rule | Replaced by | Change |
|---|---|---|
| BR204.1, entities.md Parent.displayName (single parent keeps stored name) | NFR1.4 (owner answer NFR Q2) | A parent removed on their own gets `Anonimizált szülő` at removal |
| BR204.2 (only sign-up and offer notes emptied) | NFR1.3 (owner answer NFR Q1) | Also checklist-claim notes, skip reasons and request reasons, at removal |
| BR206.4 (contribution notes and change-request reasons emptied only on anonymise) | NFR1.3 | Request reasons of the subject are emptied at removal; the anonymise step keeps emptying contribution notes |
| BR200.2 and RemovalPreview.refusal (two refusals) | NFR3.3 and security-design.md (NFR Design Q1) | Add `last_super_admin` and `SELF_REMOVAL` |
| BR201.1 (family row only) | NFR5.1, reliability-design.md | Family row, tasks, places, then the steps |
| RemovalReport.endedAccountIds (no source) | NFR3.1 | Read before the steps run |
| BR202.2 ("an id that matches no parent" on delete) | reliability-design.md | A place pointing at the family means anonymise, so delete never leaves such an id; the kept done-by is a deliberate change to C16 because the done-mark check ties time and person |
| W7 (all flagged duties) | observability-design.md | Only items flagged because of this removal |
