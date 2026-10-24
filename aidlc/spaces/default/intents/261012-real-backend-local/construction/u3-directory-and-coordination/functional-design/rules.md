# Rules: U3 Directory, settings and coordination

Source: requirements FR2.3 (link), FR2.8, FR3.3 to FR3.5, FR4.1 to FR4.4, FR5.1 to FR5.5, FR6.1, ADR-001 to ADR-013, the confirmed answers Q1 to Q8, the first architecture review, and a rule-by-rule review of the old Directory, Coordination, teacher-tracking, privacy-audit and parent/admin/teacher adapter code (the disposition ledger below shows where every old rule went).

Numbering: U1 and U2 already use BR1 to BR4, BR10 and BR11, so U3 uses its own groups to keep ids unique: BR30 (Directory and Settings), BR31 (Coordination), BR32 (kernel use cases, adapters and screens), BR33 (teacher schedule), BR34 (carry-over of old rules), BR35 (lifecycle).

Audit follows U1 BR3.2: only the fixed actions are audited, so U3 writes audit events only for approvals (`approval.approve`, `approval.reject`, used for swap and cancellation decisions) and for the lifecycle actions `lifecycle.anonymize` and `lifecycle.delete` (U3 never places or releases a hold; holds are U1's), and does not extend the action list. Other edits are traced by the record's version and updated time only. This corrects the first draft of this design, which wrote an audit event for every change.

Reach used by the rules: a super admin reaches the whole organization; a group admin reaches the groups they hold a grant for, and so the families with an active membership in one of those groups, and the events, tasks and assignments of those groups; a parent reaches their own family; a teacher reaches the schedule of the groups granted to them. These are the grants and policies from U2; U3 adds the tables they apply to.

Kernel use cases (ADR-001, ADR-011): a Directory or Coordination function never calls another block's function. The writes and reads that cross blocks are named kernel use cases, each an elevated database function that U3 adds to U2's catalogue with its allowed roles (BR32.6): `family.archive` and `family.restore` (Directory records plus Coordination assignments and requests), `duty.sign_up` (reads Directory memberships), `swap.request`, `swap.respond`, `swap.withdraw`, `swap.incoming` (lists swap requests addressed to the family, showing the requester's task and family display name), `swap.decide`, `cancellation.request`, `cancellation.decide`, `assignment.assign` and `assignment.remove`, `duty.list` and `duty.get` (read Directory), `swap.candidates` (shows other families' task and display name to a parent), `dashboard.get`, `schedule.get`, `invitation.accept_parent` (BR32.3) and `lifecycle.run`. They read other blocks' tables by typed id inside the function, never through a foreign key; those tables are not readable through any other path by the roles that should not see them.

```yaml
rules:
  # ---------------- BR30: Directory and Settings ----------------
  - id: BR30.1
    statement: "Only admins in reach can create or change families, parents, children and memberships"
    category: authorization
    applies_to: Directory
    trigger: "an admin saves a family, parent, child or membership"
    logic: "IF the actor is a super admin of the organization OR a group admin whose group contains the family through an active membership (a family without any membership can be changed by a super admin only; a new family is created by a super admin, or by a group admin who gives it a membership of their own group in the same call) THEN the change is allowed; OTHERWISE it is denied; the check is made by the database function and by the table policies, never only by the screen; the group reach of a family and of an assignment is defined in entities.md (Placeholder tables) and is also what U2's rewritten functions use"
    violation: "denied result; nothing is changed"
    source: "FR5.3, FR3.3"
  - id: BR30.2
    statement: "Every directory change is checked for staleness and validated, and a repeat with the same key returns the same result"
    category: constraint
    applies_to: Directory
    trigger: "any create or update of a directory record"
    logic: "IF the change carries an expected version that differs from the stored one THEN it is refused as stale: the admin operations return the conflict result with the code VERSION_CONFLICT, as the admin screens map it today; IF a field breaks the limits in entities.md THEN a validation result names the field in Hungarian; OTHERWISE the record is changed and its version increased by one; a repeated call with the same idempotency key returns the stored result (U1 BR3.6); no audit event is written for ordinary directory edits (U1 BR3.2)"
    violation: "stale (conflict) or validation result; nothing is changed"
    source: "FR4.2, FR5.5"
  - id: BR30.3
    statement: "A sign-in account belongs to at most one parent and is linked only by an invitation or by a super admin correction"
    category: constraint
    applies_to: "Directory, Identity"
    trigger: "an invitation for a parent is accepted, or a super admin links or unlinks an account"
    logic: "IF the invitation names a target parent (target_id) THEN acceptance sets that parent's account_id in the same transaction that creates the account and grant (BR32.3); IF that parent already has an account_id, or the account already belongs to another parent, THEN acceptance is refused and the invitation stays pending for an admin to look at; the unique account_id makes a second link impossible even in a race"
    violation: "conflict result; no account, grant or link is created"
    source: "FR2.3, FR2.8"
  - id: BR30.4
    statement: "A parent's optional profile is stored only with consent and shown only to the parent and to admins in reach"
    category: policy
    applies_to: Directory
    trigger: "a parent record is saved or read"
    logic: "IF optional_profile_consent is false THEN the saved optional_profile is emptied; IF it is true THEN the text is kept and shown to the parent themself and to admins in reach (not to other parents, not even of the same family, which keeps the old view where only admins saw it and adds the parent's own view); withdrawing consent empties the text in the same change"
    violation: "no error: text sent without consent is dropped"
    source: "FR3.4 (carried over from the old directory service; the parent's own view is a change, see ledger D4)"
  - id: BR30.5
    statement: "A parent's contact details are readable only by the parent, the other parents of the same family and admins in reach, enforced by the database"
    category: authorization
    applies_to: "Directory (ParentContact)"
    trigger: "any read of ParentContact, directly or through a function"
    logic: "IF the reader's account is the parent's own account, OR the account of another parent of the same active family (answer Q8), OR an admin whose reach includes the family, THEN the row is visible; OTHERWISE it is not (parents of other families, teachers and signed-out requests see nothing, and a list that includes contacts omits those rows); no function or view returns contact fields to anyone else; a policy test per role covers the table and every function that touches it, including the co-parent case"
    violation: "the row is absent; no error text reveals that it exists"
    source: "FR3.4 (answer Q8; the co-parent view is a decision beyond ADR-010, recorded here)"
  - id: BR30.6
    statement: "A child belongs to one family; group places are family memberships, changed only by admins who reach the group"
    category: constraint
    applies_to: Directory
    trigger: "an admin adds or changes a child, or puts a family into or out of a group"
    logic: "IF the family and the group belong to the same organization AND the admin reaches the family AND reaches the group being added or ended THEN a membership can be added (a repeat of an active membership is refused as a duplicate) or ended; a child is only linked to its family; the school year of a child is the school year of the group its family belongs to; a group of another organization is refused with a validation result; a family left with no active membership is allowed (it stays visible to super admins and shows in the 'without a group' filter) but cannot take tasks until it has one"
    violation: "validation, conflict or denied result; nothing is changed"
    source: "FR4.3 (replaces the old per-child group assignment, see ledger D6)"
  - id: BR30.7
    statement: "Archiving a family hides it, frees its future places and keeps the history; restoring brings back the people but not the removed places"
    category: policy
    applies_to: "Directory, Coordination (kernel use cases family.archive and family.restore)"
    trigger: "an admin in reach archives or restores a family"
    logic: "IF a family is archived THEN in one transaction its status becomes archived (archived_at set), its parents and children become archived, every non-removed assignment of the family on a task that starts in the future becomes removed (the places are free again; an assignment that was the target of another family's swap request returns that family's source assignment to active), every open change request of the family becomes withdrawn, and the task versions are increased; assignments on tasks that already started stay as history; the family no longer appears for its parents or in normal admin lists (only in the archived filter); the parents' sign-in accounts are not deactivated by this (a deactivation is a separate super admin action from U2); IF the family is restored THEN status returns to active and its parents and children become active again, but removed assignments are not brought back; restoring a family that is already active gives the conflict RESTORE_CONFLICT; archiving a group, a school year or a child alone is allowed for an admin in reach: a child or group archive hides it from the lists without touching assignments, and a school year can be archived only when all its groups are archived"
    violation: "denied, stale or conflict result; nothing is changed"
    source: "FR5.5 (answer Q5)"
  - id: BR30.8
    statement: "A parent sees their own family in full and other families only as names on tasks"
    category: authorization
    applies_to: Directory
    trigger: "a parent reads family data"
    logic: "IF the reader is a parent of the family (account linked and family active) THEN they read the family, its parents (names, own optional profile with consent, contact details as in BR30.5) and children (names and school year); OTHERWISE they read nothing of that family except the parent and family display names that task, swap and schedule functions show for assignees; an archived family is not readable by its parents (denied, as before)"
    violation: "the row is absent or the result is denied"
    source: "FR2.8, FR3.4"
  - id: BR30.9
    statement: "Organizations, school years and groups are managed by super admins only"
    category: authorization
    applies_to: Directory
    trigger: "someone creates, renames or archives a school year or a group"
    logic: "IF the actor is a super admin THEN the change is allowed with the checks of BR30.2 (a group needs an active school year of the same organization; an end date is not before the start date; names are unique inside their parent); group admins and teachers can read their own groups only"
    violation: "denied or validation result"
    source: "FR5.3"
  - id: BR30.10
    statement: "Settings are read by admins and changed by super admins, with a version check"
    category: authorization
    applies_to: Settings
    trigger: "the settings screen opens or saves"
    logic: "IF the actor is an admin in the organization THEN the reminder setting (reminders on or off, and the recipient choice: recipient-duty or recipient-group) is returned with its version; IF the actor is a super admin and the sent version equals the stored one and the chosen recipient is one of the two options THEN the setting is saved and the version increased; a stale version gives the invalidated result with code SETTINGS_STALE and a recipient outside the options gives the conflict result with code SETTINGS_RECIPIENT_INVALID (both as the screens use today); settings changes are not audited (U1 BR3.2)"
    violation: "denied, invalidated or conflict result; nothing is saved"
    source: "FR5.5, FR4.3 (carried over from the old settings adapter)"
  # ---------------- BR31: Coordination ----------------
  - id: BR31.1
    statement: "Events and tasks are created and changed by admins in reach of their group"
    category: authorization
    applies_to: Coordination
    trigger: "an admin saves an event or a task"
    logic: "IF the actor reaches the group THEN the save is allowed with the checks of BR30.2; a task's group equals its event's group when an event is set; capacity is 1 to 50 and cannot be set below the number of places already taken (active, swap pending or cancellation pending); an end time is not before its start; a cancelled event sets its tasks to closed for new sign-ups (the check BR31.2 reads the task status, so the rule is tied to it; existing assignments stay and the admin decides about them); a task can be cancelled by an admin, which sets its assignments to removed and withdraws its open requests"
    violation: "denied, stale (VERSION_CONFLICT) or validation result; nothing is changed"
    source: "FR5.3, FR5.5"
  - id: BR31.2
    statement: "A family signs up for a task only if it passes the checks, in a fixed order"
    category: validation
    applies_to: "Coordination (kernel use case duty.sign_up)"
    trigger: "a parent signs up their family for a task"
    logic: "IF the parent belongs to an active family THEN the checks run in this order and the first failure is the result: the sent task version differs (invalidated DUTY_VERSION_STALE); the task is not open or has started (conflict DUTY_CLOSED; answer Q2: sign-up closes when the task starts); the family has a non-removed assignment on the task (conflict DUTY_ALREADY_ASSIGNED; answer Q4); the family has no active membership in the task's group (conflict DUTY_INELIGIBLE); the taken places are at capacity (conflict DUTY_FULL); IF all pass THEN the assignment is created with source parent_sign_up and the task version is increased, in one transaction that locks the task row first; no audit event (U1 BR3.2)"
    violation: "conflict, invalidated or denied result; no assignment is created"
    source: "FR5.1 (answers Q2, Q4; ported from the old coordination service and parent adapter)"
  - id: BR31.3
    statement: "Two parents signing up at the same time share one capacity and exactly one gets the last place"
    category: constraint
    applies_to: Coordination
    trigger: "two sign-ups for the same task arrive together"
    logic: "IF two requests compete for the last place THEN the task row lock serialises them: the first succeeds and the second, which carried the same task version, gets the invalidated result DUTY_VERSION_STALE because the first changed the version; a second request that carried a fresh version gets conflict DUTY_FULL; the second parent's next screen load shows the first parent's sign-up; a database constraint also forbids a duplicate non-removed assignment for the same family and task, so a double click cannot take two places"
    violation: "the losing request gets DUTY_VERSION_STALE or DUTY_FULL, never a second place"
    source: "FR5.1"
  - id: BR31.4
    statement: "A swap is asked by a parent for their own assignment and another family's, and applied when both families have confirmed"
    category: policy
    applies_to: "Coordination (kernel use cases swap.candidates, swap.request, swap.respond)"
    trigger: "a parent requests a swap, or the other family answers one"
    logic: "IF the parent's family owns the source assignment (only the requester's own assignment can be the source, never the target) and the target assignment belongs to a different active family of the same organization on a different task of the same group, both assignments are active (the source may not already have an open request), both versions match, both tasks have not started, and neither family already holds a non-removed place on the other task (so the exchange cannot break answer Q4), THEN a swap change request is created with the requester confirmed, and the source becomes swap_pending (its version increases; the new version and both task ids and the target's version are stored on the request); the parent chooses the target from the list returned by swap.candidates (other families' active assignments on other open, not-started tasks of the same group, showing the task title, date and family display name only); the other family finds the request on its own screen (BR32.7) and answers with swap.respond: confirm or decline; IF it confirms THEN the exchange runs (BR31.5 step) with no admin (answer Q1); IF it declines THEN the request is withdrawn and the source returns to active; at confirmation the function repeats every check above, comparing the current task ids and assignment versions of both assignments with the ones stored in the change request (a mismatch means a task or assignment changed meanwhile), plus not started, eligibility, open status and no duplicate place and locks the two task rows in ascending task-id order to avoid deadlocks; if a check fails the request is refused with the code SWAP_CANNOT_BE_APPLIED (conflict) and stays for the admin to decide or the requester to withdraw; a request that is not open any more gives SWAP_REQUEST_NOT_OPEN (conflict); the requester can withdraw their own open swap request with swap.withdraw (the request becomes withdrawn and the source returns to active; it works the same for a cancellation request through the same function), and swap.incoming returns both the swap requests addressed to the family and the family's own open swap and cancellation requests, each with its kind and direction"
    violation: "denied, conflict (REQUEST_DUPLICATE, DUTY_INELIGIBLE, DUTY_CLOSED, DUTY_ALREADY_ASSIGNED) or invalidated (REQUEST_VERSION_STALE) result; nothing is changed"
    source: "FR5.2 (answer Q1, Q6)"
  - id: BR31.5
    statement: "A swap that stays unconfirmed, and every cancellation, is decided by the admin in reach, and the exchange is always rechecked"
    category: authorization
    applies_to: "Coordination (kernel use cases swap.decide, cancellation.decide)"
    trigger: "an admin approves or rejects a pending swap or cancellation"
    logic: "IF the actor reaches the task's group (super admin, or group admin of that group) and the request is open THEN approve: a swap runs the exchange (the two assignments exchange their tasks, versions are increased, the request becomes approved or applied) after repeating the checks of BR31.4 and locking the two task rows in ascending task-id order, and a cancellation sets the assignment to removed and frees the place; reject: the assignment returns to active and the request becomes rejected; in both cases the request records the deciding account and time, and one audit event approval.approve or approval.reject is written in the same transaction (U1 BR3.2), with the request id as target; a swap left unconfirmed by the other family can be decided by the admin as a whole; the decision of a request that is no longer open gives the conflict APPROVAL_ALREADY_DECIDED, and a request whose stored task ids or assignment versions no longer match the current ones gives the invalidated result APPROVAL_INVALIDATED; when any exchange runs (by confirmation or by admin approval), every other open change request that involves either of the two assignments is withdrawn in the same transaction and its requester's source returns to active, so one assignment cannot be exchanged twice (the codes the approvals screen uses today); the exchange is refused when the two assignments are on the same task"
    violation: "denied, conflict or invalidated result; nothing is changed"
    source: "FR5.2 (answer Q1)"
  - id: BR31.6
    statement: "A family can ask to cancel its own assignment until the task starts"
    category: validation
    applies_to: "Coordination (kernel use case cancellation.request)"
    trigger: "a parent requests a cancellation"
    logic: "IF the assignment belongs to the parent's family, its version matches, it is active, the task has not started (answer Q3) and the assignment has no other open request THEN a cancellation change request is created and the assignment becomes cancellation_pending (the place stays taken until the admin decides); a repeat gives REQUEST_DUPLICATE; a family cannot cancel directly without the admin's decision"
    violation: "denied, conflict or invalidated result; nothing is changed"
    source: "FR5.2 (answer Q3)"
  - id: BR31.7
    statement: "An admin in reach can give a place to a family and can remove one, with the same checks as the old admin action"
    category: authorization
    applies_to: "Coordination (kernel use cases assignment.assign and assignment.remove)"
    trigger: "an admin assigns a family to a task or removes an assignment"
    logic: "IF the actor reaches the task's group THEN assigning needs a chosen family (the extended form, Q7) and gives the conflict ASSIGNMENT_INELIGIBLE when the family has no active membership in the task's group and ASSIGNMENT_CAPACITY_FULL when the places are taken (the codes the old admin adapter used), the duplicate check of BR31.2 and the version check; there is no override: an admin cannot exceed capacity or place an ineligible family; the assignment gets source admin_assign; removing sets the assignment to removed and frees the place, and withdraws its open request; neither is audited (U1 BR3.2)"
    violation: "denied, conflict or invalidated result"
    source: "FR4.4, FR5.5 (old admin adapter; the first draft's override is dropped)"
  - id: BR31.8
    statement: "A family's contribution note is written by its parents and is real; the admin notes belong to the event"
    category: authorization
    applies_to: Coordination
    trigger: "a parent saves their contribution note, or an admin saves event notes"
    logic: "IF a parent of a family with a non-removed assignment on the task saves a note (0 to 500 characters) THEN the function finds that assignment from the duty id the parent port sends and stores the note, last save wins (the parent port has no version); the note persists across sessions and is readable by the family's parents and admins in reach, not by other parents; IF an admin in reach saves event notes (allergen, supply, food, each 0 to 300 characters) with the event's version THEN the notes are stored on the event, a stale version gives VERSION_CONFLICT, and the admin save-notes action stops being faked"
    violation: "denied or conflict result"
    source: "FR4.4, FR5.5 (ported from canEditContribution and the admin notes action)"
  - id: BR31.9
    statement: "Allergen notes are visible to the assigned family and to admins in reach only"
    category: authorization
    applies_to: Coordination
    trigger: "a task detail is read"
    logic: "IF the reader's family holds a non-removed assignment on the task, OR the reader is an admin who reaches the task's group, THEN the allergen note of the task's event is returned in the detail; OTHERWISE the field is left out (parents of other families and teachers do not get it); a task without an event has no allergen note"
    violation: "the field is absent"
    source: "FR5.3 (ported from canViewAllergen)"
  - id: BR31.10
    statement: "Coordination changes are atomic and leave a marked place for U4's notifications"
    category: constraint
    applies_to: Coordination
    trigger: "a use case of Coordination changes data"
    logic: "IF a use case changes data THEN all its changes (and the audit event for decisions, BR31.5) happen in one transaction or none do; U3 creates no notification records and no outbox table: the code keeps one exported list of the use cases that U4 must connect to notifications (sign-up result, swap request, swap confirmation, decision, cancellation request, archive withdrawal), and a unit test asserts that the list names exactly the use cases that change a family's assignments, so a new use case cannot be added without deciding about its notification; U4 adds the notification writes inside these same functions"
    violation: "the whole transaction is rolled back"
    source: "FR4.4, ADR-009 (U4 owns notifications)"
  - id: BR31.11
    statement: "A parent sees a task as available, full, ineligible, assigned, swap-pending or cancellation-pending, for their own family"
    category: calculation
    applies_to: "Coordination (kernel use cases duty.list and duty.get)"
    trigger: "a parent lists or opens tasks"
    logic: "IF the family has a non-removed assignment on the task THEN the state is assigned, or swap-pending when the assignment is swap_pending, or cancellation-pending when it is cancellation_pending, each with the assignment id and version; ELSE IF the family has no active membership in the task's group THEN ineligible; ELSE IF the taken places are at capacity THEN full; ELSE available; the list contains the tasks of the family's groups plus tasks the family is assigned to, and the empty state when nothing qualifies; the detail returns title, due time, location, state, version, assignment id, the allergen note (BR31.9) and the family's own contribution note; a mapping test covers every state"
    violation: "none: this is a read"
    source: "FR4.1, FR5.1 (ported from the parent adapter; pending states from the screens' pendingRequests)"
  # ---------------- BR32: kernel use cases, adapters and screens ----------------
  - id: BR32.1
    statement: "The database adapters implement the existing ports; the screens change only where a rule says so"
    category: constraint
    applies_to: "ApplicationKernel, all U3 blocks"
    trigger: "U3's adapters are built"
    logic: "IF the adapters for the parent, admin and teacher-schedule ports and the session gateway are built THEN each existing operation (listDuties, getDuty, signUp, requestSwap, requestCancellation, updateOwnContribution, the admin operations records.*, tasks.*, assignments.assign, approvals.*, notes.save, dashboard.get, settings.* and the schedule read) calls one named database function (the port-to-function table is in functional-spec.md, and U3 adds each function to the elevated catalogue) and returns the same result states and codes as today (the code table in BR32.8); the owner approved screen changes in answers Q6 and Q7, listed in BR32.7, and in nothing else: the other screens call the same facades and stay the same"
    violation: "a contract test fails and blocks the unit"
    source: "FR4.1 (changed by answers Q6 and Q7)"
  - id: BR32.2
    statement: "The signed-in parent's family comes from the database, not from constants"
    category: constraint
    applies_to: "ApplicationKernel, Directory"
    trigger: "a parent action runs"
    logic: "IF a parent acts THEN the family id is the family of the Parent linked to the session's account (an account with no linked parent, or whose family is archived, gets the denied result with the no-family message); the old constants (the fixed family id, the fixed parent id, the local parent login and the test-copies switch) are removed from the code paths U3 owns"
    violation: "denied result"
    source: "FR2.8"
  - id: BR32.3
    statement: "Accepting an invitation for a parent links the parent in the same transaction"
    category: constraint
    applies_to: "ApplicationKernel, Identity, Directory, Access (kernel use case invitation.accept_parent)"
    trigger: "an invitation with a target parent is accepted"
    logic: "IF U2's acceptance runs for an invitation of role parent with a target_id (the invitations table has no target_type; the family is the invitation's scope) THEN the kernel use case creates the account, the grant with its version, sets the Parent's account_id and does it all in one transaction (ADR-004 and ADR-011: the kernel owns this cross-block write); IF the target parent is archived, missing, or not in the family named by the invitation's scope THEN the acceptance is refused, the 'accepting' reservation is released back to pending and the invitation stays pending; the same check (the target_id is a Parent of that family) is made when the invitation is created, so a wrong target is refused early; the hook left by U2 is replaced by this call"
    violation: "conflict result; nothing is created"
    source: "FR2.3, FR5.4"
  - id: BR32.4
    statement: "Expected failures are explicit results and unexpected ones are mapped once at the boundary"
    category: policy
    applies_to: ApplicationKernel
    trigger: "an adapter call fails"
    logic: "IF a function returns a business outcome THEN it is returned as a result state (success, empty, validation, denied, conflict, invalidated); IF the database is unreachable, times out or returns an unknown error THEN the adapter maps it once to the retryable or terminal failure the facades already know (a lost connection or a deadlock is retryable; anything else is terminal) without leaking database text to the screen"
    violation: "none: this is the mapping"
    source: "FR4.2"
  - id: BR32.5
    statement: "The dashboard counts are real"
    category: calculation
    applies_to: "ApplicationKernel (kernel use case dashboard.get)"
    trigger: "an admin opens the dashboard"
    logic: "IF an admin opens the dashboard THEN it shows, for their reach, the number of open approvals (swap and cancellation requests open) and the open import conflicts (the model has exactly these two counts); the import conflict count is read through a function that returns zero until U4 creates import records, and a test marks that link as unfinished"
    violation: "none: this is a read"
    source: "FR4.4"
  - id: BR32.6
    statement: "Every access to U3 data is covered by a policy test per role and every U3 function is in the elevated catalogue"
    category: constraint
    applies_to: "Directory, Coordination, Settings, ApplicationKernel"
    trigger: "U3's tables and functions are created"
    logic: "IF a table or function is created THEN a database test proves, for each role (parent of the family, co-parent of the family, parent of another family, teacher of the group, teacher of another group, group admin of the group, group admin of another group, super admin, signed-out request, deactivated account), what it can read and change, including every read path that touches ParentContact, notes and the schedule; every U3 function is added to U2's elevated-function catalogue with its allowed roles and its reason (for example: swap.candidates and schedule.get show other families' display names; duty.sign_up reads Directory memberships)"
    violation: "the policy or catalogue test fails and blocks the unit"
    source: "FR3.3, FR3.4, NFR1"
  - id: BR32.7
    statement: "The owner-approved screen changes are limited to the swap flow and the admin forms"
    category: constraint
    applies_to: WebApp
    trigger: "U3's screens are built"
    logic: "IF the swap flow and admin forms are built THEN: the parent swap page offers a list of partner tasks from swap.candidates and sends the chosen assignment and its version instead of the fixed placeholder (the parent port's requestSwap gains a counterpart version beside the existing expectedVersion, and a new respondToSwap, withdrawRequest and listSwapRequests); the parent navigation gets a link to the new page; U3 also adds the respond and withdraw actions on swap and cancellation requests to the parent row of the authorization matrix and to the role policy in `src/access` (today only create and read), with matching tests, as an owned change to U2's module; a new parent page lists swap requests addressed to the family with confirm and decline buttons (a new port operation respondToSwap and a list of incoming requests); the admin record form gains the fields its record type needs (group: school year, name; school year: dates; family: name, group and its parents (for each parent: display name, email, phone, locality, optional profile with consent), and the family's current groups with an end-membership action; child: family; task: group, event, category, capacity, start, end, location; event: group, title, location, coordinator, times); the admin assign form gains a family selector; the admin notes form edits the three event notes; every new screen is Hungarian, keyboard operable and passes the automated accessibility check (WCAG 2.2 AA); no other screen text, route or behaviour changes; the existing screen tests are kept and extended; until U4's import fills the directory, parents and contact details come only from this family form, which is also where an invitation gets its target parent (the invitation form picks one of the family's parents)"
    violation: "the browser, contract or accessibility test fails and blocks the unit"
    source: "FR4.1 (answers Q6, Q7), NFR5"
  - id: BR32.8
    statement: "Every operation keeps the result states and codes the screens already map"
    category: constraint
    applies_to: "ApplicationKernel"
    trigger: "an adapter returns a result"
    logic: "IF an operation fails for a business reason THEN it returns exactly one of these: admin save, archive, assign, notes and task saves on a stale version: conflict VERSION_CONFLICT; restore of an active family: conflict RESTORE_CONFLICT; approval decided or changed: conflict APPROVAL_ALREADY_DECIDED or invalidated APPROVAL_INVALIDATED; assign: conflict ASSIGNMENT_INELIGIBLE or ASSIGNMENT_CAPACITY_FULL; settings: SETTINGS_STALE (invalidated) or SETTINGS_RECIPIENT_INVALID (conflict); parent sign-up: DUTY_VERSION_STALE (invalidated), DUTY_CLOSED, DUTY_ALREADY_ASSIGNED, DUTY_INELIGIBLE, DUTY_FULL (conflict); swap and cancellation: REQUEST_VERSION_STALE (invalidated), REQUEST_DUPLICATE, REQUEST_CONFLICT, and for swaps also DUTY_INELIGIBLE, DUTY_CLOSED, DUTY_ALREADY_ASSIGNED, SWAP_CANNOT_BE_APPLIED and SWAP_REQUEST_NOT_OPEN (conflict); lifecycle: LIFECYCLE_STALE (invalidated), LIFECYCLE_BLOCKED, LIFECYCLE_CONFIRMATION_REQUIRED (conflict); grants: GRANT_STALE (invalidated), GRANT_LAST_SUPER_ADMIN, GRANT_SELF_LOCKOUT (conflict); the new codes DUTY_CLOSED, DUTY_ALREADY_ASSIGNED, SWAP_CANNOT_BE_APPLIED, SWAP_REQUEST_NOT_OPEN and ASSIGNMENT_* are added to the screens' message tables in Hungarian; a code-by-code contract test covers the table"
    violation: "the contract test fails"
    source: "FR4.1, FR4.2"
  - id: BR32.9
    statement: "Notification and import screens stay on the old in-memory adapter until U4, with a stated interim behaviour"
    category: constraint
    applies_to: "ApplicationKernel, WebApp"
    trigger: "U3 replaces the parent and admin adapters"
    logic: "IF the parent notification screens, the import, reminders and governance operations stay on the old in-memory code until U4 THEN the parent adapter file is split: the duty, swap, cancellation and contribution code is deleted, while the notification list, mark-as-read and invitation-inspection code stays in `src/parent-web` until U4 (invitation inspection until U5, which removes the old picker); the notification page for a real parent shows the empty state instead of the old fixture data (the interim adapter returns the empty state for any actor that is not the synthetic one, instead of denied); `src/admin-advanced` keeps the import, reminders and fixtures until U4; BR34.1 lists exactly what is deleted"
    violation: "a test fails: the notification page of a real parent must render without dead links"
    source: "FR4.1, FR4.4 (review finding)"
  - id: BR32.10
    statement: "Granting and revoking roles keeps U2's rules and refuses an admin removing their own grant"
    category: authorization
    applies_to: "ApplicationKernel, Access (governance port)"
    trigger: "the governance screen revokes or changes a grant"
    logic: "IF the governance operation runs THEN it calls U2's grant functions (which already refuse removing the last super admin) and in addition refuses an admin changing their own grant with the conflict GRANT_SELF_LOCKOUT; a stale grant gives GRANT_STALE; the role change takes effect on the next request (U2 BR2.7)"
    violation: "conflict or invalidated result"
    source: "FR5.5 (old governance rules, see ledger D29)"
  # ---------------- BR33: teacher schedule ----------------
  - id: BR33.1
    statement: "A teacher sees only the schedule of groups granted to them"
    category: authorization
    applies_to: "Coordination (kernel use case schedule.get)"
    trigger: "a teacher opens the schedule"
    logic: "IF the actor holds a teacher, group admin or super admin grant that reaches the group THEN the schedule of that group is returned; OTHERWISE denied with the message Nincs jogosultság; the schedule never returns contacts, notes or people's ids (BR30.5)"
    violation: "denied result"
    source: "FR5.3, FR6.1"
  - id: BR33.2
    statement: "The schedule filter keeps today's rules"
    category: validation
    applies_to: "Coordination, ApplicationKernel (the check lives in the teacher facade)"
    trigger: "a teacher sets or changes the date filter"
    logic: "IF both dates are given THEN each must be a real calendar date (31 February is refused), the start must not be after the end and the range at most 31 days; IF only one date is given THEN it is a one-sided limit; IF no date is given THEN there is no limit; the live check stays in the teacher facade (code VAL-DATE-RANGE) and the same rule is repeated inside schedule.get; an invalid filter returns validation with the message Érvénytelen dátumszűrő."
    violation: "validation result; nothing is read"
    source: "FR6.1 (ported from the tracking model and the teacher facade)"
  - id: BR33.3
    statement: "The schedule lists tasks with who is responsible, and says so when empty"
    category: calculation
    applies_to: Coordination
    trigger: "the schedule function runs"
    logic: "IF there are tasks of the group in the range THEN each entry has the fields of the TeacherSchedule model in entities.md (start, end, title, location, coordination name, owner, assignees, status label), ordered by start time; IF none THEN the empty state is returned; an unexpected database error returns the terminal failure"
    violation: "none: this is a read"
    source: "FR6.1"
  # ---------------- BR34: carry-over ----------------
  - id: BR34.1
    statement: "Every rule of the old modules has a recorded disposition and the replaced code is removed afterwards"
    category: policy
    applies_to: "all U3 blocks"
    trigger: "U3's code is complete"
    logic: "IF a rule in the old code appears in the ledger below THEN it is kept (with the rule that now holds it and the test that proves it), moved to a later unit, or dropped with a reason; when all rows of a module are proven, that module's code and tests are deleted: `src/directory`, `src/coordination`, `src/parent-experience`, `src/teacher-tracking`, `src/teacher-web`, `src/admin-core`, `src/privacy-audit` and the duty, swap, cancellation and contribution parts of `src/parent-web`; the tests that proved the rules are rewritten against the database; `src/access` is dealt with by U2's record; `src/notifications`, `src/import-migration`, `src/admin-advanced` (import and reminders), the notification part of `src/parent-web` and `src/admin-experience` stay until U4 and U5"
    violation: "the unit's verification blocks when a ledger row has no proof"
    source: "FR4.3, ADR-008"
  # ---------------- BR35: lifecycle ----------------
  - id: BR35.1
    statement: "A family becomes a lifecycle candidate only after leaving, a grace period and with no hold"
    category: policy
    applies_to: "PrivacyAudit, Directory (kernel use case lifecycle.run; the list is a computed read, not a table)"
    trigger: "an admin opens the lifecycle list"
    logic: "IF a family is archived (its archived_at is the date it left) THEN it is listed with its state: eligible-delete when it has no assignment row of any status, eligible-anonymize when it has at least one, and blocked (with a blocker summary) when it left less than 30 days ago (grace period) or when an open lifecycle hold from U1 exists on the family (a family restored after leaving is no longer archived and so is no longer listed; the old 'enrolled sibling' blocker cannot occur because archiving archives all children, so it is dropped, see ledger D30); the list can be filtered by state and returns the empty state when nothing qualifies; super admins see all, group admins see none (lifecycle is a super admin action)"
    violation: "denied result for others"
    source: "FR3.5, FR4.3 (ported from the old lifecycle service and advanced adapter)"
  - id: BR35.2
    statement: "Running the lifecycle for a family needs confirmation and deletes or anonymizes in one transaction with its audit event"
    category: policy
    applies_to: "PrivacyAudit, Directory, Coordination"
    trigger: "a super admin runs the lifecycle for a candidate"
    logic: "IF the candidate version is stale THEN LIFECYCLE_STALE (invalidated); IF it is blocked THEN LIFECYCLE_BLOCKED (conflict) and one lifecycle deferred note is kept in the function result (no audit action exists for it in U1's list); IF the request lacks confirmation THEN LIFECYCLE_CONFIRMATION_REQUIRED (conflict); OTHERWISE in one transaction: eligible-delete removes the family, its parents, contacts, children and memberships; eligible-anonymize deletes contacts, optional profiles and memberships, empties contribution note text and change-request reason text, clears the parents' account links, replaces the parents' and children's names and the family name with an anonymous label and keeps assignments as history; the parents' sign-in accounts are deactivated through U2's function; one audit event lifecycle.delete or lifecycle.anonymize is written with the family id; the old rule that audit events older than 365 days without an investigation hold are purged is carried by U1's retention rules and is not repeated here"
    violation: "invalidated or conflict result; nothing is changed"
    source: "FR3.5, FR4.3 (ported from the old lifecycle service)"
```

## Summary

| Group | Rules |
|---|---|
| Directory structure, people, contact privacy, archive, settings | BR30.1 to BR30.10 |
| Events, tasks, sign-up, swaps, cancellations, notes, atomicity, task states | BR31.1 to BR31.11 |
| Kernel use cases, family from the database, invitation link, failures, dashboard, policy tests, screens, codes, interim behaviour, grants | BR32.1 to BR32.10 |
| Teacher schedule | BR33.1 to BR33.3 |
| Carry-over of the old rules | BR34.1 |
| Lifecycle | BR35.1, BR35.2 |

## Rule Disposition Ledger (ADR-008)

Status: **kept** (a U3 rule holds it), **changed** (kept in another shape, reason given), **moved** (belongs to another unit), **dropped** (reason given). Proof is the test class the code-generation plan must write.

| # | Old rule (where) | Status | Now held by | Proof |
|---|---|---|---|---|
| D1 | Only admins whose grant covers the family or a child's group can change a family (directory service) | kept | BR30.1 | policy test per role |
| D2 | Save family in one transaction (directory) | changed | BR30.2 (no audit event for ordinary edits, per U1 BR3.2) | atomicity and idempotency tests |
| D3 | Linking a parent twice, by id or by account, is refused (directory) | kept | BR30.3 | unique-link race test |
| D4 | Optional profile only with consent; admins only see it with consent (directory, projection) | changed | BR30.4 (the parent's own view added) | consent test |
| D5 | A child's group must be in the same organization; duplicate child refused (directory) | kept | BR30.6 | cross-organization test |
| D6 | Group assigned per child with a school year (directory) | changed | BR30.6 (family membership; school year from the group) | membership test; decision recorded in the domain design |
| D7 | Archive and restore with audit; visibility recalculated (directory) | changed | BR30.7 (visibility is a policy, so nothing to recalculate; no audit event, per U1 BR3.2) | archive cascade test |
| D8 | Archived family is invisible; non-admins see parent names only, no contacts; admins see contacts (directory view) | changed | BR30.5, BR30.8 (parents see their own family's contacts, answer Q8) | read-path matrix test |
| D9 | Sign-up needs family visibility, matching task version, free capacity (coordination) | kept | BR31.2 (check order fixed; closing and duplicate rules added by Q2, Q4) | sign-up tests, race test |
| D10 | Swap applied when both families confirmed, otherwise admin pending; the other family confirms by calling the same request (coordination) | changed | BR31.4, BR31.5 (explicit swap.request and swap.respond with new screens, answers Q1, Q6) | swap tests |
| D11 | Admin decision on a pending swap or cancellation, within the admin's scope (coordination) | kept | BR31.5 | scope test |
| D12 | Cancellation request moves the assignment to cancellation pending (coordination) | kept | BR31.6 | cancellation test |
| D13 | Contribution edit and allergen view rights (coordination) | kept | BR31.8, BR31.9 | policy tests |
| D14 | Events published and audit written on change (coordination) | changed | BR31.10 (published events become U4's notification link, marked by a test; audit only for decisions) | marker test |
| D15 | Retryable conflict error for a stale or full task (coordination) | changed | BR31.2, BR32.4, BR32.8 (explicit result states) | result-state tests |
| D16 | Tracking date range rules: real dates, order, at most 31 days; optional one-sided limits (teacher-tracking) | kept | BR33.2 | filter tests |
| D17 | Explicit field projection of schedule rows (teacher-tracking) | kept | BR33.1, BR33.3 | schedule shape test |
| D18 | Scope mismatch and duplicate row ids give failures (teacher-tracking) | dropped | the function cannot return another group's rows or duplicate task ids; the policy test covers scope | reason recorded; policy test |
| D19 | Teacher read needs a schedule grant for the group (teacher-tracking, teacher adapter) | kept | BR33.1 | policy test |
| D20 | Duty states available, full, ineligible, assigned, swap-pending, cancellation-pending; stale version, full, ineligible, already assigned, duplicate and stale request codes (parent adapter) | kept | BR31.11, BR31.2, BR31.4, BR32.8 | code-by-code contract test |
| D21 | Parent must own the family (parent adapter) | kept | BR32.2, BR30.8 | policy test |
| D22 | Fixed family id, fixed parent id, local parent login, test-copies switch, scenario names such as duty-retry (parent adapter) | dropped | synthetic fixtures; FR2.8 removes constants; failures are tested with injected database errors instead | search test that the constants are gone |
| D23 | Notification list and mark-as-read (parent adapter, notification context) | moved | U4 (notifications); interim behaviour in BR32.9 | U4 ledger; page test |
| D24 | Admin records list, get, save, archive, restore with version check and restore conflict (admin core adapter) | kept | BR30.2, BR30.7, BR32.8 | admin operation tests |
| D25 | Admin tasks list and save, assign (with ineligible and full conflicts), approvals list and decide, notes save (admin core adapter) | kept | BR31.1, BR31.5, BR31.7, BR31.8 | admin operation tests |
| D26 | Dashboard counts (admin core adapter) | changed | BR32.5 (real counts) | dashboard test |
| D27 | Scenario-driven failures and the invalidated or recovery fixtures (admin core adapter) | dropped | synthetic scenarios; replaced by real conflicts and injected errors | none needed |
| D28 | Settings get and save with stale and invalid-recipient codes (advanced adapter) | kept | BR30.10 | settings tests |
| D29 | Governance: grant revoke with stale, last super admin and self-lockout codes (advanced adapter) | changed | BR32.10 (U2's grant functions plus the self-lockout check) | governance tests |
| D30 | Lifecycle list and run with stale, blocked and confirmation codes; 30-day grace, enrolled sibling, re-enrolled and hold deferrals; anonymize or delete (advanced adapter, privacy-audit service) | kept | BR35.1, BR35.2 (re-enrolled becomes "restored, so no longer archived"; enrolled sibling is dropped because archiving archives all children) | lifecycle tests |
| D31 | Audit purge after 365 days without a hold (privacy-audit service) | moved | U1's retention and hold rules (BR3.5, BR3.9) | U1 record |
| D32 | Import and reminder operations (advanced adapter, import-migration, notifications) | moved | U4 | U4 ledger |
| D33 | Teacher adapter facade over the schedule (teacher adapter) | changed | BR32.1 (same port, database adapter) | contract test |
| D34 | Parent read model of duties and notes (parent-experience) | kept | BR31.11, BR31.8 | read model tests |
| D35 | Admin shell (admin-experience) | moved | U5 (screens and shell clean-up) | U5 ledger |
| D36 | Access matrix, role policy, legacy role conversion (access) | moved | already carried by U2 | U2 record |

Risks recorded: the unit is the largest, so the design is split by block and the code plan builds Directory and Settings before Coordination; the new swap and admin-form screens are the first screen changes since the demo, so they carry their own browser and accessibility tests; co-parent contact visibility (answer Q8) goes beyond the domain design's ADR-010 and is recorded as an owner decision; ledger rows D23, D32 and D35 depend on U4 and U5 closing them.
