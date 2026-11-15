# Functional Design Questions: u5-reminders-and-email

The story about reminders by email and in the app (US17.1), the reminder requirements (FR17), the daily-run and mail decisions (ADR-006, ADR-007) and the contracts for sending a notice (C8) and for the daily run (C9) settle most of this piece of work.

The app already has notices, a parent's notice list, an administrator's reminders screen, and 7-day and 24-hour duty reminders with at most 3 tries. Today the email is only simulated, and the reminders run when someone opens a page.

Settled without a question:

- The email goes to the parent's sign-in email, the one address U3 keeps on record.
- The daily run is at 07:00 Budapest time, with an extra Friday-noon run, triggered locally by a command that signed-in users cannot call.
- A run that was missed, for example because the computer was off, sends what is due at the next run.
- No email address is stored in delivery records.

These six points are still open. Contains no names or contact details.

## Q1. [Product owner] What happens to today's 7-day and 24-hour duty reminders

Today a duty with a start time gets a reminder 7 days and 24 hours before it starts. The reminders are sent only when someone opens the notice list or the reminders screen, which fails the rule that reminders run without anyone signing in (FR17.3). Once there is one run a day at 07:00, "24 hours before" can no longer be hit exactly.

A. Move them onto the daily run and real email. The week-ahead reminder goes out at the 07:00 run seven days before the duty's day, and the day-before reminder at the 07:00 run on the day before. Sending on page open is removed (Recommended)
B. Move them onto the daily run, but send the 24-hour one at the first run less than 24 hours before the start. This is often the same morning
C. Leave them as they are, and let a later piece of work move them
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] Which notices also go by email

The contract for sending a notice (C8) says every notice is shown in the app and also sent by email. The requirement asks this for reminders (FR17.1). Later pieces of work will send notices such as "swap requested", "rota published" or "a book is back" through the same function. Notices that today's actions create (sign-up confirmed, place removed, swap decisions) move onto it when their own piece of work does (U6, U7).

A. Every notice sent through the new function also goes by email, as the contract says. A parent may get several emails a week in busy periods (Recommended)
B. Only timed reminders and alerts go by email. Notices about something a person just did stay in the app only. This changes the contract, and the contract document is updated with it
X. Other (please specify)

[Answer]: A

## Q3. [Operations] How often emails are sent and retried

A failed email is tried at most 3 times, 15 minutes apart (AC17.1.2). If emails went out only at the daily run, a notice created at 14:00, such as a swap request, would reach the inbox the next morning, and a retry 15 minutes later would never happen.

A. Sending is a separate, short step that runs every 15 minutes, and also right after each daily run. Locally the same command runs it on request, and the hosting work attaches the 15-minute schedule (Recommended)
B. Emails go out only at the daily run and the Friday-noon run, and a failed email is retried at the next run. This breaks the 15-minute rule, and the story is updated with it
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] Who receives notices and emails

A parent can be on record without an account, for example invited but not yet signed in. Today only parents with an active account get notices, because the notice list needs a sign-in to be read.

A. Only active parents with an account get the notice and the email, as today (Recommended)
B. Parents without an account still get the email, without an in-app notice
X. Other (please specify)

[Answer]: A

## Q5. [Product owner] What the administrator sees about failed emails

A failed email must be shown to an administrator (AC17.1.2), on the same screen as failed daily-run checks (C9), which super admins see. Today's reminders screen ("Emlékeztetők") is for administrators of a group, lists simulated jobs, and has a retry button.

A. Today's reminders screen becomes a super-admin screen with two lists: emails that failed after 3 tries, and daily-run checks that failed. Each failed email shows what it was about, when it was last tried and how many recipients it had, with no address. A "Try again" button gives it 3 more tries (Recommended)
B. The same screen and lists, but show only, with no "Try again" button
X. Other (please specify)

[Answer]: A

## Q6. [Product owner] What an email contains

Emails must not contain any other family's contact details (AC17.1.4, NFR10). A notice about a swap or a sign-up could still name the other family.

A. The subject is the notice's title. The body has the item's name and date, a link to it in the app, and a line saying the email is automatic. No other person or family is named, not even by name (Recommended)
B. The same, but the email may name the other family, with no contact details
X. Other (please specify)

[Answer]: A
