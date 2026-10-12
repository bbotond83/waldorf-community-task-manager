# Requirement-to-Unit Map: Real backend, sign-in and seed data

No user stories were produced in this plan, so every row is keyed by the functional requirement (FR) from `requirements.md`. Each row names the implementing unit first; units after it carry the parts that depend on later blocks.

| ID | Requirement (short) | Implementing unit | Also touches |
|---|---|---|---|
| FR1.1 | One command starts and stops the local stack | U1 u1-local-platform-and-audit | none |
| FR1.2 | Migrations apply cleanly; first migration fixed, checksum test updated | U1 u1-local-platform-and-audit | none |
| FR1.3 | One runtime that talks to the database; no synthetic mode | U1 u1-local-platform-and-audit | U5 u5-seed-and-test-migration (removal of synthetic code) |
| FR1.4 | No secrets committed; service-role key server-only | U1 u1-local-platform-and-audit | none |
| FR1.5 | README prerequisites and commands | U5 u5-seed-and-test-migration | none |
| FR2.1 | Email and password sign-in, Hungarian errors, inactive users blocked | U2 u2-identity-and-access | none |
| FR2.2 | Real sessions, several people at once, secure cookies | U2 u2-identity-and-access | none |
| FR2.3 | Invitation by email, expiry, resend, accept and set password | U2 u2-identity-and-access | U3 u3-directory-and-coordination (link to the Parent and grants) |
| FR2.4 | Password reset by emailed link | U2 u2-identity-and-access | none |
| FR2.5 | Four roles with scopes in the database, grant-change window | U2 u2-identity-and-access | none |
| FR2.6 | Profile picker, hard-coded profiles, cookie secret, parent-local login and synthetic routes removed | U5 u5-seed-and-test-migration | U2 u2-identity-and-access (sign-in replaces them) |
| FR2.7 | Seed creates accounts with known test passwords, local only | U5 u5-seed-and-test-migration | none |
| FR2.8 | Parent flows work for any signed-in parent and family | U3 u3-directory-and-coordination | none |
| FR3.1 | Schema stores everything the app keeps | U1 u1-local-platform-and-audit | U2, U3, U4 (each unit adds its tables) |
| FR3.2 | Database-generated uuid primary keys | U1 u1-local-platform-and-audit | U2, U3, U4 |
| FR3.3 | Row-level security expresses the authorization matrix | U2 u2-identity-and-access | U3, U4 |
| FR3.4 | Contact details never readable by another parent or any non-admin | U3 u3-directory-and-coordination | U2 (policy framework) |
| FR3.5 | Audit events for role changes, approvals, imports, lifecycle | U1 u1-local-platform-and-audit | U2, U3, U4 |
| FR3.6 | Idempotency keys and versions stored | U1 u1-local-platform-and-audit | none |
| FR4.1 | Database adapters behind the existing ports | U3 u3-directory-and-coordination | U4 u4-notifications-and-import |
| FR4.2 | Same explicit result states | U1 u1-local-platform-and-audit | U2, U3, U4 |
| FR4.3 | Rules of the unused modules carried over or dropped, modules removed | U3 u3-directory-and-coordination | U4, U5 (final removal) |
| FR4.4 | Faked behaviour becomes real | U3 u3-directory-and-coordination | U4 u4-notifications-and-import |
| FR5.1 | Two parents sign up for tasks, shared capacity | U3 u3-directory-and-coordination | none |
| FR5.2 | Swap and cancellation with approval, own notifications | U3 u3-directory-and-coordination | U4 u4-notifications-and-import (notifications) |
| FR5.3 | Group admin, super admin and teacher scopes | U3 u3-directory-and-coordination | U2 (grants) |
| FR5.4 | Invited parent joins and sees own family's tasks | U3 u3-directory-and-coordination | U2 (invitation) |
| FR5.5 | Admin lists, forms, approvals, archive, settings on real records | U3 u3-directory-and-coordination | none |
| FR6.1 | Teacher schedule on real data | U3 u3-directory-and-coordination | none |
| FR7.1 | Excel upload, preview, conflicts, atomic commit | U4 u4-notifications-and-import | none |
| FR7.2 | Import tested only with a fictitious workbook | U4 u4-notifications-and-import | none |
| FR7.3 | Interrupted commit leaves data as it was | U4 u4-notifications-and-import | none |
| FR8.1 | Notification and reminder records, delivery simulated | U4 u4-notifications-and-import | none |
| FR9.1 | Seed: small set and 30-family set, fictitious | U5 u5-seed-and-test-migration | none |
| FR9.2 | Reset; repeatable seed; failed seed leaves no half state | U5 u5-seed-and-test-migration | none |
| FR9.3 | Seed and reset refuse non-local databases | U5 u5-seed-and-test-migration | none |
| FR10.1 | Synthetic code, reset endpoint, copies and scenario hooks removed; tests on the database | U5 u5-seed-and-test-migration | none |
| FR10.2 | Per-worker schema and account isolation | U1 u1-local-platform-and-audit | U5 (setup for all tests) |
| FR10.3 | CI starts the database service | U1 u1-local-platform-and-audit | none |
| FR11.1 | Workbook untracked and ignored; privacy scan | U1 u1-local-platform-and-audit | none |
| FR11.2 | History rewrite by the owner; open item reported | U5 u5-seed-and-test-migration | none |
| FR12.1 | Hungarian testing guide updated | U5 u5-seed-and-test-migration | none |

## Implementation Order Within Each Unit

- **U1** — baseline and conventions first, then stack scripts and CI, then runtime configuration, then audit, then the privacy scan and worker-schema mechanics.
- **U2** — accounts and sessions, then grants and the policy framework with its test list, then invitations and password reset, then the kernel checks and scope probe, then the screens, then the operator command.
- **U3** — Directory and Settings first, then Coordination, then the kernel use cases, then the adapters behind the ports, then the lifecycle functions and the rule-disposition ledger.
- **U4** — Notifications first, then the import staging and commit, then the library and the fictitious workbook.
- **U5** — seed and reset first, then the per-worker setup, then the test migration, then removing synthetic code, then documents and the final report.

## Coverage Verification

Every functional requirement FR1.1 to FR12.1 (42 ids) appears exactly once with an implementing unit. Rows per implementing unit: U1 12, U2 6, U3 11, U4 4, U5 9 (total 42). Every unit has rows.
