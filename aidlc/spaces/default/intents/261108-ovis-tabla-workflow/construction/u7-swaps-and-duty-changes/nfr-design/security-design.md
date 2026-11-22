# Security Design: u7-swaps-and-duty-changes

Sources: `security-requirements.md`, `tech-stack-decisions.md` of this Unit, `functional-spec.md` and `rules.md` (BR70 to BR77), and C1, C5, C6, C8, C10, C11 and C16 in `contract-summary.md`. Contains no names or contact details.

## Defence in Depth

| Layer | Control |
|---|---|
| Database role | Every command is a named function that starts with `revoke all` and an explicit `grant execute`, and pins its search path (NFR3.6). `change_requests` loses its direct read as well: today it has `grant select` to signed-in accounts and the policy `change_requests_read` (20261026), which lets anyone reaching the source duty's group, or a parent of the source family, read whole rows including `reason`. This Unit's migration drops that policy and revokes `select` on `change_requests` from `authenticated`, so the table is read only through the functions of this block (NFR1.3). The one direct reader today, the approvals list in `src/data/admin-tasks.ts`, moves to a new read `cancellation_list` (BR70.2 reach, reason included). A test selects from the table as each signed-in role and gets a permission error. |
| Function check | Each function checks the caller itself with the existing helpers (active session, `directory_actor_family`, `has_super_scope`, `has_core_scope`), so a direct call gets the same answer as a screen (NFR3.1). |
| Internal functions | `place_add`, `place_exchange`, `place_reassign`, `place_release`, `rota_check_change`, `rota_adjust_picks_after_change`, `dutychanges_swap_expiry_check` and the removal pair have no grant to any signed-in role (NFR3.5). |
| Application layer | `authorization.ts`, `role-policy.ts`, navigation and `verification/authorization-matrix.json` gain the new commands and lose `swap_decide`; each new screen is walked through for every role (parent, group admin, super admin, teacher, signed out) with the result in the Unit's test results (NFR3.8). |

## Authorization Design

| Command | Who is allowed | Everyone else |
|---|---|---|
| `swap_candidates`, `swap_request`, `swap_withdraw` | A parent of the family that holds the source place (BR70.1) | Denied |
| `swap_respond` | A parent of the target family | Denied |
| `swap_incoming` | A parent; returns the family's own requests only | Signed out is sent to sign-in |
| `cancellation_request` | A parent of the family that holds the place | Denied |
| `duty_reassign`, `swap_reverse`, `cancellation_decide` on a rota duty | Super admin (BR70.2) | Denied, including working-group admins (NFR3.3) |
| The same on a manual or event duty | An admin who reaches the duty's group; for a reversal, both duties' groups | Denied |
| `swap_list` | Super admin for the community; a group admin for their groups' non-rota swaps | Denied |
| `swap_decide` | Nobody: the grant is revoked (NFR3.4) | Any call fails |

- **Rota duty test.** "Rota duty" is decided inside each function from the duty's `origin_kind` (`rota_week` or `weekend_slot`), never from the caller's input.
- **Same answer for real and made-up ids (NFR3.2).** The request is looked up and the caller tested in one condition; "not yours" and "does not exist" return the same denied refusal. This changes today's behaviour: the kernel swap functions answer a missing request or place with `validation` / `request_not_found` or `place_not_found`. The rewritten `swap_respond`, `swap_withdraw`, `swap_reverse`, `cancellation_decide`, `swap_request` and `cancellation_request` answer `denied` / `authorization_denied` instead, and the screens' handling of `request_not_found` is replaced by the denied state; the kernel tests that assert the old code are updated in the same pull request.
- **A swap with one rota duty and one other duty.** It counts as a rota swap for `swap_list`, `swap_reverse` and the reason: only a super admin sees it, reverses it and reads its reason. A group admin's `swap_list` shows only swaps whose both duties are non-rota duties of groups they reach.
- **Rights lost while signed in (NFR3.7).** Nothing about rights is cached; each function re-reads the account's family, role and the family's standing (C10), so the next command after a change is refused.
- **Teachers.** A teacher has no current family and no admin scope, so every command answers denied.

## Repeated-Click Keys (NFR3.9)

Every command looks up its key first, before its own checks and before any change, using the existing platform idempotency lookup. Its record is unique by account, operation and key and stores a fingerprint of the inputs, so:

- the same account repeating the same command with the same inputs gets the stored result (replayed);
- the same account sending different inputs with a used key gets the existing mismatch refusal;
- another account using the same key has no record of its own, so its command runs fresh under its own checks and never sees the first account's result.

The operation names are fixed per command (for example `swap.request`, `swap.respond`, `duty.reassign`). No command of this Unit keeps a key store of its own. Every command ends through `platform_finish_operation`, which stores the result for successes and denials. Because the stored result keeps only the state and the reference, a replayed `swap_respond` reads the request (the reference) and returns its current status as `outcome` (applied or rejected), so the screen shows the same answer as the first click. Tests cover all three cases for one command, the replay case for every command, and the outcome of a replayed acceptance and decline.

## Data Protection Design

- **Display names only (NFR1.2).** The reads build their JSON from an explicit field list: request id, kind, status, ended reason, both duties' title, kind and start, both families' display names through C6, the reason where BR70.3 allows it, versions, and the times. No contact detail, child's name or sharing choice is selected.
- **The reason (NFR1.3, NFR1.4).** Plain text, trimmed, at most 500 characters by a table check, escaped by React on output. With the table read closed (above), it is selected only in `swap_incoming` (for the two families of the request), `swap_list` and `cancellation_list` (for allowed admins). The form shows a Hungarian hint under the field that the other family and the administrators see it and that it should hold no phone number, email address or child's name. The removal block clears the reason of every request of a removed family (BR77.3).
- **Notices (NFR10.1).** The notice text comes only from this Unit's facts function `notice_facts_change_request`, which selects the two duties, their times and the other family's display name, and for `swap_requested` alone the reason, marked as the proposer's words. It reads ended requests too and returns nothing for an unknown id. A test reads each kind's output.
- **Refusal detail.** A refusal tells the proposer only that the chosen place cannot be swapped and the plain reason C10 or C11 gives about their own family or the week; it names no other family's other duties.
- **Test data (NFR1.1).** The seed, fixtures and tests use invented names; every address or number in a test is added to `scripts/verification/privacy-allowlist.json`.

## Audit Design (NFR4.1 to NFR4.3)

A reassignment, a reversal and a cancellation decision write one audit entry in the same transaction as the change, with opaque ids and the actor and no names or reason text. If the entry cannot be written the function raises and the whole change rolls back; this is tested with a temporary failing trigger on the audit table inside the test. A swap the families agree on writes no entry (NFR4.2). A repeated click writes no second entry, because the stored result is returned before anything runs. Denied attempts are audited explicitly: today's kernel swap functions return denials through `platform_abort` or a plain result and write no audit entry, so every command of this Unit ends a denial through `platform_finish_operation` with state `denied`, which writes the denied audit entry (under the existing rate limit for denied entries, 20261046) and stores the denial for the key (NFR4.3). Business refusals (`conflict`, `validation`) are not audited, as today. A test calls each command as an unauthorised account and reads one denied audit entry.

## Threat Controls

Each threat in `security-requirements.md` is covered by the control listed there, realised as above: caller check inside the function (NFR3.2), C10 and C11 asked at proposal and acceptance (BR71.4), stored versions compared under the locks (BR72.1), super scope for rota duties (NFR3.3), reason shown to the two families and admins only and cleared on removal (NFR1.3, NFR1.4), keys bound to account, command and inputs (NFR3.9), no grant on internal functions (NFR3.5), and pinned search paths (NFR3.6).
