# Original Chrome paired correction evidence

## Conditions and intervention

2026-10-05, original Waldorf tab at `http://127.0.0.1:3000`, existing Next development server. The only application intervention was removing the successful synthetic session response's `Clear-Site-Data: "cache"` header. Hot reload was allowed; no server restart, browser cache clearing, fixture reset or extension change occurred. DevTools retained Keep log checked, Disable cache checked and No throttling, matching the affected original retry. Later DevTools was closed and the original tab left on the usable parent task page.

## Paired response evidence

The preserved baseline parent selection POST/303 lasted **131508.261 ms**, including **10.954 ms** first-byte wait and **131496.017 ms** zero-body completion/receive interval. Its response included `Clear-Site-Data: "cache"`.

The first corrected parent selection POST/303 lasted **22.857 ms**, including **19.849 ms** first-byte wait and **0.820 ms** receive interval, with no Clear-Site-Data header. The root greeting appeared within a conservative native-action/observation bound of **1183 ms**. The subsequent business-page request lasted **64.198 ms** and the correct parent page/content/controls appeared. That initial main click happened in a later tool call: its **10896 ms** aggregate includes agent/tool delay and is **not** a valid application-only five-second measurement.

Source artifacts: `native-chrome-network-timings.json` (before), `native-chrome-after-network.json` (after). The original after HAR stays at `/private/tmp/waldorf-native-after-261005.har`; only whitelisted local URLs, response status/timings/nonsecret headers and invented profile IDs enter the repository. Cookies, tokens, response bodies and unrelated requests are excluded.

## Original-tab complete flows

Each successful measured flow below executed selection click → fresh root observation → immediate main-link click → fresh business-page observation in one native-control call. The bound starts before the click and ends after the observation, so it includes input and accessibility-read overhead plus navigation between those actions. It conservatively bounds submit-to-ready time; it is not a browser submit-event timestamp. Sign-out/source setup occurred outside this bound. Every bound is below 5000 ms.

| Target | Conservative upper bound | Visible readiness |
|---|---:|---|
| parent-local | 2345 ms | Szülő identity, Családi feladatok, fixture duty details, enabled Állapot and Szűrés controls |
| staff-local | 2082 ms | Exact staff identity, Beosztás, authorized schedule detail rows, enabled Csoport and Szűrés controls |
| group-admin-local | 2273 ms | Exact group admin identity, Áttekintés, dashboard summaries and tasks navigation |
| kindergarten-admin-local | 2261 ms | Exact kindergarten admin identity, Áttekintés, dashboard summaries and tasks navigation |
| super-admin-local | 2292 ms | Exact super admin identity, Áttekintés, numeric summary/records/tasks/queue panels, tasks navigation |
| parent-local after all roles | 2334 ms | Parent identity/content/controls restored, previous administrator view absent |

An early native helper used a stale accessibility snapshot between separate calls: one administrator attempt failed before a target selection, and another action hit an unrelated staff control and reported that administrator navigation was unavailable. These were control-harness errors, not measured successful administrator logins, and are not discarded application timing samples. The helper was changed to refresh the accessibility tree before each switch and choice; the complete administrator flows above then succeeded. No fixture mutation or cache reset followed these errors.

## Attribution and limits

Current [Chromium ClearSiteDataHandler source](https://raw.githubusercontent.com/chromium/chromium/main/content/browser/browsing_data/clear_site_data_handler.cc) defers the redirect while a parsed clearing task runs, then invokes the continuation callback when that task finishes. This mechanism, the baseline zero-body response interval and the single-header paired intervention support cache clearing as the cause of the affected browser's delay. The exact internal reason that this browser's cache clearing took 131 seconds was not traced; the correction removes that operation from the login path.

Fresh controlled Chrome clients did not reproduce the original delay before the correction. Their 30-flow before/after matrix remains complementary evidence and must not replace the original-tab comparison. Native upper bounds establish the original tab's usable five-profile outcome; strict submit-event measurements and repeated/cold/switch regressions remain in the controlled suite. Security/cache/authorization checks and final quality results are recorded separately.
