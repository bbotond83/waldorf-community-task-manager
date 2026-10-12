# Scope Definition Questions: Real backend, sign-in and seed data

The intent review noted that the intent statement left out some things you asked for (the repeatable seed and reset, the switch between synthetic and real mode, keeping synthetic mode for the automated tests, the Excel import). These questions settle them here.

## Q1. Which capabilities are must-haves for the first version? (select all that apply)

A. Local database environment with the two existing migrations applied, plus a repeatable seed and a reset (several parents, families, groups, a group admin, a super admin and a teacher).
B. Real sign-in and real sessions for every role (parents several at once, group admin, super admin, teacher).
C. Real database adapters for the working data: groups, families, children, school years, events, tasks, assignments, swaps, cancellations and approvals.
D. The configuration switch (`APP_RUNTIME_MODE`) between synthetic and real mode without changing the screens, with synthetic mode kept for the automated tests.
E. None of these yet.
X. Other (please specify)

[Answer]: A, B, C, and in the owner's own words: synthetic mode can be cleared out of the code. The local dev system must be as close to the final, hosted application as possible. (D, the mode switch, is not wanted.)

## Q2. Which of these are in the first version, and which wait? (select all that are in the first version)

A. Invitation sign-up for new parents through the existing invitation link (`/meghivas/<token>`).
B. Notifications and reminders records stored in the real database (delivery stays simulated).
C. The teacher schedule on real data.
D. The Excel import on a real database adapter.
E. None of these in the first version.
X. Other (please specify)

[Answer]: A. Invitation sign-up for new parents through the existing invitation link (/meghivas/<token>). B. Notifications and reminders records stored in the real database (delivery stays simulated).

## Q3. How should the work be sequenced?

A. Risk-first: the database, sign-in and permissions first, because they carry the most unknowns; then the data areas on top.
B. Value-first: the parent task and swap flow first, so the owner can test two parents early; then admin areas.
C. Dependency-first: strictly in the order the pieces depend on each other, with no preference beyond that.
D. Not yet defined.
E. Not applicable.
X. Other (please specify)

[Answer]: C. Dependency-first: strictly in the order the pieces depend on each other, with no preference beyond that.

## Q4. Is there a deadline tied to any capability?

A. No deadline.
B. A date exists for the first usable multi-parent test; name it in your answer.
C. A date exists for something else; name it in your answer.
D. Not yet defined.
E. Not applicable.
X. Other (please specify)

[Answer]: A. No deadline.

## Q5. Is Docker (or another container tool) already installed and usable on the machine where the local environment will run?

A. Yes, Docker is installed and works.
B. No, it still has to be installed.
C. Not sure.
D. Not yet defined.
E. Not applicable.
X. Other (please specify)

[Answer]: B. No, it still has to be installed.

## Q6. If synthetic mode is removed from the code, how should the automated tests run? (follow-up to Q1)

A. Unit and component tests use test doubles written inside the tests; browser and end-to-end tests run against the local database, which is seeded and reset for them (the pipeline then needs a database service).
B. Everything that exercises data, including most unit and component tests, runs against the local database.
C. Not yet defined; decide in the requirements.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: B. Everything that exercises data, including most unit and component tests, runs against the local database.

## Q7. What happens to the screens whose real data adapter is not in the first version (the teacher schedule and the Excel import)? (follow-up to Q1 and Q2)

A. They stay in the app but are switched off, with a clear Hungarian "coming later" notice, until their real adapters exist.
B. They are removed from the app for now and come back when their adapters are built.
C. They are included in the first version after all.
D. Not yet defined.
E. Not applicable.
X. Other (please specify)

[Answer]: C. They are included in the first version after all.

## Consolidated Summary Confirmation

- Must-haves: a local database with the two existing migrations applied plus a repeatable seed and a reset; real sign-in and real sessions for every role; real database adapters for the working data (groups, families, children, school years, events, tasks, assignments, swaps, cancellations, approvals).
- Synthetic mode is not kept: it can be cleared out of the code, and the local development system must be as close to the final, hosted application as possible. There is no mode switch.
- First version also includes invitation sign-up for new parents through the existing invitation link, notifications and reminders records in the real database (delivery stays simulated), and (Q7, after all) the teacher schedule and the Excel import on real adapters. This overrides the earlier Q2 pick that left the teacher schedule and the Excel import out.
- Sequencing: dependency-first, strictly in the order the pieces depend on each other.
- No deadline is tied to any capability.
- Docker is not installed yet on the machine where the local environment will run, so installing it is a prerequisite.
- Automated tests: everything that exercises data, including most unit and component tests, runs against the local database.

Does this all look correct before I generate the artifact?

Looks correct
Request changes

[Answer]: Looks correct
