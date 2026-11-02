# The real workbook and the known limits (U5 final report)

Written for the owner of the repository at the end of unit U5 "Seed and test migration". It answers FR11.1, FR11.2,
NFR1.69 and NFR6.30. It names no person, family or contact value, and the workbook itself was not opened to write it.

## 1. The real workbook and the git history

- The file `source-materials/waldorf-community-app/Ovis tábla v2.xlsx` holds real personal data of parents and children.
- **It is not tracked** and it is listed in `.gitignore`: a new commit cannot contain it by accident, and the privacy
  scan (`npm run scan:privacy`, part of `npm run verify:security` and `npm run verify:local`) fails for any tracked
  workbook or other file with personal data.
- **It is not in the history of this repository.** This public repository was created in November 2026 from a
  rewritten history: every commit that had ever touched the workbook was rewritten to leave it out, so all commit ids
  differ from the earlier private repository. `git log --all -- "source-materials/waldorf-community-app/Ovis tábla v2.xlsx"`
  lists nothing.
- The owner keeps the earlier history in a separate private archive. Never copy the workbook into a clone of this
  repository, and never make that archive public.
- Tests and the seed never read the workbook. The seed uses invented data only (Hungarian names, `@example.test`
  addresses and example telephone numbers that the privacy allowlist allows).

## 2. Known limits

Each limit is a decision or a gap that is known and accepted for this unit. None of them is hidden by a passing test.

1. **Reminder recipients are not re-planned when a family changes group.** A reminder job is planned for the families
   that hold a place on a task when the place is added, changed or removed. If an administrator moves a family to
   another group, the reminders already planned for its old group's tasks stay as they are, and nothing new is planned
   for the new group's tasks until a place changes. The question (Q3) was answered with "leave it open".
2. **Staged import data expires only when somebody signs in.** An unfinished import keeps its staged rows for seven
   days. The expiry (and the audit-log purge after 365 days) runs inside the housekeeping that every sign-in triggers,
   and in `npm run db:reset`. There is no scheduler on the local stack, so an unused system never cleans itself up.
   A hosted environment needs a scheduler that calls the housekeeping function; that is not part of this unit.
3. **Hosted-target checks stay outstanding evidence.** Nothing in this unit contacted a hosted Supabase project, a
   mail provider, Vercel, or a Safari environment. The verification reports list these rows as `OUTSTANDING`. A
   local pass does not satisfy them, and `verify:local` accepts no target credentials.
4. **Invitations cannot be sent from a screen.** The invitation library (creation, the mail, the acceptance page, the
   single-use link) is complete and has database, unit and browser tests, but no administrator screen and no command
   calls it yet. The Hungarian guide therefore describes only the not-valid page and the automatic tests. This is a
   gap in the product's reachability, not in the tests.
5. **Hungarian notice titles have not been reviewed by the owner.** The notification titles are built in the
   database function from the kind and the task title: "Jelentkezés megerősítve", "Cserekérés érkezett",
   "Csere jóváhagyva", "Csere elutasítva", "Csere döntés", "Lemondás jóváhagyva", "Lemondás elutasítva", "Lemondás
   döntés", "A helyed törölve", "Egy hét múlva", "Holnap". The wording was chosen by the developers; the owner should read
   them and say what to change.
6. **Seed passwords are fictitious but tracked.** The four role passwords are in `scripts/db/seed/data.ts` on purpose
   (they work only on a local stack, the commands never print them, and the bundle test proves they are not in the
   application output). They must never be used for a real account.
7. **The browser phase is long.** The three browsers run one after the other on one machine and take about eleven
   minutes together (Step 19). CI gives the Validate job 90 minutes.
8. **Moderate dependency findings.** `npm audit` reports 5 moderate findings; the gate blocks high and critical ones
   only, and none is open.

## 3. What was removed, what stays

- The demo mode, the profile picker, its routes, cookie and settings, and the four demo adapters are gone; tests prove
  that no name, route, cookie or setting of them exists in production source and that the old routes answer "not
  found".
- The test schemas `worker_1` to `worker_4` stay the only test schemas; accounts are scoped per schema by the address
  prefix `<schema>.` that `db:worker` and `db:reset` share.
