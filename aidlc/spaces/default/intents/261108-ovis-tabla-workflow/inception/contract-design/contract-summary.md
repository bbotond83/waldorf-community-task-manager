# Contract Summary

How the units in `unit-of-work.md` connect, one contract for each kind of boundary in `unit-of-work-dependency.md`. Entity shapes come from `components.md`; rules and non-functional targets come from `requirements.md`. Function names are proposed here and may be refined in Functional Design, but what crosses each boundary may not change without updating this document.

## Overview

All units live in one application and one database. Every boundary is a call to a named Postgres function inside the same database, so a whole operation succeeds or fails in one transaction. Nothing is sent over a network between units. There is **no public or external API**: the app has none today, and this work adds none. The screens call their own unit's functions through a facade; that is inside a unit and is not listed.

A consumer may only rely on a provider it reaches through `unit-of-work-dependency.md`, directly or through another unit.

## Contracts

| # | Provider Unit | Consumer | Mechanism | Owner |
|---|---|---|---|---|
| C1 | U1 | All units | Shared function convention | U1 |
| C2 | U1 | All units | Database functions (who is calling, what they may reach, admin grants) | U1 |
| C3 | U2 | U6, U8, U9, U13 | Database functions (school calendar) | U2 |
| C4 | U2 | U6, U8, U9, U10 | Internal database function (create duties and places) | U2 |
| C5 | U2 | U7, and U8's function in C19 | Internal database functions (change who holds a place) | U2 |
| C6 | U1 | U2 to U13 | Database functions (how a person or family is shown) | U1 |
| C7 | U4 | U8, U9, U10, U11, U12 | Database functions (membership and coordinators) | U4 |
| C8 | U5 | U6, U7, U8, U9, U10, U11, U12, U13 | Internal database function (send a notice or reminder) | U5 |
| C9 | U5 | U6, U7, U8, U9, U10, U11, U13 (contribute checks); External: the hosting schedule (later work) | Registry table and database function (the daily run) | U5 |
| C10 | U6 | U7, U8, U9, U10 | Database function (may this family hold a duty) | U6 |
| C11 | U6 | U7 | Internal database functions (rota rules and picks) | U6 |
| C12 | U6 | U9 | Database function (family on a rota week) | U6 |
| C13 | U10 | U11 | Database functions (event facts) | U10 |
| C14 | U9, U10, U11 | U12 | Database functions (coordinator page lists) | Each provider |
| C15 | U11 | U12 | Internal database function (add a task to a checklist) | U11 |
| C16 | U1, U2, U3, U4, U5, U6, U7, U9, U10, U11, U12, U13 | U14 | Internal database functions (preview and apply removal) | Each provider |
| C17 | U3, U12, U13 | U15 | Database functions (one-off load) | Each provider |
| C18 | U2 | U6, U8, U9, U10, U12 | Database functions (sign-up and done mark) | U2 |
| C19 | U8, inside the DutyChanges block of U7 | U8's screens | Database function (give up a slot) | U8 |
| C20 | U6 | U8, U13 | Database functions (family standing) | U6 |

## Contract Specs

### C1 Function convention

```yaml
shared-schema: function-convention
access: every new function starts with revoke all, then an explicit grant execute
callable_by_a_signed_in_user:
  command_inputs:
    p_idempotency_key: text, required
    p_expected_version: integer, required when changing an existing record
  result_envelope:
    state: success | validation | denied | conflict | invalidated | retryable | terminal
    reference: id of the affected record, or null
    code: stable refusal code, or null
  repeat_rule: a repeated key returns the stored result
  list_functions: return rows; a caller without access gets a denied refusal, never an empty list
internal_functions:
  meaning: called only from other functions and never granted to signed-in users
  idempotency: comes from the calling command
  shape: as stated in each contract
refusals: raised through U3R00 and rolled back
locks:
  order: within each step by ascending id
  steps: [family, rota week, weekend pick, change request, duty, place, checklist task, to-do task, book]
  who: every function that changes data takes its own locks in this order; a function touching two families locks both first
  naming: duty and place are the rows that team.md calls task and assignment
audit: role, consent, publishing, administrator interventions and migration runs (NFR4)
```

### C2 Caller, reach and admin grants

```yaml
shared-schema: caller-and-reach
functions:
  current_parent_id: returns uuid or null; null when the parent or grant is no longer active
  current_family_id: returns uuid or null
  has_community_admin: returns boolean; super admin
  can_manage_group(group_id): returns boolean; super admin or that group's coordinator
  can_read_community: returns boolean; every signed-in role in the community
internal_functions:
  grant_admin(parent_id, group_id): adds the working-group admin grant
  end_admin(parent_id, group_id): ends it
  rule: both run in the same transaction as the membership change; if one fails, the membership does not change
roles:
  parent: reads the community; writes for their own family and their own profile, claims and sign-ups
  kindergarten_teacher: reads the community; writes nothing; has no family
  group_admin: everything a parent may do, and manages their own working group
  super_admin: administers the whole community
  service_role: the existing Supabase service role; never available to a signed-in session; the only role granted C9's entry point and C17
rules:
  - A revoked right applies at the next request (NFR3)
  - A stale link never grants access (ADR-010)
  - A caller with no current_family_id gets the C1 denied refusal from every family-based command, including sign-up, swaps and done marks for a family's place
```

### C3 School calendar

```yaml
shared-schema: school-calendar
kind: internal
functions:
  school_year_for(date): returns school year id, or null when none
  school_weeks(year_id): returns rows of week_start, is_break; no rows for an unknown year
  changeover_date(year_id): returns date, or null for an unknown year
```

### C4 Create duties and places

```yaml
shared-schema: duty-create
function: duty_create
kind: internal
inputs:
  origin_kind: rota_week | weekend_slot | animal_slot | recurring_occurrence | event_task
  origin_id: uuid
  title: text
  category: text
  starts_at: timestamptz
  ends_at: timestamptz
  working_group_id: uuid or null
  place_holders: array with one entry per place; a family id, or null for an open place
  source: rota_publish | slot_generated | recurring | event_task | a value of the place source list
returns: { duty_id: uuid, place_ids: uuid array in place_holders order }
capacity: the length of place_holders
idempotency: exempt from a key; the same origin_kind and origin_id returns the existing duty and places
caller_rule: the caller checks eligibility before naming a family (C10 once U6 exists)
new_values: origin_kind and source are extended by the unit that needs one
```

Rota publishing passes the family; animal-care slots and event tasks pass null.

### C5 Change who holds a place

```yaml
shared-schema: place-holder-change
kind: internal
called_from: functions in the DutyChanges block only
functions:
  place_exchange(place_a, version_a, place_b, version_b): swaps the two families
  place_reassign(place, version, family): gives the place to another family
  place_release(place, version): frees the place
returns: the C1 envelope
refusal_codes: [VERSION_CONFLICT, DUTY_CLOSED]
rule: a duty that has passed cannot change
```

### C6 How a person or family is shown

```yaml
shared-schema: display-name
kind: internal
functions:
  parent_display_name(parent_id): returns the full name, or "korábbi tag" when the parent is removed
  family_display_name(family_id): returns the family name, or "korábbi tag" when the family is anonymised
rules:
  - Returns names only; contact details come only from U3's directory reads (ADR-008)
  - Never returns a child's name (FR5.6)
  - U14 sets the status these functions read
```

### C7 Membership and coordinators

```yaml
shared-schema: working-group-facts
kind: internal
functions:
  group_members(group_id): returns parent ids of active members
  group_coordinators(group_id): returns parent ids of active coordinators
uses: C2 grant_admin and end_admin
screens: read members through U4's own list function, which applies the directory rules (ADR-008)
```

### C8 Send a notice or reminder

```yaml
shared-schema: notice-send
function: notice_send
kind: internal
inputs:
  recipient_parent_ids: uuid array
  kind: a value of the notice kind list
  target_type: duty | change_request | todo_task | recurring_duty | event | book
  target_id: uuid
  once_key: text; the same key never sends twice to the same parent
returns: number of notices created
delivery: an in-app notice now, and an email through the job queue
failure:
  email: at most 3 tries, 15 minutes apart; the in-app notice remains; failure shown to the administrator
  caller: a failed email never fails the caller's transaction
content: no other family's contact details (NFR10)
new_values: kind and target_type are extended by the unit that needs a new value
```

U2 uses today's notice function until U6 moves its publishing notice onto `notice_send`.

### C9 The daily run

```yaml
shared-schema: timed-checks
provider: U5 owns the run and the registry, and is complete with no checks registered
registry:
  table: timed_check_registry
  columns: [check_name, function_name, run_kind, is_active]
  run_kind: daily | friday_noon
  added_by: each contributing unit's own migration inserts its row; U5's function is not edited
entry_point:
  name: timed_checks_run_system(run_kind)
  callable_by: service_role only (ADR-006)
  triggered_by: a local command now; a real schedule in the hosting work
  time_zone: Europe/Budapest
each_check:
  signature: <feature>_due_check(now timestamptz)
  returns: { created: integer, skipped: integer }
  rule: safe to run twice on the same day
failure:
  a_failing_check: recorded, and the others still run
  a_registered_function_that_is_missing: recorded as failed, and the others still run
  record:
    table: timed_check_runs
    columns: [check_name, run_kind, started_at, outcome, created, skipped]
    visible_to: super admins, on the same screen as failed emails (C8)
checks: [weekend picks reminder, weekend picks alert (friday_noon), swap expiry, empty slots, fair share, recurring occurrences, event notices, unclaimed tasks, books held by leaving families]
```

### C10 May this family hold a duty

```yaml
shared-schema: duty-eligibility
kind: internal
function: family_may_hold_duty(family_id, on_date)
returns: { allowed: boolean, code: text or null }
refusal_code: DUTY_INELIGIBLE
used_by: planning, assignment, sign-up and swaps (FR4.4)
read_only: true
```

### C11 Rota rules and picks

```yaml
shared-schema: rota-change-rules
kind: internal
called_from: functions in the DutyChanges block only, in the same transaction as the change
functions:
  rota_check_change(changes):
    changes: array of { place_id, new_family_id }
    returns: { allowed: boolean, code: text or null }
    refusal_code: ROTA_SAME_WEEK_CLASH
  rota_adjust_picks_after_change(changes):
    effect: moves the pick when the slot is still valid, otherwise asks the new family to pick
    returns: number of picks reopened
order: check before the change, adjust after it (ADR-011)
```

### C12 Family on a rota week

```yaml
shared-schema: rota-week-family
kind: internal
function: rota_family_for(job, week_start)
returns: family id, or null when no published week exists
consumer_rule: null means no occurrence is created for that week
```

### C13 Event facts

```yaml
shared-schema: event-facts
kind: internal
functions:
  event_is_summer(event_id): returns boolean, or null for an unknown event
  event_deadline(event_id): returns date or null
  event_organisers(event_id):
    returns: parent ids; the coordinators of the event's working group, or the super admins for a community event
    extension: the organiser list may grow in U10's Functional Design (see Open Questions)
```

### C14 Coordinator page lists

```yaml
shared-schema: group-work-lists
functions:
  recurring_list(group_id): provided by U9
  event_list(group_id): provided by U10
  template_list(group_id): provided by U11
returns: rows of id, title, status
access: can_manage_group(group_id); otherwise the C1 denied refusal
```

### C15 Add a task to a checklist

```yaml
shared-schema: checklist-add-task
provider_function:
  name: checklist_add_task(event_id, task_fields, source_ref)
  kind: internal, provided by U11
  inputs:
    task_fields: section, title, place, props, priority, materials
    source_ref: text or null; lets a repeat of the same source return the existing task
  returns: checklist task id
  rule: knows nothing about to-do tasks
consumer_function:
  name: todo_pull_to_event(event_id, todo_ids, p_idempotency_key)
  kind: signed-in command, provided by U12
  effect: selects the tasks, calls checklist_add_task for each, carries over an existing claim, and adds a history row naming the event
  original_task: stays on the to-do list with its status unchanged (AC14.3.1)
  access: can_manage_group for the event's group, or a super admin
  returns: the C1 envelope
```

### C16 Preview and apply removal

```yaml
shared-schema: removal
kind: internal
called_from: Lifecycle functions only
each_provider:
  <block>_removal_preview(subject_kind, subject_id): returns { to_clear: integer, to_flag: integer }
  <block>_removal_apply(subject_kind, subject_id): clears or flags, returns the same counts
  subject_kind: parent | family
  rule: a block returns zero counts for a subject kind it does not hold
providers:
  U1: ends a removed parent's sign-in and clears the account link
  U2: clears Place doneBy; flags or frees a family's future places
  U3: directory record, profile and sharing choice
  U4: memberships and coordinator role
  U5: notices and reminder recipients
  U6: flags future RotaWeek and WeekendPick rows; past rows stay and show through C6
  U7: ends pending swaps; clears the requester and decidedBy on decided requests
  U9: flags family-owned schedules
  U10: anonymises food offers and sign-ups; clears EventRole.personName where it exactly matches the removed person's name; the removal screen also lists other typed names on event roles for a super admin, who can clear any that refer to this person with event_role_clear_name(role_id, p_expected_version, p_idempotency_key), a signed-in command returning the C1 envelope
  U11: clears claimedBy and doneBy on checklist tasks
  U12: clears claimedBy, doneBy and changedBy; flags claimed open tasks and family-owned tasks
  U13: flags held books; removes return watches
needs_no_function:
  U8: SlotCalendar holds no person; slots are places, covered by U2
  U15: holds no records
display_after: "korábbi tag", through C6
audit: every apply is recorded; the audit log's actor id is never rewritten
order:
  - Preview first, then apply, in one transaction
  - U14 locks the family row first, also when removing one parent
  - Apply runs in the C1 lock order, so blocks run as U6, U7, U2, U11, U12, U13, then U10, U9, U5, U4, U3 and last U1
  - The rows changed by U10, U9, U5, U4, U3 and U1 during removal are never locked by another block, so they need no C1 step; within a block, each kind of row is locked by ascending id
```

### C17 One-off load

```yaml
shared-schema: migration-load
functions:
  migration_load_family: provided by U3
  migration_load_todo: provided by U12
  migration_load_book: provided by U13
callable_by: service_role only
inputs:
  source_key: text; stable key from the row, so a second run creates no duplicates
  payload: json
returns: the C1 envelope, with no cell values
failure: a bad row returns a refusal; the script reports its position and carries on
```

### C18 Sign-up and done mark

```yaml
shared-schema: place-signup-and-done
functions:
  duty_sign_up:
    provided_by: U2, keeping the existing function
    kind: signed-in command
    inputs: [duty_id, p_expected_version, p_idempotency_key]
    effect: fills one open place with the caller's family
    refusal_codes: [DUTY_VERSION_STALE, DUTY_CLOSED, DUTY_ALREADY_ASSIGNED, DUTY_INELIGIBLE, DUTY_FULL]
    eligibility: U6 adds the C10 check
  place_mark_done:
    provided_by: U2, in the Duties block; U9 delivers the story (US9.2) on top of it
    kind: signed-in command
    inputs: [place_id, p_expected_version, p_idempotency_key]
    effect: records who and when
    refusal_codes: [VERSION_CONFLICT, DUTY_CLOSED]
    access: a parent of the holding family, or a coordinator of the owning group
returns: the C1 envelope
```

### C19 Give up a slot

```yaml
shared-schema: slot-give-up
function: slot_give_up(place_id, p_expected_version, p_idempotency_key)
kind: signed-in command
delivered_by: U8, as a function in the DutyChanges block (ADR-012)
rests_on: U7's DutyChanges block and C5 place_release
access: a parent of the holding family only
rules:
  only_slots: refused unless the place's duty has origin_kind animal_slot; every other duty is cancelled only by an administrator's decision (A6)
  cutoff: refused from 24 hours before the slot starts, enforced in this function
  pending_swap: refused while the place is in a pending swap
returns: the C1 envelope
refusal_codes: [SLOT_NOT_RELEASABLE, SLOT_GIVE_UP_TOO_LATE, REQUEST_CONFLICT, VERSION_CONFLICT, DUTY_CLOSED]
```

### C20 Family standing

```yaml
shared-schema: family-standing
kind: internal
functions:
  family_standing(family_id, year_id):
    returns: { standing: staying | leaving | new, active_weeks: integer }, or null when the family has no row for that year
  families_with_standing(year_id, standing): returns family ids
active_weeks: computed, not stored; counts the rows of C3 school_weeks, all of them for staying, those before changeover_date for leaving, those from changeover_date for new
read_only: true
used_by:
  U8: fair share in proportion to active weeks (AC7.2.1)
  U13: reminder to leaving families holding a book (AC16.3.2), with C3 changeover_date
```

## Contract Ownership Rules

- The unit that delivers a function owns its contract. Units named in the Consumer column may rely on nothing beyond what is written here.
- There is one repository, so a breaking change updates the provider, every caller and this document in the same pull request.
- Database changes are new forward-only migration files. A migration that has been applied is never edited (`team.md`).
- Additive changes stay safe: callers ignore fields they do not know, and new list values are added by the unit that needs them.
- Every contract's database rules get the fixed test list. Where a case has no meaning for a rule, the test plan records why.

## Open Questions

| Contract | Question | Blocks |
|---|---|---|
| C16 | What is the requester field on a swap request called, and can a super admin with no parent record be `decidedBy`? | U7, U14 |
| C16 | What happens when the removed person is a family's only parent or a group's only coordinator? | U14 |
| C5 | Which existing swap function names are kept when they move into the DutyChanges block? | U7 |
| C13 | Besides coordinators and super admins, can an event name other organisers, and in which record? | U10 |
| C15 | When a pulled task is marked done on the checklist, does its to-do task also become done? | U12 |
| C8 | Which notice kinds does each unit add? Settled unit by unit in Functional Design | U5 to U13 |
| C17 | How does the invented workbook stay faithful to the real layout without personal data? | U15 |
| C1 | How is a fixed-list test case with no meaning for a rule recorded? | U1 |
