# Baseline Checkpoint — 2026-10-05

## Actual Server and Controlled Chrome Measurements

User clarified that the existing `http://127.0.0.1:3000/` Chrome tab is the affected origin; see `reproduction-questions.md`. Original tab observation was preserved before controlled contexts.

Existing server was not restarted or reconfigured: npm PID 69473, Next CLI 69537, next-server 69538, Next 16.3.6 development mode with `--hostname 127.0.0.1`. Executable inspection identifies Node 24.21.0 and existing `.next/dev` Turbopack cache. stdout/stderr point to `/dev/ttys004`; server-request/compilation intervals were not extracted. Historical cache temperature remains unknown.

Owned temporary harness `/private/tmp/waldorf-profile-baseline-261005.mjs` ran with Node 24.21.0 and installed real Chrome 154.0.8037.98 against that unchanged server. Browser launch initially failed under filesystem sandbox; the explicitly approved escalated run succeeded. No original Chrome profile was reused or erased; temporary headless contexts are distinct from the extension-bearing original context. No route warm-up, fixture reset, cache clearing or server lifecycle operation occurred.

All 30 target flows passed the plan's usable-main-page checks and inclusive 5000 ms limit; 15 switch-source setup attempts were also recorded. These observations do not reproduce the reported nearly three-minute delay or prove a correction.

| Profile | Target samples | First selection ms | Switching ms | Maximum target ms |
|---|---:|---:|---:|---:|
| parent-local | 6 | 1390.4 | 284.7 | 1390.4 |
| staff-local | 6 | 292.0 | 294.4 | 332.0 |
| group-admin-local | 6 | 299.5 | 295.7 | 299.5 |
| kindergarten-admin-local | 6 | 297.8 | 271.7 | 297.8 |
| super-admin-local | 6 | 343.2 | 274.0 | 343.2 |

Raw evidence is `baseline-timings.json`, including every target/setup attempt and sanitized request paths/methods/timing segments. Harness text is retained as `diagnostic-harness.mjs`; SHA-256 `22dfc046e4298431a1244807c33a3b266650abc382b7eab8bfab4191df2d7573`. Parent first selection was the first observed parent destination use during this run; staff/admin initial destination uses occurred in source setup before their target first samples. Those later target samples are server-warmed observations, not cold-server measurements. Browser initial contexts were fresh and natural caches were retained for repeats/switches.

## Original Chrome Context Observation Failure

After the controlled matrix, bounded original-context exercise resumed using CUA only. Existing tab `352961374` still showed the parent root greeting. Clicking `app-shell-switch-profile-button` succeeded: accessibility observation visibly showed all five profile selection cards. Clicking `profile-selector-parent-local-button` then attempting observation failed with `Page.getFrameTree` CDP timeout. A subsequent read-only accessibility observation failed with `Emulation.setFocusEmulationEnabled` CDP timeout. Selection was not repeated.

Read-only performance timing retrieval was unavailable because `performance` was undefined in the supported CUA evaluation scope. A native Chrome read-only app lookup was attempted as the documented alternative; it was aborted by the user after 328.8 seconds without a returned UI state. These durations are tool/inspection overhead, not application login measurements. Current original-tab completion/loading/error state is unknown. No original-context causal bottleneck has been established; browser extension/cache differences remain hypotheses.

## Pending Checkpoint and Work Status

Parent's Original Chrome Tab Observation question in `reproduction-questions.md` is pending and was preserved. Required input: whether the original tab now visibly shows the completed parent page, remains loading/unresponsive, or displays an error. Further reproduction action depends on that observation. FR1.3 remains active; Code Generation is incomplete.

No application/source correction, repository test changes, full test/quality baseline, tests, builds, after-change timing or reviewer ran. Only planning/evidence artifacts and the owned temporary diagnostic harness were written. Existing unrelated edits were preserved. All eight implementation checkboxes remain unchecked because Step 1 lacks original-context attribution and unresolved reproduction evidence.
