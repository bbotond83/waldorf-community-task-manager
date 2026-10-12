# Domain Design Questions: Real backend, sign-in and seed data

The requirements are approved (with the review points still open). The existing code has an application layer (authorization, facade pipeline, ports) and four in-memory adapters that run, plus nine domain modules nobody calls. These questions settle the building blocks of the target design.

## Q1. How should the target building blocks be cut?

A. By domain area, eight blocks that mirror the existing module names and application ports: Identity (sign-in, sessions, invitations, password reset), Access (roles, grants, scopes, authorization contract), Directory (organizations, school years, groups, families, parents, children), Coordination (events, tasks, assignments, signups, swaps, cancellations, approvals, teacher schedule read model), Notifications (notification records, reminders, attempts), Import (xlsx preview, conflicts, commit), PrivacyAudit (audit log, lifecycle holds, contact visibility rules), Settings (organization and reminder settings).
B. Coarser: Core Data (Directory, Settings, Access), Workflows (Coordination, Import, Notifications), Identity, PrivacyAudit (four blocks).
C. Not yet defined; decide after looking at the options in detail.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. By domain area, eight blocks that mirror the existing module names and application ports (Identity, Access, Directory, Coordination, Notifications, Import, PrivacyAudit, Settings).

## Q2. Where does the teacher schedule live?

A. Inside Coordination as a read model over events, tasks and assignments (one owner of the data, two views).
B. As its own small block (TeacherSchedule) that reads from Coordination.
C. Not yet defined.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. Inside Coordination as a read model over events, tasks and assignments (one owner of the data, two views).

## Q3. How is the audit log written?

A. PrivacyAudit owns the audit entity; every other block records audit events through its port (one place, one shape).
B. Each block writes its own audit rows into its own tables.
C. Not yet defined.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. PrivacyAudit owns the audit entity; every other block records audit events through its port (one place, one shape).

## Q4. Who owns invitations?

A. Identity owns invitations (email, role, scope, expiry, token state) and points to the Directory person or family it is for.
B. Directory owns invitations, since they belong to a family or person.
C. Not yet defined.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. Identity owns invitations (email, role, scope, expiry, token state) and points to the Directory person or family it is for.

## Q5. Where do the seed and reset tools belong?

A. A separate Development Tooling block outside the app runtime; the app never imports it, and it refuses to run on a non-local database.
B. Inside the persistence layer, next to the migrations.
C. Not yet defined.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. A separate Development Tooling block outside the app runtime; the app never imports it, and it refuses to run on a non-local database.

## Q6. What happens to the existing application layer (authorization contract, facade pipeline with idempotency and projection guard, result states, the ports the screens call)?

A. It stays as the kernel in front of every building block, unchanged in behaviour; only the adapters behind the ports change.
B. It is simplified where the database now does the work (for example scope checks moving into row-level security), keeping only what the screens need.
C. Not yet defined.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: B. It is simplified where the database now does the work (for example scope checks moving into row-level security), keeping only what the screens need.

## Consolidated Summary Confirmation

- Building blocks: eight domain blocks that mirror the existing module names and ports: Identity, Access, Directory, Coordination, Notifications, Import, PrivacyAudit, Settings.
- Teacher schedule: a read model inside Coordination (one owner of the data, two views).
- Audit: PrivacyAudit owns the audit entity; every other block records audit events through its port.
- Invitations: Identity owns them and points to the Directory person or family.
- Seed and reset: a separate Development Tooling block outside the app runtime; the app never imports it and it refuses to run on a non-local database.
- Application layer: simplified where the database now does the work (for example scope checks moving into row-level security); what the screens need stays (result states, idempotency, projection guard), and the database policies become the source of truth for who may see what.
- Database identity: normal reads and writes run as the signed-in user so the policies apply; a short named list of elevated server-only functions covers import commit, idempotency, audit writes and invitation acceptance.
- Contact details: they move to their own table (ParentContact, owned by Directory) with an admin-in-scope policy; a parent reads only their own entry; teachers and others read none.
- Cross-block writes: one database function per use case (import commit, invitation acceptance, swap approval) runs in one transaction, audit event included; the kernel calls it; a failed invitation acceptance removes or deactivates the created sign-in user.
- First super admin: a documented one-time operator command, run from the operator's own machine with the sign-in service's admin access, creates it and records an audit event; the local-only seed is a separate path.
- Parallel tests: one shared local stack; each worker gets its own database schema with the same migrations and its own account namespace, created and reset by the tooling.

Does this all look correct before I generate the artifact?

Looks correct
Request changes

[Answer]: Looks correct

## Q7. Which database identity do the adapters use? (follow-up to Q6, from review findings R-03 and R-04)

A. Normal reads and writes run as the signed-in user, so the database policies apply; a short, named list of elevated database functions (import commit, idempotency, audit writes, invitation acceptance) runs with elevated rights on the server only.
B. Every call runs with an elevated server key and the application checks scope itself; the policies are only a second line of defence.
C. Not yet defined; decide at functional design.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. Normal reads and writes run as the signed-in user, so the database policies apply; a short, named list of elevated database functions (import commit, idempotency, audit writes, invitation acceptance) runs with elevated rights on the server only.

## Q8. How are parent contact details protected, given that a policy cannot hide a single column? (follow-up, review finding R-03)

A. Contact details move to their own table (ParentContact, owned by Directory) with an admin-in-scope policy; a parent can read only their own contact entry; teachers and everyone else read none.
B. Contact details stay on the parent row, and every list, schedule and import read goes through views that leave the contact columns out.
C. Not yet defined; decide at functional design.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. Contact details move to their own table (ParentContact, owned by Directory) with an admin-in-scope policy; a parent can read only their own contact entry; teachers and everyone else read none.

## Q9. How do writes that span several blocks stay all-or-nothing (import commit, invitation acceptance, swap approval)? (follow-up, review finding R-05)

A. One database function per use case runs the whole write in one transaction, audit event included; the kernel calls that function. Invitation acceptance first creates the sign-in user and, if the function fails afterwards, removes or deactivates that user.
B. The application keeps a unit-of-work in code and compensates step by step if a later step fails.
C. Not yet defined; decide at functional design.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. One database function per use case runs the whole write in one transaction, audit event included; the kernel calls that function. Invitation acceptance first creates the sign-in user and, if the function fails afterwards, removes or deactivates that user.

## Q10. How does the first super admin of a real (hosted) database come to exist? (follow-up, review finding R-06; the requirements review raised the same point)

A. A documented one-time operator command, run outside the app from the operator's own machine with the sign-in service's admin access, creates the first super admin and records an audit event. The seed (local only) is a separate path.
B. Out of scope for this work: recorded as an open item for the hosted step.
C. Not yet defined.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. A documented one-time operator command, run outside the app from the operator's own machine with the sign-in service's admin access, creates the first super admin and records an audit event. The seed (local only) is a separate path.

## Q11. What is the isolation unit for parallel tests, given that the sign-in service is one shared service with one user table? (follow-up, review finding R-07)

A. One shared local stack; each test worker gets its own database schema with the same migrations and its own account namespace (for example worker-specific email addresses), created and reset by the tooling.
B. One complete local stack per worker (separate sign-in service, database and ports).
C. Not yet defined; decide at infrastructure design.
D. Not applicable.
E. Not identified.
X. Other (please specify)

[Answer]: A. One shared local stack; each test worker gets its own database schema with the same migrations and its own account namespace (for example worker-specific email addresses), created and reset by the tooling.
