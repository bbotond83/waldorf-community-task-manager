# Security Design: u5-reminders-and-email

Sources: `nfr-requirements/security-requirements.md`, `functional-spec.md`, `rules.md`, contracts C1, C2, C8, C9, C16, ADR-006, ADR-007. Contains no names or contact details.

## Function access (NFR3.1, NFR3.2, NFR3.3, NFR3.6, NFR3.9)

| Function group | Callable by | How enforced |
|---|---|---|
| `timed_checks_run_system`, the email claim, the expiry sweep (rows taken with `skip locked`), the outcome record | service role only | `revoke all` then `grant execute` to the service role; the body also checks the role and returns authorization_denied |
| `notice_send` | feature functions inside the database only | not granted to signed-in or anonymous roles; called by other `security definer` functions of the same owner |
| Facts functions, check functions, `housekeeping` | the database's own owner only | not granted to any application role; called through the registry by `security definer` code with a pinned search path; a facts function checks the reading parent may see the item (NFR3.9) |
| Delivery-problems list, Try again | signed-in session | body checks an active super admin session |
| Notice list, mark read | signed-in session | body checks the caller owns the notice |

Every function pins its search path and grants no table write right. Signed-in accounts keep read-only table rights, and the new tables' read rules allow a parent only their own notices; delivery, attempt, run and check tables are not readable by application roles at all (the screen reads through its function).

## Community and recipient checks (NFR3.2, NFR3.5)

`notice_send` joins each named parent to the community: the caller's community for a signed-in call, and the parent's own community (parent, family, community) for a service-role call from the run, tested with a service-role call, an active parent record and an active linked account in one statement; parents failing any condition are skipped. The claim re-checks the same conditions at send time and cancels the email without returning an address when they fail.

## Registries (NFR3.7)

Registry rows are inserted by migration files only; no function writes them and application roles have no write right. A function name from a registry is built with `format('%I', ...)` and called only inside a `security definer` function; the seed names are fixed in the migration. A test inserts a name containing a quote and checks it is refused by a name pattern constraint.

## No address at rest or in logs (NFR1.2, NFR1.4, NFR7.11)

The claim returns the sign-in address in its result for that call only. The timed command passes it to the mail adapter and drops it. The adapter wraps every send in a handler that maps the error to a reason class (rejected, unavailable, timeout, other) and discards the library's message. The record function receives only the delivery id, round, try number and reason class. A test fails the mailer with an error containing an address and searches log lines and tables.

## Data minimisation (NFR1.3, NFR10.1 to NFR10.4)

The failure screen builds a group's title without a facts call: the kind's Hungarian label (a registry column) plus the item's date from the delivery record. No reading parent is involved, so no per-reader title or name can appear. The shared leak test also runs over the failure list result. Test data for every check uses invented people only and their addresses are in `scripts/verification/privacy-allowlist.json` (NFR1.1).

The email template is fixed: subject = title; body = item name, date, link, automatic-email line. One recipient, no copy fields. The link is the app's public address plus the item's path; it carries no token and opens only after sign-in. Facts functions return only the item's own fields; a shared test walks every registered target type with two families and checks that the other family's name, phone and email never appear in the title, date or path.

## Retention (NFR1.5, NFR1.7)

The registered check `housekeeping` runs in the daily run, deletes email deliveries (with their tries) 90 days after they finish and run and check records 30 days after the run. No check reads run or check records to decide what is due, so pruning cannot cause a resend; once keys on notices and job states decide. Notices are not pruned.

## Removal (NFR1.6, NFR11.1)

The removal step locks, after the family row, the family's reminder job rows ascending and then the parent's delivery rows ascending (the same order as the duty-reminder check), deletes notices, deliveries and tries, and marks the family's reminder recipients removed. An email already handed to the mail server may arrive once; its late outcome finds no row and is ignored (BR51.5). The preview and apply steps return the same counts.

## Audit and authorization matrix (NFR4.1, NFR3.8)

Try again writes no audit event, as today; daily runs are recorded in the run tables. `role-policy.ts`, `authorization.ts`, navigation and `verification/authorization-matrix.json` change together to make the screen super-admin only, and every role is walked through it.

## Threats

| Threat | Design answer |
|---|---|
| Parent or coordinator triggers a run or claims emails | service-role-only grants and a body check |
| A feature mails a parent of another community | community join in `notice_send` |
| Another family's details in an email | fixed template, facts-only output, shared test |
| Addresses in tables or logs | claim-time lookup, error mapping, tests |
| Steering a registry name to another function | migration-only registries, name constraint, `%I` quoting, pinned search path |
