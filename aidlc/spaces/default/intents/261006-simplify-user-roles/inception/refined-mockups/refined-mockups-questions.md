# Refined Mockups Questions

## Established Context and Design Basis

Four personas and eight workflow stories are approved. The Kindergarten teacher uses assigned-group, read-only tracking of existing scheduled tasks/events with dates, owners, assignments and status; no separate event feature or new administrative permission is needed. Former kindergarten administrators become super administrators. Business groups and records remain intact.

The classic scope has no rough-mockup inputs. Design directly from [stories.md](../user-stories/stories.md), [requirements.md](../requirements-analysis/requirements.md) and [team-practices.md](../practices-discovery/team-practices.md); do not invent missing wireframes or user flows.

Bounded current UI inspection: ProfileSelector uses role/profile cards; ScheduleCollection uses a desktop table and mobile cards; existing schedule detail uses labeled definition lists; filters use native group/date fields; StaffStatePanel distinguishes empty, validation, denied, invalidated and dependency failure. app/globals.css defines warm neutral colors, rounded surfaces, visible focus and a 44rem table-to-card breakpoint. Current schedule projection does not yet display all approved owner/assignment/status fields: these will be specified as required additions, not claimed as existing.

Preserve keyboard access, Hungarian copy, explicit read-only/denied/empty/recovery states and existing critical-flow accessibility checks. These are already approved requirements, not reopened choices. Technical route naming remains downstream design work; no new migration-management screen is implied.

## Q1: Visual Approach

The schedule already has desktop tables and mobile cards. Which visual approach should the role change use?

A. Reuse the existing layout and style; rename Munkatárs to Óvónő, show owner/assignment/status fields, and update the role catalog and access states (recommended).
B. Change the schedule's visual presentation; describe the preferred layout while retaining approved permissions and existing-feature scope.
X. Other (please specify)

[Answer]: A. Reuse the existing layout and style. Use Kindergarten teacher as the English role name in development artifacts, consistent with the other profiles; retain Óvónő in Hungarian UI copy.

## Interaction Mode

A. Guide me
B. I'll edit the file
C. Chat
X. Other (please specify)

[Answer]: Guide me

## Role Naming Clarification

Verbatim response:

> 1. But please use the english translation of Óvóná in the developemtn artifacts just as for other profiles.

The development role/persona name is Kindergarten teacher. Technical identifiers use English. Hungarian UI examples retain the previously requested Óvónő label. Earlier verbatim input and historical records remain preserved as their original evidence.
