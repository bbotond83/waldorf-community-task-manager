# Reliability Requirements: u8-animal-care-and-information

Sources: NFR6, NFR7 and NFR11 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C3, C4, C5, C8, C9, C16 and C20 in `contract-summary.md`. Nothing is hosted in this work (`technology-stack.md`), so no availability target applies.

## Data Integrity

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR7.1 | Creating slots is all-or-nothing: every missing slot and its duty, the calendar's creation time and the audit entry commit together or not at all (BR80.3). | A forced failure midway leaves no new slot. |
| NFR7.2 | A start-time change is all-or-nothing: the calendar, every moved slot's start and end, the holders' notices and the audit entry commit together; a failed email never rolls it back (BR80.4). | A forced failure after moving some slots leaves every slot at its old time. |
| NFR7.3 | Slot start times are local Budapest times: a 07:30 slot starts at 07:30 on the clock in both clock-change weeks, and the 24-hour limit and the three-day and one-day windows are counted in Budapest time (BR80.4, BR82.3, BR85.1). | Tests set slots and the moment just before and after the limit in both clock-change weeks. |
| NFR7.4 | The first weekday of a month and the next three calendar days are worked out in Budapest time, including months starting on a Saturday or Sunday and runs just after midnight (BR84.1, BR85.1). | Tests run each check at chosen moments. |
| NFR7.5 | The database itself refuses a second slot for the same calendar, date and part, a slot on a Saturday or Sunday, a morning time not earlier than the afternoon time, a second round for the same month, and a section key used twice in a community. | A test tries each directly as the database owner. |
| NFR7.6 | The migration adds the origin kind `animal_slot` without changing any existing duty, and adds the six starting sections over a seeded database whether or not the named working groups exist. | A test applies the migration over a seeded database with and without the groups and compares rows. |
| NFR7.7 | A failing daily check of this Unit is recorded and the other checks still run; a second run the same day sends nothing more (C9, BR85.6). | A forced failure in each check, then two runs. |
| NFR7.8 | Every change passes `npm run verify:local`: type checking, tests, production build, start smoke, the critical browser flow without serious or critical accessibility violations, and dependency scanning. | The `Validate` check is green in all three browsers. |

Recovery is forward-only: a defect found after merge is fixed by a new migration file.

## Testing Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR6.1 | Application code, including the section-text renderer, keeps at least 80% line, branch and function coverage. | Coverage thresholds pass unchanged. |
| NFR6.2 | Every database rule has the fixed list: allowed, refused, out of reach, outdated screen, repeated click, two people at once. | The test plan has one row per rule with every cell naming a test or saying "nem értelmezhető" with its reason. |
| NFR6.3 | Each new database test file is added to its `test:database:*` script and to the shuffled run; `identity-catalogue.test.ts` and `notification-use-cases.test.ts` are extended for the new functions, tables and notice kinds. | The scripts name the file and both catalogue tests pass. |
| NFR6.4 | The fair-share figures are tested on worked examples: only staying families, a leaving and a new family, a family with no standing row, no held slot at all, and a family exactly at its share. | A database test asserts each family's count, share and the average. |

## Existing Behaviour

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR11.1 | Removing a family or parent handles slots through U2's place block like any other place: future slots of a removed family are freed, past ones show "korábbi tag" in the slot list, and the fair-share read drops the family. The Unit's own tables hold no person (C16). | A test removes a family that holds past and future slots and reads the list and the fair share. |
| NFR11.2 | The existing sign-up (C18), swap (U7) and duty reminder (U5) behaviour is unchanged for other duties; slots use them as they are. The duty card read `rota_duty_card` changes only by gaining the `info_links` field (NFR3.7). | The existing kernel sign-up, swap, reminder and duty card tests pass unchanged, apart from the new field. |

## Review follow-up (after the owner review)

- **NFR9.1 and NFR9.5 also cover `/teacher/allatok`**: it makes the same two reads as the parent sign-up page (slot list, fair share), no call per row, and opens in the same 2-second target on the large seed.
- **NFR11.2**: `schedule_get` now leaves out the tasks whose origin is an animal slot (migration 20261069, BR81.7); every other task and event is listed as before.
- **NFR3.5 and NFR3.6**: a coordinator who asks for a hidden section is refused with the same `authorization_denied` as for a missing one, and the caller is checked on an unlocked read before the section row is locked. The teacher page uses the same read function as the parent page, read-only, and NFR3.11 gains its matrix row (`/teacher/allatok/**`, read).
- **Two first saves at once**: two super admins saving a year's first calendar at the same moment give one winner and one `VERSION_CONFLICT` (migration 20261070); the database test runs it eight times.
