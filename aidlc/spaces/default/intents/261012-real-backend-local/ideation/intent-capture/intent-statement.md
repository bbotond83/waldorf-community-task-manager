# Intent Statement

## Problem Statement

The app can only be tried with a fixed set of fictitious data and one fake parent, so the interaction between several people cannot be tested, and the real database rules (migrations and permissions) have never been run against the app, so their behaviour is unknown. [Q1] [desc]

Today every domain area runs on in-memory fakes, sign-in is a four-profile picker plus a parent-only entry that accepts a single identifier, the production runtime mode is a small stub with no database client, and two SQL migrations exist but nothing runs them. [desc]

## Target Customer

The owner is the first beneficiary: the owner needs to test the whole mechanism end to end as different people. [Q2] [desc]

## Success Metrics

- Several parents can be signed in as different people at the same time, and their interaction works end to end: signing up for tasks, swaps and cancellations between families, and notifications per parent. [Q3] [desc]
- A group admin and a super admin work with real scoped permissions on real records (groups, families, children, events, tasks, approvals). [Q3] [desc]
- Verification of the real database behaviour is reported as outstanding until it has been exercised against a real target. [desc] [memory:M3]

## Initiative Trigger

The synthetic mode limits what can be tested, and the owner wants to test the real mechanism. [Q4]

## Initial Scope Signal

- Workflow-selected scope: `real-backend-local`. [scope]
- Product boundary (what this first version leaves out): real email or SMS delivery and any deployment; reminders and notifications stay simulated, with their records living in the real database. [Q7]
- The local test environment runs its database on the owner's own machine, in a local container setup (for example Supabase in Docker). [Q8]
- All data areas are covered together, in the order their dependencies require. [Q9]
- Real sign-in uses email and password accounts, created by the seed and by invitation link for new parents. [Q10]
- The teacher is seeded only as a persona who can see the schedule; no other work for the teacher. [Q11]
- Deployment workflows stay disabled until a deployable application and a linked target project exist. [memory:M1]
- User-facing copy stays Hungarian and technical identifiers stay English. [memory:M2]
- Production source keeps at least 80% line, branch and function coverage, and checks must be green before merge. [memory:M4] [memory:M3]

## Assumptions & Open Questions

None.
