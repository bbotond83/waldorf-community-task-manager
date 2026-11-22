# U7 Swaps and duty changes: code summary

Unit U7 lets a family ask another family to swap duties (with a reason), lets the other family accept or decline, lets the asker withdraw, expires open requests daily, lets an administrator reassign a published duty, reverse an applied swap and decide cancellation requests, and adds the functions later units call. Contains no real names or contact details; all test data is invented.

## What changed

- **Database** (`supabase/migrations/20261059_swaps_and_duty_changes.sql`, `20261060_rota_week_duties.sql`): a swap exchanges the family on the two place rows; the duty rows do not move. New commands `swap_request`, `swap_respond`, `swap_withdraw`, `cancellation_request`, `cancellation_decide`, `duty_reassign`, `swap_reverse`; reads `swap_candidates`, `swap_incoming`, `swap_list`, `cancellation_list`, `rota_week_duties`; internal `place_add`, the daily `dutychanges_swap_expiry_check` and the removal pair `dutychanges_removal_preview/apply`. `change_requests` stays closed to direct reads, `swap_decide` loses its grant (BR75.4). New notice kinds and audit actions are listed in the contract summary.
- **Application and data layer**: `src/data` (`parent-port.ts`, `admin-port.ts`, `admin-tasks.ts`, `rota.ts`, `results.ts`), `src/application` (swap and admin facades, payloads, contracts), `src/runtime/navigation.ts` (new "Cserék" item for group admin and super admin). `SwapRequestItemModel` now carries `status`, `endedReason` and `reason`; the rota plan weeks carry `dutyId` and `placeVersion` for published plans.
- **Screens** (designs approved by the owner in Stitch; screenshots reviewed and approved):
  - `/szulo/cserek`: requests to the family, own open requests (swap and cancellation, each with its reason) and a "Lezárt kérések" section with the ended requests.
  - `/admin/cserek` (new): all swaps with status; an applied swap shows the reverse form, a swap whose places changed since shows that it can no longer be reversed.
  - `/admin/beosztas`: hand-over panel per published week (family select, `duty_reassign`); `/admin/jovahagyasok/[id]`: swaps no longer appear there, cancellations do.
  - The parent's swap and cancellation forms now send the reason. New classes use the `admin-` and `parent-` prefixes (`admin-swap-card`, `swap-request-reason`, `swap-status-chip`); Stylelint clean.
  - Not built: the direct-assign pop-up "Család kijelölése" and the search box and statistics panels of the Stitch draft (the owner approved the screens without them).
- **Seed**: the small seed holds one open swap (families 3 and 5, first group) and one open cancellation (family 6, second group), placed on families the older browser specs do not use; the large seed also holds 200 ended cancellation requests in every ended status.
- **Old tests changed with the new rules**: `kernel-swaps.test.ts` was deleted (its cases moved into the six new `swaps-*` files); `rota-four-plan`, `rota-plan`, `rota-standing`, `schedule` and the identity catalogue tests, the browser specs `directory-coordination` (a swap now exchanges families, not tasks) and `visual-overhaul` (menu sizes 15 and 10) were updated.
- **Review fixes (iteration 2)**: `rota_week_duties` now also lists a week left empty by an approved cancellation (the version to send is the duty's own, so `duty_reassign` adds a place with `place_add`) and leaves out duties that have started; indexes on the two family columns of `change_requests`; Hungarian texts for `REQUEST_CONFLICT` and `CANCELLATION_EXPIRED` on the parent and admin screens; `swap_respond`, `cancellation_decide` and `swap_reverse` treat a missing request version as an outdated screen; the daily expiry and the family removal lock every duty and place of the whole batch in order before changing a request; an approved, reversed or administrator-rejected request must carry its decision time.
- **Docs**: U7 deltas appended to `inception/contract-design/contract-summary.md` (C1, C5, C8, C9, C11, C16, C19).

## Checks run

- `npm run verify:local` (with the local settings loaded and no leftover app server): exit 0. Vitest 2,055 in 152 files with coverage 92.19% statements, 85.99% branches, 93.58% functions, 93.64% lines (floor 80/80/80); browser 786 tests in Chromium, Firefox and mobile Chrome; privacy scan over 1,449 files.
- Database suites: every `swaps-*` file (144 tests, both schemas) and the files touched by the review fixes pass; the whole database suite runs inside `npm run verify:local` after migrations 59 to 63.
- Fixed list per database rule: allowed, refused, out of reach, outdated screen and repeated click are covered in `swaps-propose-answer`, `swaps-admin`, `swaps-rota` and `swaps-for-later-units`. Two people at once (20 repeats each, `swaps-races`): opposite proposals, accept against withdraw, accept against refuse, accept against admin reassignment, two decisions on one cancellation, cancellation request against swap request on one place, two reassignments, two reversals. Weekend-pick follow-through (pick moves with a reassignment, returns to the weekend family on an approved cancellation, untouched after the Saturday has begun, null family for a weekend place refused) and the hand-over of an emptied week are in `swaps-picks`.

## Problems found and fixed along the way

- The parent's swap and cancellation forms did not send the reason; fixed in `app/szulo/actions.ts` with a test.
- The seeded open swap first sat on the first group, which broke 106 older browser specs; moved so the older specs see clean data. A swap with the "new" family is refused (`new_before_changeover`), so the seed swap pairs families that may take the duty.
- The administrator swap card was squeezed beside the reverse form; fixed with `admin-swap-card`.
- The rota hand-over panel needed one more small read (`rota_week_duties`), added after the owner agreed.

## Not verified or left open

- Functions without a screen (the daily expiry check, the removal pair for U14, the C19 block) are tested directly in the database tests only.
- The hand-over panel on the administrator's rota page uses the emptied-week version; this path is tested in the database (`swaps-picks`) and not in the browser.
- Nothing is committed; the migrations have run on the local stack only.
