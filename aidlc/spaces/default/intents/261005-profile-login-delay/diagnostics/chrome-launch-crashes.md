# Chrome Unexpectedly Quit During Testing

## Finding
Five macOS Chrome crash reports at 14:42:46–14:42:48 Budapest time match all five browser PIDs in the initial Build and Test sandbox launch. Each terminated with SIGABRT while macOS registered the application: `_RegisterApplication` / `TransformProcessType`. Playwright reported launch failure before any application flow ran, and cleanup also reported EPERM.

The same source and test command succeeded after normal approval to run outside the restricted execution sandbox at 14:43:15 onward. All five Chrome cases (30 targets plus15 setup flows) passed. No later Google Chrome crash report was found for today during this inspection. Earlier same-day Chrome reports show the same registration/abort stack. This strongly attributes the observed testing popups to browser startup under the restricted execution environment; no application-page crash is evidenced by these reports.

## Prevention
For subsequent native Chrome browser tests on this macOS machine, request the normal execution approval before launch and use the approved execution path from the first attempt. Continue using temporary test profiles and owned servers/outputs. A Chromium `--no-sandbox` argument does not remove the outer command-execution restrictions; that flag was already present in the failed launches. No global OS crash-dialog setting or user Chrome profile change is needed.

## Scope Recommendation
Keep this diagnosis in the current intent as verification-environment evidence. A separate tooling intent is appropriate only if a persistent runner/preflight or cross-project workflow improvement is desired. Do not mix such framework changes into the completed login application correction.

## Evidence
`chrome-launch-crashes.json` contains only whitelisted filenames, timestamps, PIDs, signal and stack symbols; full OS crash reports were not copied. Existing saved test log: ../construction/build-and-test/logs/sandbox-existing.log. Approved successful runs: ../construction/build-and-test/execution-results.json. The exact restricted service/permission that caused macOS registration to abort was not independently traced; sandbox attribution is based on matched startup crashes and successful identical approved runs.
