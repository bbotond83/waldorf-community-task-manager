# Business Overview

## Business Domain and Purpose

Waldorf Community Task Manager coordinates school community duties, family participation, staff schedules and administrator approvals. Hungarian user interfaces use English technical identifiers. This is one private npm application with a synthetic local runtime; live authentication, persistence, notification and deployment targets remain unverified.

## Actors and Key Functionality

- Parents view family assignments, request swaps/cancellations, read notifications, assess contribution eligibility and accept invitations.
- Staff read scoped schedules.
- Administrators manage records, tasks, approvals, archives, school years, migration previews/recovery, reminders, privacy lifecycle and settings.
- Access, directory, coordination and privacy services enforce scope, sensitive-field projection, optimistic versions, request decisions and audit boundaries.

## Current Intent and Evidence Boundary

Intent `261005-profile-login-delay` addresses the reported nearly three-minute login affecting all profiles. Five local profiles—parent, staff and three administrator variants—share the synthetic login chain described in [architecture.md](architecture.md). The goal is actual-environment reproduction, causal correction and completion within 5000 ms for every profile; none of these outcomes has been demonstrated by this scan.

The previous intent delivered isolated login regression coverage without reproducing the delay or applying a login-path correction. Its historical fast samples cannot establish behavior on the user's current server. Source inspection found no external-auth call or intentional multi-minute wait in the shared application login chain.

## Source and Coverage

Synthesized from `261005-profile-login-delay/inception/reverse-engineering/developer-scan.md`. This Full rescan replaces nine documents at Minimal depth; verified deep coverage is partial and listed in [reverse-engineering-timestamp.md](reverse-engineering-timestamp.md).
