## Sources

- [desc] Initial description: "Real backend, real authentication and real seed data for local development and testing of the Waldorf community task manager (Hungarian UI), on branch feature/real-backend-local. Today the app only runs in synthetic mode: every domain area uses in-memory fakes with a fixed set of fictitious data, login is a four-profile picker plus a parent-only /belepes that accepts only parent-local, and the production runtime mode is a 20-line stub with no Supabase client (src/runtime/production/composition.ts); only two SQL migrations exist in supabase/migrations (access rls and current roles) and nothing runs them. The owner needs a local environment with real data and a real workflow to test the mechanism end to end: (1) real authentication and sign-in with real sessions, so that several parents can be signed in as different people at the same time and their interaction can be tested (task sign-up, swaps and cancellations between families, notifications per parent, invitations through /meghivas/<token>); (2) real group admins and super admins with real scoped permissions as defined by the existing access model and migrations; (3) real records in a real database: groups, families, children, school years, events, tasks, assignments, approvals, notifications, reminders; (4) a repeatable local seed with several parents, families, groups, a group admin, a super admin and a teacher, plus reset; (5) the app switches between synthetic and real mode by configuration (APP_RUNTIME_MODE) without changing the screens, replacing the in-memory fakes behind the existing ports with real database adapters, keeping the synthetic mode working for the automated tests. Decide in the plan how much runs locally (for example Supabase in Docker versus a hosted project), which data layers come first, how real authentication works with invitations, and what stays out of scope (real email delivery, deployment). Team constraints: Hungarian user-facing copy, English identifiers, trunk-based short-lived branches, green checks before merge, 80% coverage, accessibility, no deployment workflows until a deployable app and a linked target project exist, never commit secrets or real personal data, real-backend checks must be exercised against a real target before being called verified. The owner asked first for the work to be scoped as an intent: produce clear requirements and design with phases, and stop for the owner decisions at the gates."
- [scope] Workflow-selected scope: `real-backend-local`.
- [memory:M1] `aidlc/spaces/default/memory/project.md#Forbidden`: "- NEVER enable executable deployment workflows before a deployable application and linked target project exist. (affirmed 2026-08-12)"
- [memory:M2] `aidlc/spaces/default/memory/project.md#Mandated`: "- ALWAYS use English technical identifiers and Hungarian user-facing copy. (affirmed 2026-08-12)"
- [memory:M3] `aidlc/spaces/default/memory/project.md#Mandated`: "- ALWAYS require green automated checks before merge. (affirmed 2026-08-12)"
- [memory:M4] `aidlc/spaces/default/memory/project.md#Mandated`: "- ALWAYS enforce at least 80% line, branch, and function coverage across all production source. (affirmed 2026-08-12)"

## Q1. What business problem should this work solve?

A. The app can only be tried with a fixed set of fictitious data and one fake parent, so the interaction between several people cannot be tested.
B. The real database rules (migrations, permissions) have never been run against the app, so their behaviour is unknown.
C. Both: no multi-person testing is possible and the real database rules are unproven.
D. Not yet defined.
E. Not applicable.
X. Other (please specify)

[Answer]: C. Both: no multi-person testing is possible and the real database rules are unproven.

## Q2. Who benefits from this work first?

A. The owner, who needs to test the whole mechanism as different people.
B. The kindergarten's group and super administrators, who will later use real data.
C. The owner now, and the kindergarten's administrators and parents later when it is used for real.
D. Not yet defined.
E. Not identified.
X. Other (please specify)

[Answer]: A. The owner, who needs to test the whole mechanism as different people.

## Q3. What does success look like for this first version?

A. Two parents signed in at the same time (for example in two browsers) can interact end to end: sign up for tasks, swap and cancel between families, and each sees only their own notifications.
B. A, and in addition a group admin and a super admin work with real scoped permissions on real records (groups, families, children, events, tasks, approvals).
C. B, and in addition one command seeds the local environment with several parents, families, groups, a group admin, a super admin and a teacher, and another resets it.
D. Not yet defined.
E. Not applicable.
X. Other (please specify)

[Answer]: B. A, and in addition a group admin and a super admin work with real scoped permissions on real records (groups, families, children, events, tasks, approvals).

## Q4. What triggered this work now?

A. The synthetic mode limits what can be tested, and the owner wants to test the real mechanism.
B. A real pilot with the kindergarten is being prepared and needs real sign-in and data.
C. Both: the testing limits and the preparation of a real pilot.
D. Not yet defined.
E. Not identified.
X. Other (please specify)

[Answer]: A. The synthetic mode limits what can be tested, and the owner wants to test the real mechanism.

## Q5. Who decides scope and priority for this work, and who influences it?

A. The owner decides alone.
B. The owner decides; the kindergarten's administrators influence what must work.
C. The owner decides; administrators, teachers and parents influence it as pilot testers.
D. Not yet defined.
E. Not identified.
X. Other (please specify)

[Answer]: A. The owner decides alone.

## Q6. How should progress be communicated while this work runs?

A. The owner reviews and approves at each approval question in this chat; nothing more is needed.
B. A, and a short written summary of decisions is kept in the work's record at each phase end.
C. Not yet defined.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. The owner reviews and approves at each approval question in this chat; nothing more is needed.

## Q7. What should this first version leave out?

A. Real email or SMS delivery and any deployment (hosting, pipelines, a linked production project).
B. A, and the Excel import workflow stays on its simulated data.
C. A, and reminders and notifications stay simulated (no real delivery), but their records live in the real database.
D. Not yet defined.
E. Nothing is left out.
X. Other (please specify)

[Answer]: C. A, and reminders and notifications stay simulated (no real delivery), but their records live in the real database.

## Consolidated Summary Confirmation

- Problem: both gaps: no multi-person testing is possible, and the real database rules are unproven.
- Primary beneficiary: the owner, who needs to test the whole mechanism as different people.
- Success: parents interact end to end, and a group admin and a super admin work with real scoped permissions on real records.
- Trigger: the synthetic mode limits what can be tested and the owner wants to test the real mechanism.
- Decision-making: the owner decides alone.
- Communication: the owner reviews and approves at each approval question in this chat.
- Left out of this first version: real email or SMS delivery and any deployment; reminders and notifications stay simulated, with their records in the real database.
- Local test environment: the database runs on the owner's own machine, in a local container setup (for example Supabase in Docker).
- Order of data areas: all areas together, in the order their dependencies require.
- Sign-in: email and password accounts, created by the seed, and by invitation link for new parents.
- Teacher: seeded only as a persona who can see the schedule; no other work for the teacher.

Does this all look correct before I generate the artifact?

Looks correct
Request changes

[Answer]: Looks correct

## Assumption Confirmation

These assumptions appear in the artifacts and are not confirmed facts:

- Whether the local environment runs the database locally (for example in Docker) or on a hosted project is not decided here; the request leaves it to the plan. [assumption]
- Which data areas come first, and how real sign-in works with invitations, are design decisions left to later stages. [assumption]
- The teacher's interest in this work is not stated; a teacher is only named as a persona to seed. [assumption]

A. Accept assumptions
B. Convert to follow-up questions

[Answer]: B. Convert to follow-up questions

## Q8. Where should the local test environment run its database?

A. On the owner's own machine, in a local container setup (for example Supabase in Docker).
B. On a hosted test project in the cloud.
C. Local first; a hosted test project may follow later.
D. Not yet defined.
E. Not applicable.
X. Other (please specify)

[Answer]: A. On the owner's own machine, in a local container setup (for example Supabase in Docker).

## Q9. Which data areas should come first?

A. Sign-in and the people first (accounts, families, parents, groups), then tasks with swaps and cancellations, then admin records and approvals.
B. Admin records (groups, families, children, events, tasks) and approvals first, then parent sign-in and interaction.
C. All areas together, in the order their dependencies require.
D. Not yet defined.
E. Not applicable.
X. Other (please specify)

[Answer]: C. All areas together, in the order their dependencies require.

## Q10. How should real sign-in work for the people in the test environment?

A. Email and password accounts, created by the seed, and by invitation link for new parents.
B. A one-time email link or code instead of a password, created by the seed and by invitation link.
C. Not yet defined; decide in the requirements.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. Email and password accounts, created by the seed, and by invitation link for new parents.

## Q11. What is the teacher's part in this first version?

A. The teacher is seeded only as a persona who can see the schedule; no other work for the teacher.
B. The teacher takes part in the testing like the other roles.
C. Not yet defined.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. The teacher is seeded only as a persona who can see the schedule; no other work for the teacher.
