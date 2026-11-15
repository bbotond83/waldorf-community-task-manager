# Business Rules: u5-reminders-and-email

The rules for notices, email delivery, the daily run, the duty reminders, the administrator's view of failures, email content and removal. The entities they refer to are in `entities.md`. Sources:

- `unit-of-work.md` (U5) and `unit-of-work-story-map.md`
- `requirements.md` (FR17, NFR1, NFR3, NFR5, NFR10) and `stories.md` (US17.1)
- `contract-summary.md` (C1, C2, C8, C9, C16) and `components.md`
- `decisions.md` (ADR-006, ADR-007)
- the owner's answers in `functional-design-questions.md` (Q1 to Q6)

Contains no names or contact details.

## Rules

```yaml
rules:
  # BR50 Notices
  - id: BR50.1
    statement: notice_send creates one in-app notice for each named parent who is active and has an account.
    category: policy
    applies_to: [Notice]
    trigger: a feature function calls notice_send (C8)
    logic: IF a named parent is active, belongs to the caller's community and is linked to an active account THEN one notice is created for them. A parent without an account, an archived parent or a parent of another community gets nothing and is not counted. The function returns how many notices it created.
    violation: Not applicable; such parents are skipped, never refused.
    source: FR17.1, AC17.1.1, owner answer Q4 (A)
  - id: BR50.2
    statement: The same once key never sends twice to the same parent.
    category: constraint
    applies_to: [Notice, EmailDelivery]
    trigger: notice_send, or a daily-run check that calls it
    logic: IF a notice with the same once key already exists for the parent THEN nothing is created for that parent, neither a notice nor an email, and that parent is not counted. This holds when the call is repeated, when two runs overlap and when the same check runs twice on one day.
    violation: Not applicable; the repeat creates nothing.
    source: AC17.1.3, NFR5, C8 once_key
  - id: BR50.3
    statement: A notice's kind and item type must be registered.
    category: validation
    applies_to: [Notice, NoticeKind, NoticeTarget]
    trigger: notice_send is called
    logic: IF the kind is not a registered NoticeKind, or the target type is not a registered NoticeTarget, or the recipient list or target id is empty THEN the call is refused and the caller's transaction is rolled back. This is a programming error in the calling unit, not a delivery failure.
    violation: Refusal NOTICE_KIND_UNKNOWN, NOTICE_TARGET_UNKNOWN or NOTICE_REQUEST_INVALID, raised through U3R00.
    source: C8 new_values, C1 refusals
  - id: BR50.4
    statement: A notice's title and link are built when it is read, from its kind and its item.
    category: calculation
    applies_to: [Notice, NoticeKind, NoticeTarget]
    trigger: the parent's notice list, or an email being prepared
    logic: The title is the kind's prefix followed by the item name, unless the target type's facts function also returns a full title, which then replaces both (used for state-dependent titles such as swap decisions and for notices with no item name, such as rota_published). The item name, the item's date, the path of its page and the optional full title come from the facts function, given the item id and the reading parent. IF the item no longer exists THEN the title is the prefix followed by "Törölt tétel" and there is no link. Every facts function returns only the item's own name, date and path, and never names another person or family.
    violation: Not applicable.
    source: AC17.1.6, FR17.4, NFR10, owner answer Q6 (A)
  - id: BR50.5
    statement: A notice is marked read once, and only by its own parent.
    category: authorization
    applies_to: [Notice]
    trigger: the parent opens a notice
    logic: Unchanged from today. Only the notice's own parent reads it or marks it read. A repeat keeps the first time. Another parent's notice, or a missing one, gives the same denied result.
    violation: Denied refusal authorization_denied.
    source: NFR3
  - id: BR50.6
    statement: Every notice sent through notice_send also gets one email.
    category: policy
    applies_to: [Notice, EmailDelivery]
    trigger: notice_send creates a notice
    logic: IF notice_send creates a notice THEN it creates one queued EmailDelivery for it, due at once. Notices that today's actions write directly (sign-up confirmed, place removed, swap and cancellation decisions, rota published) stay in-app only until U6 and U7 move them onto notice_send.
    violation: Not applicable.
    source: FR17.1, C8 delivery, owner answer Q2 (A)
  - id: BR50.7
    statement: Sending a notice never fails because of email.
    category: policy
    applies_to: [Notice, EmailDelivery]
    trigger: notice_send
    logic: notice_send only queues the email inside the caller's transaction. Nothing in the caller's transaction contacts the mail server, so a mail failure can never undo the caller's change or the in-app notice.
    violation: Not applicable.
    source: C8 failure.caller, AC17.1.2

  # BR51 Email delivery
  - id: BR51.1
    statement: A delivery pass takes each due email once, even when two passes run at the same time.
    category: constraint
    applies_to: [EmailDelivery]
    trigger: a delivery pass asks for due emails
    logic: IF an EmailDelivery is queued or retry_wait and its next try is due THEN the pass claims it, sets it to sending and counts the try. A claim skips rows another pass holds, so it never waits and never takes a row twice. A pass claims at most 50 emails, oldest first, in batches of 10, each send timing out after 30 seconds, and starts no new batch after 2 minutes; emails not claimed stay queued and count no try.
    violation: Not applicable.
    source: NFR5, AC17.1.3
  - id: BR51.2
    statement: The address is looked up only when the email is sent, and never stored.
    category: policy
    applies_to: [EmailDelivery, EmailAttempt]
    trigger: a delivery is claimed
    logic: The claim returns the parent's current sign-in email for that send only. IF the parent is no longer active or no longer has an account THEN the delivery is cancelled and no address is returned; the in-app notice stays. No record keeps the address, the message text or the mail server's reply.
    violation: Not applicable.
    source: ADR-007, NFR1, owner answer Q4 (A)
  - id: BR51.3
    statement: A failed email is tried at most 3 times per round, 15 minutes apart, and then shown to the administrator.
    category: policy
    applies_to: [EmailDelivery, EmailAttempt]
    trigger: a try's outcome is recorded
    logic: IF the email was sent THEN the delivery becomes sent. IF it failed and fewer than 3 tries were made in this round THEN it becomes retry_wait, due 15 minutes after this try. IF the third try of the round failed THEN it becomes failed and appears on the super admin's delivery-problems screen.
    violation: Not applicable.
    source: AC17.1.2, C8 failure.email, owner answer Q3 (A)
  - id: BR51.4
    statement: A try that was claimed but never recorded counts as failed after 10 minutes.
    category: policy
    applies_to: [EmailDelivery, EmailAttempt]
    trigger: a delivery pass starts
    logic: IF a delivery has been sending for more than 10 minutes, for example because the command stopped, THEN the pass first records that try as failed with the reason claim_expired and applies BR51.3. Such an email may in rare cases arrive twice; it is never lost silently.
    violation: Not applicable.
    source: AC17.1.2, AC17.1.3
  - id: BR51.5
    statement: Recording a try's outcome twice changes nothing.
    category: constraint
    applies_to: [EmailDelivery, EmailAttempt]
    trigger: an outcome is recorded
    logic: IF the delivery is not sending, or the round and try number given do not match the claimed try THEN the record is ignored and the current status is returned.
    violation: Not applicable.
    source: NFR5
  - id: BR51.6
    statement: The in-app notice remains whatever happens to the email.
    category: policy
    applies_to: [Notice, EmailDelivery]
    trigger: any email outcome
    logic: Sent, failed and cancelled emails leave the notice in the parent's list unchanged.
    violation: Not applicable.
    source: AC17.1.2
  - id: BR51.7
    statement: Only the server's own service access may claim emails and record their outcome.
    category: authorization
    applies_to: [EmailDelivery]
    trigger: a claim or a record call
    logic: IF the caller is not the service role THEN the call is denied. Signed-in users, including super admins, cannot claim or record.
    violation: Denied refusal authorization_denied.
    source: ADR-006 security, C2 service_role

  # BR52 The daily run
  - id: BR52.1
    statement: Only the server's own service access may start the daily run.
    category: authorization
    applies_to: [TimedRun]
    trigger: timed_checks_run_system is called
    logic: IF the caller is not the service role THEN the call is denied and nothing runs. No screen and no signed-in role can start it.
    violation: Denied refusal authorization_denied.
    source: ADR-006, C9 entry_point.callable_by
  - id: BR52.2
    statement: The run calls every active check of its run kind, and one failing check never stops the others.
    category: policy
    applies_to: [TimedRun, TimedCheck, TimedCheckRun]
    trigger: a run starts
    logic: The run calls each active TimedCheck of the run kind in `lock_step` order, then check-name order, each on its own so that a failure undoes only that check's changes. IF a check raises an error THEN its record is failed with the database error code. IF its function does not exist THEN its record is missing. The run then goes on with the next check.
    violation: Not applicable; the failure is recorded.
    source: C9 failure, FR17.3
  - id: BR52.3
    statement: Every check of one run is given the same moment.
    category: calculation
    applies_to: [TimedRun, TimedCheckRun]
    trigger: a run starts
    logic: The run fixes its moment at the start and passes it to every check, so all checks agree on "today". Today is the calendar date in Europe/Budapest. The run may be given an earlier or later moment only by the service role, for tests and for catching up.
    violation: Not applicable.
    source: C9 time_zone, ADR-006
  - id: BR52.4
    statement: There are two run kinds, daily and Friday noon.
    category: constraint
    applies_to: [TimedRun, TimedCheck]
    trigger: a run is started
    logic: The run kind is daily or friday_noon; any other value is refused. The run does not check the weekday or the hour. The hosting schedule starts daily at 07:00 and friday_noon at 12:00 on Fridays, Budapest time. Locally the owner starts either one with a command.
    violation: Validation refusal run_kind_invalid.
    source: ADR-006, C9 run_kind
  - id: BR52.5
    statement: Running the same run twice on one day sends nothing twice.
    category: constraint
    applies_to: [TimedRun, TimedCheck]
    trigger: a second run of the same kind on the same Budapest date
    logic: Each run is recorded. Every check decides what is due from its own records and sends through notice_send with once keys, so a second run creates nothing that was already created.
    violation: Not applicable.
    source: C9 each_check.rule, AC17.1.3
  - id: BR52.6
    statement: Emails are sent by a short delivery pass every 15 minutes and right after each run.
    category: policy
    applies_to: [EmailDelivery]
    trigger: the command, with the run kind daily or friday_noon, or with deliver
    logic: The command with daily or friday_noon runs the checks, then one delivery pass. The command with deliver runs only the delivery pass. The hosting schedule runs deliver every 15 minutes. Locally the owner runs it on request.
    violation: Not applicable.
    source: owner answer Q3 (A), AC17.1.2, FR17.3
  - id: BR52.7
    statement: What is due is sent even when nobody has signed in.
    category: policy
    applies_to: [TimedRun, ReminderJob, Notice]
    trigger: a run
    logic: Nothing in a run or a delivery pass depends on a sign-in or a page being opened. A run that was missed sends what is due at the next run.
    violation: Not applicable.
    source: FR17.3, AC17.1.5

  # BR52.8 housekeeping
  - id: BR52.8
    statement: A registered check named housekeeping prunes old records.
    category: policy
    applies_to: [TimedCheck, EmailDelivery, EmailAttempt, TimedCheckRun]
    trigger: the daily run
    logic: The check deletes email deliveries and their tries 90 days after they finish, and run and check records 30 days after the run. No check relies on those records to decide what is due; once keys and job states alone prevent a resend.
    violation: Not applicable.
    source: NFR1, NFR nfr-requirements answer Q1 (A)

  # BR53 Duty reminders (U5's own daily check)
  - id: BR53.1
    statement: Week-ahead and day-before reminders are planned for open manual duties with a future start.
    category: policy
    applies_to: [ReminderJob, ReminderRecipient, ReminderSetting]
    trigger: a duty is saved, a family is archived, a place changes or the reminder setting changes
    logic: Unchanged from today. IF reminders are on in the community's setting, the duty is manual and open, and it starts in the future THEN it has one week-ahead and one day-before job, with recipient families chosen by the setting's scope. Rota duties have no start time and get none.
    violation: Not applicable.
    source: FR17.1, owner answer Q1 (A)
  - id: BR53.2
    statement: The week-ahead reminder is due seven days before the duty's day, and the day-before reminder one day before.
    category: calculation
    applies_to: [ReminderJob]
    trigger: a job is planned or re-planned
    logic: The job's due date is the Budapest calendar date of the duty's start, minus 7 days for the week-ahead reminder and minus 1 day for the day-before reminder. With the daily run at 07:00 it is sent on that morning.
    violation: Not applicable.
    source: owner answer Q1 (A), ADR-006
  - id: BR53.3
    statement: The daily check sends each due job once, to the parents of its recipient families.
    category: policy
    applies_to: [ReminderJob, Notice, EmailDelivery]
    trigger: the daily run calls the duty-reminder check
    logic: IF a job is queued, its due date is on or before today, and its duty is still open and not yet started THEN the check sends it through notice_send to every parent of its active recipient families, with the job and the parent as the once key, and marks the job sent. IF the duty has started, closed or been cancelled THEN the job is cancelled. IF the duty's start changed THEN the job is stale (unchanged). The check returns the jobs sent as created and the jobs cancelled or stale as skipped.
    violation: Not applicable.
    source: AC17.1.1, AC17.1.3, AC17.1.5
  - id: BR53.4
    statement: When both reminders of a duty are due at the same run, only the day-before reminder is sent.
    category: policy
    applies_to: [ReminderJob]
    trigger: the duty-reminder check
    logic: IF the week-ahead job and the day-before job of one duty are both due THEN the day-before job is sent and the week-ahead job becomes skipped. This happens when a duty is created, or a missed run is caught up, less than a day before it starts.
    violation: Not applicable.
    source: owner answer Q1 (A)
  - id: BR53.5
    statement: Reminders are no longer sent when a page is opened.
    category: policy
    applies_to: [ReminderJob]
    trigger: a parent opens the notice list, or an administrator opens a screen
    logic: Opening any page runs no reminder. Today's member tick and the simulated delivery switch are removed. Only the daily run sends reminders.
    violation: Not applicable.
    source: FR17.3, ADR-006, owner answer Q1 (A)

  # BR54 The administrator's view of failures
  - id: BR54.1
    statement: Only super admins see delivery problems.
    category: authorization
    applies_to: [EmailDelivery, TimedCheckRun]
    trigger: the delivery-problems list is read
    logic: IF the caller is a super admin with an active session THEN the list is returned. Every other role, including working-group coordinators, gets a denied refusal, never an empty list.
    violation: Denied refusal authorization_denied.
    source: C9 failure.record.visible_to, C1 list_functions, owner answer Q5 (A)
  - id: BR54.2
    statement: The list shows failed emails grouped by what they were about, and failed checks, with no address or recipient name.
    category: policy
    applies_to: [EmailDelivery, TimedCheckRun]
    trigger: the delivery-problems list is read
    logic: Failed emails are grouped by kind and item. Each group shows the notice title, the time of its latest try and how many recipients failed. Daily-run records from the last 30 days whose outcome is failed or missing are shown with the check name, run kind, time and error code. No group shows an address, a parent's name or a family's name.
    violation: Not applicable.
    source: AC17.1.2, AC17.1.4, NFR1, owner answer Q5 (A)
  - id: BR54.3
    statement: Try again gives every failed email of a group a new round of 3 tries.
    category: policy
    applies_to: [EmailDelivery]
    trigger: a super admin presses "Újrapróbálás" on a group
    logic: The screen sends the group key (kind, item type, item id) and the list of (delivery id, try count) it showed. IF the caller is a super admin AND the group still has failed emails AND every listed email is still failed with the same try count THEN each listed email starts a new round (a failure that joined the group later is not listed and stays failed), with no tries yet, due at once, and is sent at the next delivery pass. A repeated idempotency key returns the stored result. No audit event, as today.
    violation: Conflict REMINDER_NOT_RETRYABLE when the group has no failed email; invalidated REMINDER_STALE when a listed email is no longer failed or its try count changed since the screen was shown; denied authorization_denied for another role.
    source: owner answer Q5 (A), C1
  - id: BR54.4
    statement: Two super admins trying the same group again at once get one new round.
    category: constraint
    applies_to: [EmailDelivery]
    trigger: two Try again calls on one group at the same time
    logic: The deliveries are locked by ascending id. The first call starts the new round; the second finds no failed email and gets REMINDER_NOT_RETRYABLE.
    violation: Conflict REMINDER_NOT_RETRYABLE.
    source: NFR5, C1 locks

  # BR55 Email content
  - id: BR55.1
    statement: An email carries the notice title, the item, its date, a link and an automatic-email line, and nothing else.
    category: policy
    applies_to: [EmailDelivery]
    trigger: an email is prepared
    logic: The subject is the notice title (BR50.4). The body has the item name, its date in Hungarian form when it has one, a link to the item's page made from the app's public address, and a line saying the email is automatic and not to be answered. The link opens only after sign-in.
    violation: Not applicable.
    source: AC17.1.1, AC17.1.6, owner answer Q6 (A)
  - id: BR55.2
    statement: An email names no other person or family and has one recipient.
    category: policy
    applies_to: [EmailDelivery, NoticeKind, NoticeTarget]
    trigger: an email is prepared
    logic: No part of the email holds another parent's or family's name, phone or email. Every email goes to one address, with no copy or hidden-copy recipients. Kind prefixes and facts functions added by later units must keep this.
    violation: Not applicable.
    source: AC17.1.4, NFR10, owner answer Q6 (A)

  # BR56 Removal (U5's step of C16)
  - id: BR56.1
    statement: Removing a parent or a family removes their notices, emails and reminder recipients.
    category: policy
    applies_to: [Notice, EmailDelivery, EmailAttempt, ReminderRecipient]
    trigger: U14 calls the Notifications removal step (C16)
    logic: The preview counts what would change. Applying it takes the delivery row locks in ascending id and deletes the parent's notices with their emails and tries (an email already handed to the mail server may still arrive once; its late outcome is ignored), and, for a family, marks the family's reminder recipients removed. Removed recipients are never sent to again. It returns the same counts, and zero for a subject it holds nothing of.
    violation: Not applicable.
    source: C16 providers.U5, NFR11
```

## Rules Summary

| Rule | In short |
|---|---|
| BR50.1 | A notice goes to each active parent with an account |
| BR50.2 | One once key, one notice and one email per parent |
| BR50.3 | Kind and item type must be registered |
| BR50.4 | Title and link are built at reading time from the item's facts |
| BR50.5 | Read once, by the notice's own parent |
| BR50.6 | Every notice sent through notice_send is also emailed |
| BR50.7 | A mail failure never undoes the caller's change |
| BR51.1 | Each due email is claimed once |
| BR51.2 | The address is looked up at send time and never stored |
| BR51.3 | At most 3 tries, 15 minutes apart, then shown to the super admin |
| BR51.4 | A try left unrecorded counts as failed after 10 minutes |
| BR51.5 | Recording an outcome twice changes nothing |
| BR51.6 | The in-app notice always remains |
| BR51.7 | Only the server's service access sends emails |
| BR52.1 | Only the server's service access starts a run |
| BR52.2 | Every active check runs; a failure is recorded and the rest go on |
| BR52.3 | One moment per run, in Budapest time |
| BR52.4 | Two run kinds: daily and Friday noon |
| BR52.5 | A second run on the same day sends nothing twice |
| BR52.6 | A delivery pass every 15 minutes and after each run |
| BR52.7 | Nothing depends on anyone signing in |
| BR53.1 | Duty reminders are planned as today |
| BR53.2 | Due seven days and one day before the duty's day |
| BR53.3 | The daily check sends each due job once |
| BR53.4 | When both are due together, only the day-before one is sent |
| BR53.5 | Opening a page sends nothing |
| BR54.1 | Only super admins see delivery problems |
| BR54.2 | Failed emails grouped by item and failed checks, with no address or name |
| BR54.3 | Try again gives a new round of 3 tries |
| BR54.4 | Two admins at once start one round |
| BR55.1 | What an email contains |
| BR55.2 | No other person or family named; one recipient |
| BR56.1 | Removal deletes notices and emails and marks recipients removed |

## Refusal Codes

| Code | State | Raised by |
|---|---|---|
| NOTICE_KIND_UNKNOWN | validation | BR50.3 |
| NOTICE_TARGET_UNKNOWN | validation | BR50.3 |
| NOTICE_REQUEST_INVALID | validation | BR50.3 |
| run_kind_invalid | validation | BR52.4 |
| authorization_denied | denied | BR50.5, BR51.7, BR52.1, BR54.1, BR54.3 |
| REMINDER_NOT_RETRYABLE | conflict | BR54.3, BR54.4 (today's code, kept) |
| REMINDER_STALE | invalidated | BR54.3 (today's code, kept) |
