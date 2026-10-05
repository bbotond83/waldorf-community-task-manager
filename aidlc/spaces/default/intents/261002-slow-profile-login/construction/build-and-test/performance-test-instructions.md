# Profile login performance instructions

## Preparation and command

Use Node 24.x/npm 11.x and the installed lockfile dependencies. In this workspace prefix commands with `PATH=/opt/homebrew/opt/node@24/bin:$PATH`. Use synthetic local fixtures only.
Build synthetic production first using build-instructions.md. Run the exact dedicated command from `../code-generation/unit-test-instructions.md`; no retries or parallel workers. The harness uses empty dedicated development output per first-use profile and prebuilt production output with fresh processes/browser contexts. Preserve the existing user development server and never reset fixtures before first submission.

## Targets and evidence

For each runtime record all five first and five switch-destination intervals individually. Every sample must be <=5000 ms from browser submit to greeting and usable authorized navigation. Compilation after submit is included. Incorrect identity, navigation, isolation or timing fails. Boundary unit tests accept5000 and reject5001/nonfinite/negative values. Save Playwright timing attachments and server logs under this stage evidence before another browser runner replaces test-results. No average may mask failure. This verifies local conditions; the originally reported slowdown remains undiagnosed.
