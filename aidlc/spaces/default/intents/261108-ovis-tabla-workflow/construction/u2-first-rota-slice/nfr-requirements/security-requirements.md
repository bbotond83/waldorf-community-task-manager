# Security Requirements: u2-first-rota-slice

Sources: `functional-spec.md` and `rules.md` of this Unit, NFR1, NFR3 and NFR4 in `requirements.md`, contracts C1, C4, C5 and C18 in `contract-summary.md`, and `technology-stack.md`. Contains no names or contact details.

## Authentication

Sign-in, sessions and password rules do not change. A signed-out visitor receives no rota data and is sent to sign-in.

## Authorization Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR3.1 | Every new read and write checks the caller on the database side: the calendar and rota commands are super admin only (BR20.2); the overview and duty card follow the reach rules (BR24.1 to BR24.3). | Database tests acting as real roles and accounts pass for each rule. |
| NFR3.2 | A parent, teacher or working-group administrator is refused every calendar, draft, adjust, discard and publish command, including by calling the function directly. | The fixed-list "out of reach" test passes for every command. |
| NFR3.3 | A draft is visible to super admins only (BR22.5). A parent's overview shows the nothing-published state whether or not a draft exists, and the planning functions refuse a parent without revealing whether a draft exists. | A parent reading the overview with a draft present gets the same result as with none; a parent calling a planning function gets the same refusal for an existing and a made-up plan. |
| NFR3.4 | A rota duty is reached as a community-wide duty: every active parent may read it, a teacher reads it on the schedule, and no group administrator manages it (U1 reach rules). | Reach tests for a super admin, a group administrator, a parent and a teacher. |
| NFR3.5 | Today's change functions refuse a rota duty with DUTY_ROTA_MANAGED, for every role (BR25.1). | A test calls each refused function on a rota duty. |
| NFR3.6 | Signed-in accounts keep read-only table rights. Every new function starts with `revoke all` and an explicit `grant execute`, pins its search path, and grants no table write right (BR27.1, BR27.2). | The catalogue test lists each new function's grants. |
| NFR3.7 | `verification/authorization-matrix.json` gains rows for the calendar, rota, overview and duty card for every role, and every new screen is walked through for every role. | Evidence is in the Unit's test results before merge. |

## Data Protection

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR1.1 | The seed, fixtures and tests use invented families and people only. | Secret scanning and the privacy check stay green. |
| NFR1.2 | A parent sees family display names on the rota overview but no contact detail of another family. | A test asserts the exact fields the overview returns. |
| NFR1.3 | The publishing notice names only the receiving parent's own family's weeks (Q5) and no other family. | A test reads each notice after a publish. |
| NFR1.4 | The audit events for publishing and discarding carry opaque ids, no name or contact detail. | A test reads the events. |

## Audit

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.1 | Publishing writes one `rota.publish` event and discarding writes one `rota.discard` event, each with the plan and the actor (BR23.5). | A test reads the event after each command. |
| NFR4.2 | A repeated click writes no second event. | The "repeated click" test counts events. |
| NFR4.3 | Denied attempts are audited as they are today, under the existing rate limit. | The existing denied-audit tests pass. |

## Threat Considerations

| Threat | Control |
|---|---|
| A parent or group administrator calls a rota command directly | The database checks the caller inside each function (NFR3.2) |
| A rota duty is edited through the old task form and breaks the one-family-per-week link | DUTY_ROTA_MANAGED on every change function until U7 (NFR3.5) |
| A draft leaks to parents before publishing | Drafts are read by super admins only (NFR3.3) |
| A parent reads another family's weeks from the notice | The notice lists only the receiver's own weeks (NFR1.3) |
| A function running with raised rights is steered to another schema | Every function pins its own schema (NFR3.6) |
