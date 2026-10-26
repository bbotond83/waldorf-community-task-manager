# Integration Test Instructions: Local password hint

The Minimal strategy generates no extra integration suite. The guard is used by the seed and reset commands, whose real-stack tests must stay green: `npm run test:database:seed` (57 tests). Those tests use the default password, so they exercise the accepted path; the refused path is covered by the unit test.
