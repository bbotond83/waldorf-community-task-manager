# U5 code summary

Baseline before U5 (suite counts): domain 555, scripts 253, vitest 917, database notifications 124.

## What changed
- Migration `supabase/migrations/20261050_notices_and_timed_run.sql`: notices, email deliveries (outbox), timed runs, service-only claim/sweep/record functions, delivery problems list (now also the reason class and each check's created/skipped counts) and Try again.
- Seed and reset: invented notices, deliveries, tries and run records; reset runs one daily check.
- Data, facade and admin action: delivery-problems list and Try again; simulated delivery and the page-open tick removed.
- `src/identity/mail.ts`: notice mailer (fixed template, one recipient, reason class only, 30 s timeout). Four service-only functions added to `ADMIN_FUNCTIONS`.
- `scripts/timed-run.ts`, `npm run timed:run -- --mode daily|friday_noon|deliver`.
- Access: menu entry "Kézbesítési hibák" (super admin only), two matrix rows, role-policy test.
- Screen "Kézbesítési hibák" (`/admin/emlekeztetok`, same route) built from the approved Stitch screen: groups with kind and item date, latest try, failed count and the reason in words; failed or missing checks of the last 30 days as a table (cards on a phone); Újrapróbálás with success, stale, nothing-to-retry, denied and error states. Our header, navigation and footer are kept; no raw mail-server code, no name or address; `admin-delivery-*` classes, no card inside a card.
- Wording in `src/application/delivery-labels.ts`.

## Design choices and differences from the Stitch screen
- Újrapróbálás is per group (inside each card), because the database restarts one group at a time; the design shows one button at the top.
- The retry action no longer redraws the page, so the success message stays visible; the list is up to date on the next visit.
- Not built: the invented menu, footer, "next run 02:00" chip and the 48-hour wording.
- An unregistered check name is shown as it is; registered names have Hungarian labels.

## Checks run
- Typecheck, eslint (no warnings), prettier clean.
- domain 564, scripts 263, vitest 1749 (coverage 93.21 / 86.04 / 92.5 / 94.41; thresholds met), database notifications 197, identity 358, stack 131, directory 847, seed 57.
- New automatic mail-catcher check (`tests/database/notices-mail-catcher.test.ts`): two families, the command sends over SMTP, the caught message holds title, item, link and the automatic line, one recipient, nothing of the other family.
- Browser: new `tests/browser/delivery-problems.spec.ts` (6 tests: list without personal data, retry, stale and nothing-to-retry apart, keyboard, 320 px, other roles denied; axe clean). `admin-advanced.spec.ts` updated; `list-polish.spec.ts` lost its two checks of the old reminder filter (the page has no filter now).
- `npm run verify:local`: PASS (all three browsers).

## Timing on db:seed:large (Chromium, owner's computer)
The large seed holds only 3 notices, so 60 invented notices with failed emails per parent were added first (707 notices, 705 failed deliveries): notice list 67 ms, Kézbesítési hibák 54 ms (target 2 s), daily run 3 ms on a repeat and about 20 ms on the first run (target 30 s). Command: `NOTICES_TIMING=1 npx playwright test tests/browser/notices-timing.spec.ts`.

## Documents
README (timed command, reset note), `verification/AUTHORIZATION.md`, contract-summary C8/C9 amendments, `source-manifest.json`, `traceability.json`.

## Owner-review screenshots
`screenshots/built/`, phone and computer each: 1 empty, 2 list, 3 stale, 4 success, 5 nothing to retry, 6 parent notice list. Each shot first checks the heading and that no error or denied page shows. Regenerate: `NOTICES_SCREENSHOTS=<folder> npx playwright test tests/browser/notices-screenshots.spec.ts`.

## Not verified
Nothing is scheduled to run `timed:run` (hosting work). Real mail servers were not used (local catcher only). The screenshots are for the owner's comparison; no automatic picture comparison.

## Review fixes (Step 17)
- Try again key: built from a hash of the full sorted (delivery id, try count) list (`deliveryRetryKey`); test for the 3+3 versus 6+0 collision.
- Notice mail: no bare "Feladat:" or "Időpont:" line when the name or date is blank.
- Retry limit raised from 500 to 5000 failed emails per group (migration edited in place and re-applied locally); beyond that `REMINDER_TOO_LARGE` with its own Hungarian message. Database test retries 501 and refuses 5001.
- `timed:run`: a failed run call no longer skips the delivery pass; it exits non-zero afterwards.
- 30-second timeout now aborts the send: the SMTP transport opens one connection per send and destroys it on abort. Tests: fake transport sees the abort; a real stalled local server sees the connection close.
- `notices-send.test.ts` header and `unit-test-instructions.md` record why "outdated screen" is not meaningful for `notice_send`.
- Checks: typecheck, eslint, prettier clean; domain 569, scripts 264, vitest 1755 (coverage 93.24 / 86.06 / 92.53 / 94.44), database notifications 199, identity 358. Full `verify:local` not run (the coordinator runs it).
