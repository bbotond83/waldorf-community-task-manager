# Requirements Analysis Questions

## Confirmed Context

Initial description: - feature change the avaialble user roles. We need only the following ones: - Parent - Group admin - Kindergarten teacher - Super administrator Create a new branch. Clean up the unnecessary groups from the code properly.

The feature branch is `feature/simplify-user-roles`. Exactly four available roles and replacement of Munkatárs with Óvónő are requested. Teachers need read-only visibility of tasks, owners, and task/event status. This does not authorize edits or administrative actions. Earlier answers and the completed practices interview are retained; test-after and current quality checks apply. No application changes have been made.

Sources: project-description.json via project-description utility; the user's role clarification in ../reverse-engineering/reverse-engineering-questions.md; business-overview.md, architecture.md and code-structure.md in the shared CodeKB; ../practices-discovery/team-practices.md and completed questions file. Questions below resolve remaining product choices rather than reopening these decisions.

## Q1: Meaning of Groups Cleanup

The code contains permission roles and actual kindergarten groups used to organize families/tasks. When you say unnecessary groups, what should be removed?

A. Remove obsolete permission roles and their code/fixtures; retain actual kindergarten groups and business records (recommended).
B. Also remove specific kindergarten groups or business records; specify which and how existing records should be handled.
X. Other (please specify)

[Answer]: A. Remove obsolete permission roles and their code/fixtures; retain actual kindergarten groups and business records.

## Q2: Teacher Visibility Scope

Teachers currently inherit the staff view's assigned-group restriction. Which tasks, owners and statuses should Óvónő be able to see?

A. Only their explicitly assigned kindergarten groups (recommended; preserves current scope).
B. All kindergarten groups in their kindergarten, read-only.
X. Other (please specify)

[Answer]: A. Only their explicitly assigned kindergarten groups.

## Q3: Former Kindergarten Administrators

The removed kindergarten administrator role has organization-wide administrative rights. What should happen to existing grants of that role?

A. Disable the obsolete grant and require a super administrator to assign an appropriate remaining role; do not promote automatically (recommended).
B. Convert to group admin for explicitly assigned groups; users without a group need reassignment.
C. Convert to super administrator, retaining organization-wide administration and adding governance rights.
X. Other (please specify)

[Answer]: C. Convert to super administrator, retaining organization-wide administration and adding governance rights.

## Q4: Remaining Administrative Permissions

The removed role currently handles imports, reminders, privacy operations and settings. Who should retain those operations?

A. Super administrators only; retain parent own-family rights and group admins' existing group-scoped core administration (recommended).
B. Give group admins specified additional operations within their groups; specify which.
X. Other (please specify)

[Answer]: A. Super administrators only; retain parent own-family rights and group admins' existing group-scoped core administration.

## Q5: Event Tracking Detail

The current staff view is a duty/task schedule. Does event tracking mean viewing the existing scheduled items, or do you need a new event feature?

A. Existing scheduled tasks/events: show their dates, groups, responsible owners, assignments and status read-only; no new event-management feature (recommended).
B. Add a separate event view or additional event fields; describe the events and information teachers need.
X. Other (please specify)

[Answer]: A. Existing scheduled tasks/events: show their dates, groups, responsible owners, assignments and status read-only; no new event-management feature.

## Interaction Mode

A. Guide me
B. I'll edit the file
C. Chat
X. Other (please specify)

[Answer]: Guide me
