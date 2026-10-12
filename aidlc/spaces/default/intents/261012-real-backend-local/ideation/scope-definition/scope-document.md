# Scope Document: Real backend, real sign-in and real seed data

## Purpose

Give the owner a local environment that behaves like the final, hosted application, with a real database, real sign-in and real records, so that several people can be tested interacting end to end. Source: `ideation/intent-capture/intent-statement.md` (problem, success measures, boundary).

## In Scope (first version)

1. A local database environment (containers), with the two existing migrations applied, and a repeatable seed and a reset. The seed creates several parents, families, children, groups, a group admin, a super admin and a teacher.
2. Real sign-in and real sessions for every role: several parents at once, group admin, super admin, teacher (email and password, as decided in the intent).
3. Invitation sign-up for new parents through the existing invitation link (`/meghivas/<token>`).
4. Real database adapters for the working data: groups, families, children, school years, events, tasks, assignments, swaps, cancellations and approvals.
5. Notifications and reminders records stored in the real database; their delivery stays simulated.
6. The teacher schedule on real data.
7. The Excel import on a real database adapter.
8. Removal of synthetic mode from the code. There is no switch between synthetic and real mode, and the local system is as close to the final hosted application as possible.
9. Moving the automated tests onto the local database: everything that exercises data, including most unit and component tests, runs against it.

## Out of Scope

- Real email or SMS delivery (notifications and reminders stay simulated, with real records).
- Any deployment: hosting, pipelines, a linked production project. Team rules keep deployment workflows disabled until a deployable app and a linked target project exist.
- Changing the screens or the Hungarian copy beyond what real data requires.

## Decisions That Supersede the Original Request

- The original request asked to keep synthetic mode for the automated tests and to switch by `APP_RUNTIME_MODE`. The owner decided in Scope Definition Q1 that synthetic mode can be cleared out of the code and that the local system must be as close to the final hosted application as possible; the switch is therefore not built.
- The teacher schedule and the Excel import were left out in Q2 and then included in Q7 ("included after all"); the later, explicit answer holds.

## Constraints

- Hungarian user-facing copy and English identifiers; checks green before merge; at least 80% line, branch and function coverage; accessibility; never commit secrets or real personal data.
- Real-backend checks are reported as outstanding evidence until they have been exercised against a real target.
- Docker (or another container tool) is not yet installed on the machine that will run the local environment, so installing it is a prerequisite.

## Sequencing and Dependencies

Dependency-first (Scope Definition Q3): the local environment first, then identity, then the data areas that depend on each other, then seed and reset, then the test migration and the removal of synthetic mode. No deadline is tied to any capability (Q4). The ordered proto-units and their dependencies are in `intent-backlog.md`.

## Value Stream Map

| Step | What happens | Output for the owner |
|---|---|---|
| 1 | The local environment starts (containers, database, migrations) | A real database that is running |
| 2 | The seed runs | Several parents, families, groups, admins, a teacher, events and tasks exist |
| 3 | Two parents sign in at once in two browsers | Real sessions for two different people |
| 4 | The parents interact: sign up, swap, cancel | Each sees the other's request where allowed and their own notifications |
| 5 | A group admin and the super admin work with real scoped permissions | Approvals and records only within their scope |
| 6 | The owner resets the environment | A repeatable clean start |

## Assumptions & Open Questions

- Which sign-in product and which local database tooling are used is a design decision for Requirements and Infrastructure Design; the owner named Supabase in Docker only as an example.
- How the existing invitation token flow relates to choosing a password is a design question for Requirements.
- The pipeline's need for a database service (because tests run against the local database) is decided at Infrastructure Design and Build and Test; the CI pipeline stage is not in this plan.
