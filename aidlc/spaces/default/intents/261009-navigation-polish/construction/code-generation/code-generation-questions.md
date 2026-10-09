# Code Generation Plan Approval

AI-DLC writes this file when it asks you to approve the plan. To answer here
instead of in chat, write your answer after `[Answer]:` and say done.

## Plan Approval

Approve the code plan?

- Builds: one consistent menu per profile shown as buttons, a default landing page per profile (no welcome page, no teacher menu), whole-card list items for every role, Hungarian status words, and a ...
- Touches: `src/runtime/` (`AppShell.tsx`, `ProfileSelector` unchanged, `synthetic/profiles.ts`, new `AppNav.tsx`, new `status-labels.ts` under `src/application/`), `app/page.tsx`, `app/api/synthetic...
- Tests: about 5 new test files plus updates to about 14 existing ones (unit, component, page-render and Playwright browser tests).

Full plan: aidlc/spaces/default/intents/261009-navigation-polish/construction/code-generation/code-generation-plan.md
Test instructions: aidlc/spaces/default/intents/261009-navigation-polish/construction/code-generation/unit-test-instructions.md

[Approval Fingerprint]: sha256:v3:bd924c6e5e1b771d31d016db3f02a6764f10113cd41cc79c8d6f6a27b74de9b1
[Planned Source]: 33080333e1dad66f7da37c13e759a52c4591e4aef27f08279a770fa3997b21d7

- A. Approve Plan
- B. Request Changes
- C. I'll edit the files

[Answer]: A. Approve Plan
