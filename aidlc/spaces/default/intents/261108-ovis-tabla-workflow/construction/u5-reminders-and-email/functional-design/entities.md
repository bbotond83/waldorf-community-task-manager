# Entities: u5-reminders-and-email

The data shape for in-app notices, email delivery, the daily run and the duty reminders that move onto it. Built from:

- `unit-of-work.md` (U5) and `unit-of-work-story-map.md` (US17.1)
- `stories.md` (AC17.1.1 to AC17.1.6) and `requirements.md` (FR17, NFR1, NFR3, NFR5, NFR10)
- `components.md` (Notifications, TimedChecks, WebApplication)
- `contract-summary.md` (C1, C2, C8, C9, C16)
- the owner's answers in `functional-design-questions.md` (Q1 to Q6)

The daily run is ADR-006 and the mail adapter is ADR-007 in `decisions.md`. Contains no names or contact details.

**Rule numbers.** The rules of this unit are `BR50.x` to `BR56.x` in `rules.md`. Comments in older database files cite `BR40.x` for the simulated reminders; those belong to an earlier piece of work.

**Today's records.** The app already has notices, reminder jobs, reminder recipients and simulated attempts, and a reminder setting per community. U5 keeps notices, jobs, recipients and the setting, and changes them as listed below. It replaces the simulated attempts with real email deliveries. Every record is invented test data (AC1.1.3), so nothing has to be carried over: simulated attempts are dropped, and a job in a simulated retry state becomes cancelled.

**Technical names.** As in U1, technical names stay: a duty is a `task` row, so the contract's target type `duty` (C8) is stored as `task`. A community is `organizations`.

## Entity Model

```yaml
entities:
  - name: Notice
    description: One in-app message for one parent about one item. Holds no name, contact or free text; the title and link are built when the list is read (BR50.4).
    owner: Notifications
    change: kind and target type become registered values (NoticeKind, NoticeTarget) instead of fixed lists
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: parentId, type: reference, required: true, references: Parent, note: id only (ADR-010) }
      - { name: kind, type: reference, required: true, references: NoticeKind }
      - { name: targetType, type: reference, required: true, references: NoticeTarget }
      - { name: targetId, type: identifier, required: true, note: id of the item; checked by the target's facts function, no foreign key (ADR-010) }
      - { name: taskId, type: reference, required: false, references: Duty, note: kept for today's duty and swap notices; empty for other targets }
      - { name: taskStartsAt, type: instant, required: false, note: kept for today's duty reminders, to show when a reminder went stale }
      - { name: reminderJobId, type: reference, required: false, references: ReminderJob, note: set only on the two duty-reminder kinds }
      - { name: onceKey, type: text, required: true, unique: true, min: 1, max: 400, note: today's dedupe key; for notice_send it is the caller's once key joined with the parent id (BR50.2) }
      - { name: readAt, type: instant, required: false, note: set once (BR50.5) }
      - { name: createdAt, type: instant, required: true }
    constraints:
      - A duty-reminder kind has a reminder job and every other kind has none.
      - The target type rota_plan has no taskId; the target types task and change_request have one.
    relationships:
      - { to: Parent, cardinality: many-to-one, direction: Notice to Parent }
      - { to: NoticeKind, cardinality: many-to-one, direction: Notice to NoticeKind }
      - { to: NoticeTarget, cardinality: many-to-one, direction: Notice to NoticeTarget }
      - { to: EmailDelivery, cardinality: one-to-one, direction: EmailDelivery to Notice, note: optional; only notices sent through notice_send have one }

  - name: NoticeKind
    description: A registered kind of notice with the Hungarian title prefix shown before the item name. Each unit's migration adds the kinds it needs; U5's functions are not edited for it (C8 new_values).
    owner: Notifications
    change: new
    attributes:
      - { name: kind, type: text, required: true, unique: true, constraints: [lower snake case], max: 60 }
      - { name: titlePrefix, type: text, required: true, min: 1, max: 80, note: Hungarian, for example "Holnap:" }
      - { name: addedBy, type: text, required: true, note: the unit that added it, for example U5 }
    constraints:
      - The prefix names no person and no family (BR55.2).
    relationships:
      - { to: Notice, cardinality: one-to-many, direction: Notice to NoticeKind }

  - name: NoticeTarget
    description: A registered kind of item a notice can concern, with the facts function that describes it. Each unit's migration adds its own target type and facts function (C8 new_values).
    owner: Notifications
    change: new
    attributes:
      - { name: targetType, type: text, required: true, unique: true, allowed_now: [task, change_request, rota_plan], later: [todo_task, recurring_duty, event, book] }
      - { name: factsFunction, type: text, required: true, note: name of a database function taking the item id and the reading parent's id and returning the item's name, its date or none, and the path of its page (BR50.4) }
      - { name: addedBy, type: text, required: true }
    relationships:
      - { to: Notice, cardinality: one-to-many, direction: Notice to NoticeTarget }

  - name: EmailDelivery
    description: The email copy of one notice for its one parent. Holds no address and no message text (ADR-007); the address is looked up when the email is sent (BR51.2).
    owner: Notifications
    change: new; replaces the simulated job-level attempt state
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: noticeId, type: reference, required: true, unique: true, references: Notice }
      - { name: parentId, type: reference, required: true, references: Parent, note: id only }
      - { name: status, type: enum, required: true, allowed: [queued, sending, retry_wait, sent, failed, cancelled], default: queued }
      - { name: round, type: integer, required: true, min: 1, default: 1, note: rises by one when a super admin tries again (BR54.3) }
      - { name: attemptsInRound, type: integer, required: true, min: 0, max: 3, default: 0 }
      - { name: nextAttemptAt, type: instant, required: true, note: when the next try may start }
      - { name: claimedAt, type: instant, required: false, note: set while status is sending }
      - { name: lastAttemptAt, type: instant, required: false }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
      - { name: createdAt, type: instant, required: true }
    constraints:
      - Status sending has claimedAt; every other status has none.
      - Status failed has attemptsInRound equal to 3.
    relationships:
      - { to: Notice, cardinality: one-to-one, direction: EmailDelivery to Notice }
      - { to: EmailAttempt, cardinality: one-to-many, direction: EmailAttempt to EmailDelivery }

  - name: EmailAttempt
    description: One try to send one email. Replaces today's simulated reminder attempt. Holds no address, message text or server reply.
    owner: Notifications
    change: new; today's simulated attempt record is dropped
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: deliveryId, type: reference, required: true, references: EmailDelivery }
      - { name: round, type: integer, required: true, min: 1 }
      - { name: attemptNumber, type: integer, required: true, min: 1, max: 3 }
      - { name: outcome, type: enum, required: true, allowed: [sent, failed] }
      - { name: reasonCode, type: enum, required: false, allowed: [mail_unavailable, mail_rejected, claim_expired], note: set only on failed }
      - { name: occurredAt, type: instant, required: true }
    constraints:
      - deliveryId, round and attemptNumber together are unique, so a round can never hold more than 3 tries (BR51.3).
    relationships:
      - { to: EmailDelivery, cardinality: many-to-one, direction: EmailAttempt to EmailDelivery }

  - name: ReminderJob
    description: A planned week-ahead or day-before reminder for one duty with a start time. It serves all recipient families of the duty.
    owner: Notifications
    change: dueOn replaces scheduledFor; the simulated delivery states and the attempt count are removed, because delivery now lives on EmailDelivery
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: taskId, type: reference, required: true, references: Duty }
      - { name: threshold, type: enum, required: true, allowed: [7d, 24h], note: 7d is the week-ahead reminder, 24h the day-before reminder }
      - { name: taskStartsAt, type: instant, required: true, note: the start the job was planned for }
      - { name: dueOn, type: date, required: true, note: Budapest calendar date (BR53.2) }
      - { name: status, type: enum, required: true, allowed: [queued, sent, stale, cancelled, skipped], default: queued }
      - { name: correlationId, type: text, required: true, note: unchanged; shows no person }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - One live job per duty and threshold while it is not stale, cancelled or skipped (unchanged).
    relationships:
      - { to: ReminderRecipient, cardinality: one-to-many, direction: ReminderRecipient to ReminderJob }
      - { to: Notice, cardinality: one-to-many, direction: Notice to ReminderJob }

  - name: ReminderRecipient
    description: A family a reminder job is for. Unchanged in shape.
    owner: Notifications
    change: none
    attributes:
      - { name: familyId, type: reference, required: true, references: Family }
      - { name: status, type: enum, required: true, allowed: [active, removed] }

  - name: ReminderSetting
    description: The community's reminder switch and recipient scope, set on today's settings screen. Unchanged.
    owner: Community
    change: none

  - name: TimedCheck
    description: One registered check of the daily run (C9 registry). Each unit's migration inserts its own row; U5's run function is not edited for it.
    owner: Notifications
    change: new
    attributes:
      - { name: checkName, type: text, required: true, unique: true, max: 80 }
      - { name: functionName, type: text, required: true, note: the check's database function, taking the run's moment and returning how many items it created and skipped }
      - { name: runKind, type: enum, required: true, allowed: [daily, friday_noon] }
      - { name: isActive, type: boolean, required: true, default: true }
      - { name: addedBy, type: text, required: true }
    relationships:
      - { to: TimedCheckRun, cardinality: one-to-many, direction: TimedCheckRun to TimedCheck }

  - name: TimedRun
    description: One execution of the daily run or the Friday-noon run.
    owner: Notifications
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: runKind, type: enum, required: true, allowed: [daily, friday_noon] }
      - { name: runAt, type: instant, required: true, note: the moment every check of this run is given (BR52.3) }
      - { name: startedAt, type: instant, required: true }
      - { name: finishedAt, type: instant, required: false }
    relationships:
      - { to: TimedCheckRun, cardinality: one-to-many, direction: TimedCheckRun to TimedRun }

  - name: TimedCheckRun
    description: The record of one check within one run (C9 timed_check_runs). Shown to super admins when it did not succeed.
    owner: Notifications
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: runId, type: reference, required: true, references: TimedRun }
      - { name: checkName, type: text, required: true }
      - { name: runKind, type: enum, required: true, allowed: [daily, friday_noon] }
      - { name: startedAt, type: instant, required: true }
      - { name: outcome, type: enum, required: true, allowed: [success, failed, missing] }
      - { name: created, type: integer, required: true, min: 0, default: 0 }
      - { name: skipped, type: integer, required: true, min: 0, default: 0 }
      - { name: errorCode, type: text, required: false, max: 10, note: the database error code only, never the error text, so no data from a row can leak into it }
    constraints:
      - runId and checkName together are unique.
    relationships:
      - { to: TimedRun, cardinality: many-to-one, direction: TimedCheckRun to TimedRun }
```

## Summary

- **Notice** stays the one in-app message per parent. What changes is that its kinds and item types are registered values, so later units add their own kinds and item types without editing U5's functions.
- **NoticeKind** and **NoticeTarget** are the two registries. A kind gives the Hungarian title prefix. A target type names the function that describes the item: its name, its date and the path of its page.
- **EmailDelivery** and **EmailAttempt** hold the email side of a notice: its status, up to 3 tries per round, and when the next try may start. Neither holds an address or message text.
- **ReminderJob** keeps planning the week-ahead and day-before duty reminders, now by Budapest calendar date. Its simulated delivery states are gone.
- **TimedCheck**, **TimedRun** and **TimedCheckRun** are the daily-run registry and its records.
- **ReminderRecipient** and **ReminderSetting** are unchanged.
