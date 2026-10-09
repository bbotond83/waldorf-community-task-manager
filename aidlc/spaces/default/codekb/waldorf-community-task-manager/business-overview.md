# Business Overview

Static synthesis of the revalidated 2026-10-06 developer scan for `261006-simplify-user-roles`, Standard depth, branch `feature/simplify-user-roles`, observed HEAD `0dce0567f18dc72e46aa88d87e5626708b08bc7d`. Full repository breadth with partial deep coverage. No application changes, tests, builds, browser sessions, migrations or target calls were performed.

## Business Domain and Purpose

The application coordinates community participation, duties and administrative records for a Waldorf kindergarten. Hungarian browser copy serves local synthetic personas; production backend composition is not linked.

## Key Functionality

Families, parents, children, school years and kindergarten groups; capacity-aware duty signup, swaps and cancellation approvals; own-family contributions/allergen access and notifications; date-filtered staff schedules; administrative records/tasks/assignments/queues/archives; seventeen-sheet legacy import with conflict resolution and rollback; reminders, grant revocation, privacy lifecycle and settings.

## Current Users and Roles

| Concept | Domain role | Current responsibility |
| --- | --- | --- |
| Parent | `parent` | Own-family participation, requests and notifications |
| Group Administrator | `group_admin` | Granted-group core administration; application import denied |
| Kindergarten Administrator | `kindergarten_admin` | Organization administration/advanced operations; application governance denied |
| Read-only Staff | `read_only_staff` | Granted-group schedule viewing; sensitive fields and mutations denied |
| Super Administrator | `super_admin` | Organization administration and governance |

The requested future catalog contains Parent, Group admin, Kindergarten teacher and Super administrator. No teacher role exists now. Teacher permissions/home/scope and legacy-role migration or rejection require approval in requirements. [Dependencies](dependencies.md) records the current role representations.

## Groups and Business Ownership

Kindergarten groups are business entities and authorization scopes. Staff fixtures include Tölgyfa/Napraforgó groups; workgroup/finance/library/water-test labels are process owners. These are distinct from role categories. Five import archive owners currently say `kindergarten-admin`; a future owner must be chosen without losing legacy sheet coverage. “Unnecessary groups” must be clarified before deleting business entities.

## Operational and Privacy Boundaries

Family and granted-group constraints, field allowlists, immediate revocation/version checks, last-admin protection and redacted audit are existing safeguards. Domain, application and SQL policy differ. Synthetic transactions/provider behavior do not prove production durability, Supabase/RLS, scheduler/email or deployment behavior.
