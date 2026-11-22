<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

- 2026-11-17T14:20:00Z [unit u10-events-and-signups] — The sign-up deadline is shown and blocks nothing; FR13.3 says only that it is shown to parents, and the checklists work owns the reminders around it.
- 2026-11-17T14:20:00Z [unit u10-events-and-signups] — The leaving and new family rule applies to event tasks, not to the voluntary sign-up with a note; the unit notes name only event tasks and a sign-up holds no duty.
- 2026-11-17T14:20:00Z [unit u10-events-and-signups] — Every signed-in reader sees every event, other working groups' included; FR1.2 and FR1.6 give the community read access and only changing is limited to the group.
- 2026-11-21T08:50:00Z [unit u13-lending-library] — Authors are required and only the description is optional; AC16.1.2 names only a missing description, so a spreadsheet row without authors is refused and reported by U15.
- 2026-11-21T08:50:00Z [unit u13-lending-library] — A family member other than the owner may borrow the family's book; Q4 refuses only the owner personally, and the stories give no family rule.

- 2026-11-09T07:11:20Z [unit u1-community-foundation] — Sign-up, assignment and swaps no longer depend on working-group membership; contracts C2 and C18 give parents the whole community and list no membership refusal, so today's membership checks go in U1 rather than waiting for U6 or U7.
- 2026-11-09T07:11:20Z [unit u1-community-foundation] — Group-wide reminders reach families with an active member parent, and every family for a community-wide task; requirements are silent and U5 replaces the mechanism, so this keeps today's setting working.

- 2026-11-10T08:05:00Z [unit u2-first-rota-slice] — Indoor-cleaning card text is a short fixed Hungarian sentence; the sources hold no cleaning instructions, only "no fixed day" (FR5.7), so detailed text waits for the information page and the owner corrects the wording in the screenshot review.
- 2026-11-10T08:05:00Z [unit u2-first-rota-slice] — Every active family counts as full-year in the draft; family standing (leaving, new) is U6's, so the part-year half of AC5.1.2 and AC5.1.3 are traced to U6.

- 2026-11-13T07:07:04Z [unit u3-directory-and-profile] — A parent always sees their own family's children; Q2 put the other parent's contact details under the tick-box rule, but the children are the viewer's own family's data, so BR30.4 shows them to the family itself.
- 2026-11-13T07:07:04Z [unit u3-directory-and-profile] — A working-group coordinator sees the directory as a parent does; FR3.5 names only teachers and super admins as wider readers, while today's code lets group admins read contacts in reach.

- 2026-11-14T17:09:27Z [unit u5-reminders-and-email] — U5 builds on the existing notifications and reminder tables rather than a fresh set; they already hold notices, jobs, recipients and attempts with read-once and at-most-3 rules, and only their delivery is simulated.
- 2026-11-14T17:09:27Z [unit u5-reminders-and-email] — The email address is the parent's sign-in email; U3's Q1 made that the one address on record, so no question is asked about it.
- 2026-11-14T17:20:00Z [unit u5-reminders-and-email] — Notice titles and links come from a registry of per-item facts functions that each unit adds; C8 passes no title, and a shared title function would have to be edited by every later unit.

- 2026-11-15T12:01:26Z [unit u4-working-groups] — The membership's version also goes up on appoint and revoke; the coordinator fact lives on the grant, which has no version, and the group's version would make unrelated appointments refuse each other.
- 2026-11-15T12:01:26Z [unit u4-working-groups] — Leaving an archived group is allowed while joining it is refused; leaving grants nothing, and refusing it would strand memberships a super admin can no longer reach.
- 2026-11-15T13:05:00Z [unit u4-working-groups] — The coordinator notice's once key carries the kind (coordinator_appointed:<grant id>); U5 removes duplicates by once key and parent only, so the grant id alone would drop the revocation notice.
- 2026-11-15T13:05:00Z [unit u4-working-groups] — A stale leave after an appointment gets VERSION_CONFLICT on purpose; the parent's page did not show the warning that leaving ends the coordinator right.

- 2026-11-16T05:49:19Z — [unit u6-full-rotas-and-weekend-picks] Judge a rota week's changeover eligibility by its Monday; the stories give only a date, and a week that contains the changeover date would otherwise leave its weekend duties and pick with a family that may not hold them. Recorded as an assumption for the owner.
- 2026-11-16T05:49:19Z — [unit u6-full-rotas-and-weekend-picks] Treat a family with no standing row as staying; contract C20 said "null when the family has no row", but backfilling a row for every family and year would keep two copies of one fact. Listed as a contract delta.
- 2026-11-21T16:41:47Z [unit u7-swaps-and-duty-changes] — Read "the administrator" in AC8.2.4 and AC8.3.2 as a super admin for rota duties and an admin reaching the group for other duties, the same reach as assigning a duty today; the stories name no role and AC5.4.5 refuses working-group admins only for rota duties.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-11-21T16:41:47Z [unit u7-swaps-and-duty-changes] — U7 changes U6's rota_adjust_picks_after_change so a change with no new family empties the week with reason cancelled and returns its pick; the owner's Q3 answer frees a rota duty on an approved cancellation, and C11 only knew changes to another family. Listed as a C11 contract delta.
- 2026-11-21T08:50:00Z [unit u13-lending-library] — U13's removal block also clears closed-loan borrower links and the owner link of the subject's books and deletes return watches; contract C16 listed only flagging held books and removing watches, but a deleted family or parent would otherwise leave links to nothing.
- 2026-11-21T08:50:00Z [unit u13-lending-library] — A super admin may change a book's owner and record a return only for a book with no owner who has rights; Q1 to Q3 left both open and a typed-name or ownerless book would otherwise be stuck.

- 2026-11-09T07:11:20Z [unit u1-community-foundation] — Left isCoordinator off WorkingGroupMembership although components.md lists it; the unrevoked group-admin grant is the single record, because ADR-010 keeps grants in Identity and a second copy could disagree.

- 2026-11-10T08:05:00Z [unit u2-first-rota-slice] — U2 also builds the C5 place functions and C18 place_mark_done although no U2 screen uses them; the contracts name U2 as provider, and leaving them would make U7 and U9 reach back into U2.
- 2026-11-10T08:05:00Z [unit u2-first-rota-slice] — Today's notices are tied to one task, so the publishing notice adds one kind to them (rota_published) rather than waiting for U6's notification function; contract C8 said U2 would use today's function unchanged.

- 2026-11-13T07:07:04Z [unit u3-directory-and-profile] — U3 also designs the C16 directory removal step and the C17 family load step although no U3 screen needs the latter; the contracts name U3 as provider, so U14 and U15 need not reach back into U3.
- 2026-11-13T07:07:04Z [unit u3-directory-and-profile] — The old free-text profile and the separate contact email are dropped rather than migrated; the records are invented test data (AC1.1.3), and the owner chose one email per parent (Q1).

- 2026-11-15T12:01:26Z [unit u4-working-groups] — The coordinator notice goes out with its email although Q4 first chose no email; U5's notice_send always queues one email per notice, and the owner chose in follow-up Q5 to accept that rather than change U5.
- 2026-11-15T13:05:00Z [unit u4-working-groups] — U4 changes three functions of other units: end_admin gains an audit reason, lifecycle_run_core ends grants before deleting memberships, and directory_list moves its contact logic into helpers U4 also uses; the review showed each would otherwise break a U4 rule.

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-11-17T14:20:00Z [unit u10-events-and-signups] — A role's person is either a parent with an account or a typed name, never both; the organiser mark needs the parent, which lets removal clear it, at the cost of a second kind of role holder.
- 2026-11-17T14:20:00Z [unit u10-events-and-signups] — The event's typed coordinator name is dropped in favour of roles; the teacher schedule then shows the oldest role instead, so one place holds "who is responsible" and removal has one typed field to clear.
- 2026-11-21T08:50:00Z [unit u13-lending-library] — Where a book is now is derived from its open loan instead of stored on the book; one record cannot disagree with itself, at the cost of a read that joins the loan.
- 2026-11-21T08:50:00Z [unit u13-lending-library] — The leaving-family reminder keeps no sent-marker on the loan; the once key of the notice already stops a second send, so a stored flag would be a second copy.
- 2026-11-09T07:11:20Z [unit u1-community-foundation] — The six groups load from one repository list used by the seed rather than a dedicated install function; a function would be speculative until the hosting work exists, and that work must load the same list.
- 2026-11-09T07:11:20Z [unit u1-community-foundation] — Teachers read events through the schedule only, with no new table right; event rows hold notes other readers must not see, and U10 adds a proper events read.

- 2026-11-10T08:05:00Z [unit u2-first-rota-slice] — Published is final in U2, so a mistake means a local reset until U7 can change duties; the alternative, an unpublish step, would need rules for notices already sent and duties already created.
- 2026-11-10T08:05:00Z [unit u2-first-rota-slice] — Rota duties are refused by today's change functions (DUTY_ROTA_MANAGED) rather than left editable, because an edit through the old task form would break the rota's one-family-per-week link until U7 moves those functions.

- 2026-11-13T07:07:04Z [unit u3-directory-and-profile] — The directory search filters the cards already sent to the browser instead of searching in the database; with about 20 families one read is fast enough, and it guarantees a hidden field can never make a card match.

- 2026-11-15T12:01:26Z [unit u4-working-groups] — The general role-change function refuses the group-admin role instead of gaining a membership check (Q3); one way in keeps the grant-needs-membership rule in a single place.

- 2026-11-16T05:49:19Z — [unit u6-full-rotas-and-weekend-picks] Give the weekend family all five weekend places at publishing and let a pick move one, instead of leaving opening and closing places open until picked; "the weekend family does the rest" then needs no step at all, and the overview, done marks and removal read places only. The cost is one contract delta: the pick functions call place_reassign.
- 2026-11-16T05:49:19Z — [unit u6-full-rotas-and-weekend-picks] Compute flagged duties when read instead of storing a flag; a later change of standing or changeover date then needs no clean-up, and the removal block has nothing to write.

- 2026-11-21T16:41:47Z [unit u7-swaps-and-duty-changes] — Kept the one change_requests table and widened it, instead of a new swap table; today's requests, notices and approvals screen already read it, at the cost of more statuses and nullable swap-only columns.
- 2026-11-21T16:41:47Z [unit u7-swaps-and-duty-changes] — The decider of a request stays an account id rather than a parent id, because a super admin may have no parent record; removal clears it by account, which settles the C16 open question.

## Open questions

- 2026-11-16T05:49:19Z — [unit u6-full-rotas-and-weekend-picks] Notices reach only parents with an account, so a super admin with no parent record gets no Friday-noon alert; confirm whether every administrator is also a parent before go-live.
- 2026-11-10T08:05:00Z [unit u2-first-rota-slice] — The teacher's overview route is only proposed; confirm it in the Stitch design.
- 2026-11-13T07:07:04Z [unit u3-directory-and-profile] — U14's notes say its design settles removing a family's only parent; U3 now refuses it (owner answer Q5), so U14 should start from that refusal.
- 2026-11-13T07:16:30Z [unit u3-directory-and-profile] — Settle in NFR Design or the code plan: the extended account-status step must lock the family row before touching the profile (lock order), and the password change must end the sign-in service's sessions that the database's active-session check reads, with a test that an old session is refused.
- 2026-11-15T12:01:26Z [unit u4-working-groups] — The mockup's group page also lists the group's events and to-do tasks; those sections arrive with U10 and U12, so U4's page shows members only until then.
- 2026-11-15T13:05:00Z [unit u4-working-groups] — U14 must call U4's removal block before U3's directory block, because U3's block clears the account link and the coordinator grants can then no longer be found.
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-11-17T14:20:00Z [unit u10-events-and-signups] — U14 decides whether the note of an anonymised sign-up is cleared too; a note could contain a name.
- 2026-11-17T14:20:00Z [unit u10-events-and-signups] — U11 decides what happens to today's event tasks (Q6 kept them); contract C4's event_task origin stays unused until then.
- 2026-11-21T08:50:00Z [unit u13-lending-library] — U15 should say that the spreadsheet's current holder of a book is not migrated and that a row with no authors is refused; U14 decides whether a leaving owner's books should be removed rather than left ownerless.

- 2026-11-21T06:04:15Z — [unit u10-events-and-signups] Replay after Request Changes: kept the approved design and corrected two rules to match the built behaviour; BR110.1 now says a repeated withdrawal answers denied, and BR119.1 says event_list_for_group is readable by every signed-in reader and carries the count and own flag.
