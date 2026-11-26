# Reliability Requirements: u14-removal-and-anonymisation

Sources: `functional-spec.md` and `rules.md` of this Unit, its design review (R-02, R-04, R-07), NFR5, NFR6 and NFR11 in `requirements.md`, contracts C1 and C16 in `contract-summary.md`, and `technology-stack.md`. Contains no names or contact details.

The app runs on the owner's computer against the local stack; there is no hosted availability target in this work (`team.md`, Deployment). Reliability here means every removal is all-or-nothing, safe against two people acting at once, and safe to repeat.

## Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR5.1 | Removal and the later run lock the family row first, then the family's task rows ascending, then its place (assignment) rows ascending, before the first step runs; the steps then lock their own rows in the C1 order (design review R-02). | A test removes a family while another session swaps, signs up for, or gives up a slot on one of the family's duties; both finish without a deadlock and the result equals running them one after the other. |
| NFR5.2 | Two administrators removing the same parent or family at once, or removing a parent while the family is removed, end with exactly one removal; the second is refused with VERSION_CONFLICT (BR201.4). | Fixed-list "two people at once" tests for parent and family removal. |
| NFR5.3 | A repeated click with the same idempotency key returns the stored result, including the ended account ids, and runs nothing again (BR200.3). | Fixed-list "repeated click" tests. |
| NFR5.4 | An outdated confirmation page (wrong version) is refused and changes nothing. | Fixed-list "outdated screen" tests. |
| NFR11.1 | Any refusal or failure of any step rolls the whole removal, or the whole later run, back; the subject and every record are as before (BR201.1, BR206.2). | A test makes one step refuse and compares every touched table before and after. |
| NFR11.2 | The duties step keeps today's archive behaviour for freed manual places: reminders are planned again and the place-removed notice goes out as today (R-02). | A test removes a family with a manual future place and checks the reminder plan and the notice. |
| NFR11.3 | Running the later delete or anonymise after a removal finds the steps' work already done and returns zero counts for it, and never fails because a step already ran (BR206.2). | A test removes a family, waits out the 30 days in the test clock, runs the later step and checks the counts. |
| NFR11.4 | A family is deleted only when no record points at it or its parents after the steps ran; otherwise it is anonymised (BR206.3). A delete never leaves a row pointing at a missing family or parent. | Tests for both outcomes, and a check of every table for links to the deleted ids. |
| NFR11.5 | Restore within 30 days brings the family, parents and children back as active and the flags clear; what removal ended stays ended (BR207.1). | A test removes, restores, and checks both lists. |
| NFR6.1 | Every database rule of this Unit gets the fixed test list: allowed, refused, out of reach, outdated screen, repeated click, two people at once. Where a case has no meaning for a rule, the test plan says why. Each new test file is added to its `test:database:*` script and to the shuffled run. | The test plan lists each rule against the six cases. |
| NFR6.2 | Existing tests that change with this Unit change in the same pull request: the tests that expect "korábbi tag" for a family, and the test that expects `family_archive` to refuse DUTY_ROTA_MANAGED (R-07). | The changed tests are listed in the code plan. |
