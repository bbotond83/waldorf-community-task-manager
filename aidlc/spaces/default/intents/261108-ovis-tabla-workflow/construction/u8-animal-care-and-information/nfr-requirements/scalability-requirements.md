# Scalability Requirements: u8-animal-care-and-information

Sources: NFR5 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C1, C4, C5, C18 and C19 in `contract-summary.md`. Stack limits are in `technology-stack.md`.

## Load Projection

One community of about 20 families: about 400 slots a school year, a few sign-ups a day, six to a dozen information sections. The slot list returns at most a few weeks at a time and the fair-share read one row per family, so both stay far below the data API's limit of 1000 rows. The daily checks read three days of slots and one month's round. No scaling mechanism is needed.

## Concurrency Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR5.1 | A repeated click on any command of this Unit (sign-up, give-up, calendar save, slot creation, section create, update and hide) returns the stored result and changes nothing again. | Fixed-list "repeated click" test. |
| NFR5.2 | Two families signing up for the same free slot at once give one holder and one DUTY_FULL (BR81.3). | A two-at-once test counts the active places. |
| NFR5.3 | A give-up at the same moment as a sign-up attempt by another family ends as if one came first: either the give-up succeeds and the other family then holds the slot, or the sign-up is refused as taken and the give-up succeeds after it. | A two-at-once test in both orders. |
| NFR5.4 | A give-up at the same moment as a swap proposal naming the same place gives one success and one refusal (REQUEST_CONFLICT for the give-up, or the swap refused because the place is no longer active) (BR82.4). | A two-at-once test in both orders. |
| NFR5.5 | Two super admins creating slots at once give one set of slots; a creation at the same moment as a start-time change ends with every slot at the new time (BR80.3, BR80.4, BR89.1). | A two-at-once test counts slots and reads their times. |
| NFR5.6 | A sign-up or give-up at the same moment as a start-time change ends consistently: the 24-hour limit is judged against the time that holds when the give-up's lock is taken. | A two-at-once test with a slot moved across the 24-hour line. |
| NFR5.7 | Two editors saving the same section at once give one saved version and one VERSION_CONFLICT (BR87.4). | A two-at-once test reads the section. |
| NFR5.8 | Each daily check run twice at once sends each message once, by the once key, and records one fair-share round (BR84.1, BR84.3, BR85.3). | A two-at-once test counts the notices and the rounds. |
| NFR5.9 | Bulk slot commands lock the calendar row, then slot duties by ascending id, then places by ascending id; sign-up and give-up lock as U2 and U7 do, and no command locks a family row to check a standing. | The race tests pass; no deadlock appears in repeated runs together with U7's swap race tests. |
