# Reproduction Questions

## Origin Clarification

FR1.3 checkpoint: Chrome inventory exposes the existing app tab at `http://127.0.0.1:3000/`, but no tab at the previously confirmed `http://localhost:3000`. Read-only observation is recorded in `actual-environment-observation.md`; timing and implementation have not begun.

Which Chrome tab showed the slow profile login?

- A — Use the existing `127.0.0.1:3000` tab; it showed the delay.
- B — Use `localhost:3000`; I will make that affected tab available.
- X — Other: provide the affected browser origin and reproduction step.

[Answer]: A — Use the existing `127.0.0.1:3000` tab; it showed the delay.

## Original Chrome Tab Observation

Thirty controlled real-Chrome flows on the unchanged affected server all completed within 5000 ms; the maximum was 1390.4 ms. In the original Chrome tab, profile switching showed the selector, then selecting Szülő caused a browser-inspection transport timeout. That timeout is not an application timing measurement.

After the Szülő selection in your original Chrome tab, what do you see now?

- A — The Szülő greeting/page has loaded.
- B — The tab is still loading or unresponsive.
- C — An error is visible.
- X — Other: describe the visible state.

[Answer]:

## Status

The user selected option 1 in chat, confirming the existing `127.0.0.1:3000` Chrome tab as the affected environment. Continue baseline capture at that origin. This corrects the earlier localhost selection; retain the original approval as provenance. Code Generation remains incomplete. The previous attempt to log this clarification was refused by the execution guard with `CODE_GENERATION_EXECUTION_INELIGIBLE`; subsequent plan verification confirmed the receipt valid and execution allowed.
