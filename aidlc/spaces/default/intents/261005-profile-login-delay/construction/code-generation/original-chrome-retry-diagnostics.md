# Original Chrome Retry Diagnostics — 2026-10-05

## Original Context Retry

User explicitly requested another test in the original Chrome tab. Parent owns the native UI retry. Before retry the affected tab at `http://127.0.0.1:3000/` visibly showed the selector. Parent clicked the Szülő profile once; at the parent's approximately 74-second observation it still showed the selector, toolbar Stop-loading icon and tab loading indicator. The native Chrome UI remained responsive to inspection. This is a lower-bound loading observation from UI screenshots, not a precise submission-to-usability performance sample. There was no resubmit, reload, cache clearing, fixture reset or server restart.

Parent opened DevTools after submission: Console had no selected JavaScript context and no visible messages. Network settings already showed Keep log enabled, Disable cache enabled and No throttling. Parent cleared only a visible `/agent` display filter; no captured request became visible. Because DevTools opened after submission, its empty request list does not establish that no POST reached the server. Original Chrome context differs from the controlled headless contexts; these differences are investigation candidates, not demonstrated causes.

## Read-Only Server Evidence

Diagnostics recorded at 11:31:26 UTC. PID 69538 remains the existing Node/Next development server in this repository. `lsof` shows stdout/stderr only on `/dev/ttys004`; no regular-file output log was found. The terminal device was not read, to avoid consuming terminal input. No new HTTP probe or application request was issued.

`.next/dev/trace` was safely parsed with only event names/durations/IDs and a narrow route-tag allowlist, excluding secrets. File size was 299231 bytes; modification time remained **10:30:56.620 UTC**, covering the earlier controlled baseline. Its latest flushed route entries concern the session/root/business requests from that baseline. It contains no flushed entries attributable to the current original-tab retry. A stale/buffered trace cannot prove that the current request is absent, blocked or completed quickly; current server handling/response evidence remains missing.

`lsof -nP -a -p 69538 -iTCP` showed a listener on `127.0.0.1:3000` and one established connection to peer port 64543. Socket existence does not identify the profile POST, response status or duration.

## Cache Header Hypothesis and Limits

Existing source `app/api/synthetic/session/route.ts` validates runtime/origin/profile, returns a signed HttpOnly cookie and 303 redirect to root, and sets `Clear-Site-Data: "cache"` for successful profile selection. Explicit sign-out does not set this header. The 30 passing controlled target samples used the same route/header without source changes. Therefore the header's presence alone does not explain why only the original browser context remains loading. Possible interaction with its cache, extensions or existing DevTools Disable cache setting is unproven; no setting was toggled and no response/header A/B experiment occurred.

The next useful evidence is existing server terminal scrollback or an already-captured original request showing whether the POST was received and whether its response/redirect completed. Parent may inspect the relevant server terminal output without entering commands or consuming the TTY stream. Do not declare a server bottleneck, cache-header cause or fix from this evidence alone.

## Work Status

No application/test/source/config change, additional measurement matrix, new server, test/build execution or speculative correction was performed. Parent continues original-tab UI diagnosis; lifecycle and user checkpoints remain parent-owned. The defect is unresolved and causal attribution is incomplete.
