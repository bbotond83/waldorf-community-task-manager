import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  CO_PARENT_F1,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  nextKey,
  openDirectoryDatabase,
  OTHER_ADMIN,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  SIGNED_OUT,
  SUPER_ADMIN,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import { asActor, authenticated, failureOf } from "./identity-support.ts";
import { ROTA_FAMILIES, setChangeover, setStanding } from "./rota-full-support.ts";
import {
  auditOf,
  noticesOf,
  PLACE_AG1_T2,
  PLACE_F1_T1,
  PLACE_F2_T3,
  placeRow,
  refused,
  requestRow,
  requestVersion,
  seedSwapWorld,
  setStart,
  swapCalls,
  TASK_1,
  TASK_3,
} from "./swaps-support.ts";

/**
 * Proposing, answering and withdrawing a swap, and asking to cancel (W1 to W3; BR70.1, BR71.1 to BR71.5, BR72.1,
 * BR72.4, BR72.5, BR73.1, BR76.1, BR77.2; NFR1, NFR3.2, NFR3.9, NFR4.3). Each rule has the fixed list: allowed, refused,
 * out of reach, outdated screen and repeated click. The two-at-once cases are in swaps-races.test.ts.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`swap proposals and answers in ${schema}`, () => {
    let db: pg.Client;
    let calls: ReturnType<typeof swapCalls>;

    before(async () => {
      db = await openDirectoryDatabase(schema);
      calls = swapCalls(db, schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedSwapWorld(db, schema);
    });

    /** A request made by the first family to the second, ready to answer. */
    async function openRequest(reason: string | null = "Időpont-ütközés") {
      const made = await calls.request(PARENT_F1, PLACE_F1_T1, PLACE_F2_T3, { reason });
      assert.equal(made.state, "success", JSON.stringify(made));
      return String(made.reference);
    }

    // ------------------------------------------------------------------ the partner list (BR77.2)
    it("lists the other families' places of any kind with the duty, its time and the family name, and nothing else", async () => {
      const result = await calls.candidates(PARENT_F1, PLACE_F1_T1);
      assert.equal(result.state, "success");
      const items = result.items as Record<string, unknown>[];
      assert.deepEqual(
        items.map((i) => i.assignment_id).sort(),
        [PLACE_AG1_T2, PLACE_F2_T3].sort(),
      );
      for (const item of items) {
        assert.deepEqual(Object.keys(item).sort(), [
          "assignment_id",
          "assignment_version",
          "category",
          "family_display_name",
          "starts_at",
          "task_id",
          "title",
        ]);
      }
      const dated = await calls.candidates(PARENT_F1, PLACE_F1_T1, "2000-01-01", "2000-01-02");
      assert.deepEqual(dated.items, []);
    });

    it("refuses the list for a place that is not the caller's family's, a made-up one and a caller with no family, alike", async () => {
      for (const [account, place] of [
        [PARENT_F2, PLACE_F1_T1],
        [PARENT_F1, uuid(424242)],
      ] as const) {
        refused(await calls.candidates(account, place), "denied", "authorization_denied");
      }
      refused(await calls.candidates(TEACHER_G1, PLACE_F1_T1), "denied", "no_family");
      refused(await calls.candidates(SIGNED_OUT, PLACE_F1_T1), "denied", "session_inactive");
    });

    it("refuses the list for a place already in a request and for a duty that has started", async () => {
      await openRequest();
      refused(await calls.candidates(PARENT_F1, PLACE_F1_T1), "conflict", "REQUEST_DUPLICATE");
      await setStart(db, TASK_3, "-1 hour");
      refused(await calls.candidates(PARENT_F2, PLACE_F2_T3), "conflict", "REQUEST_DUPLICATE");
    });

    // ------------------------------------------------------------------ proposing (BR71.1, BR71.5)
    it("stores the request with both families, duties, the versions after the pending mark and the trimmed reason, and tells the other family", async () => {
      const before1 = await placeRow(db, PLACE_F1_T1);
      const before2 = await placeRow(db, PLACE_F2_T3);
      const made = await calls.request(PARENT_F1, PLACE_F1_T1, PLACE_F2_T3, {
        reason: "  Időpont-ütközés  ",
      });
      assert.equal(made.state, "success", JSON.stringify(made));
      const after1 = await placeRow(db, PLACE_F1_T1);
      const after2 = await placeRow(db, PLACE_F2_T3);
      assert.deepEqual([after1.status, after2.status], ["swap_pending", "swap_pending"]);
      assert.equal(made.assignment_version, after1.version);
      const row = await requestRow(db, String(made.reference));
      assert.equal(row.status, "open");
      assert.equal(row.reason, "Időpont-ütközés");
      assert.deepEqual(
        [row.source_family_id, row.target_family_id, row.source_task_id, row.target_task_id],
        [FAMILY_1, FAMILY_2, TASK_1, TASK_3],
      );
      assert.deepEqual(
        [row.source_assignment_version, row.target_assignment_version],
        [after1.version, after2.version],
      );
      assert.ok(after1.version > before1.version && after2.version > before2.version);
      assert.equal((await noticesOf(db, PARENT_ROW_F2, "swap_requested")).length, 1);
      assert.equal((await noticesOf(db, PARENT_ROW_F1, "swap_requested")).length, 0);
      assert.deepEqual(
        await auditOf(db, "swap.denied"),
        [],
        "a swap the families agree on writes no audit entry",
      );
    });

    it("stores an empty or blank reason as nothing and refuses a reason over 500 characters", async () => {
      const blank = await calls.request(PARENT_F1, PLACE_F1_T1, PLACE_F2_T3, { reason: "   " });
      assert.equal(blank.state, "success");
      assert.equal((await requestRow(db, String(blank.reference))).reason, null);
      await calls.withdraw(PARENT_F1, String(blank.reference));
      const long = await calls.request(PARENT_F1, PLACE_F1_T1, PLACE_F2_T3, {
        reason: "x".repeat(501),
      });
      assert.deepEqual(
        [long.state, long.code, long.field],
        ["validation", "field_invalid", "reason"],
      );
      assert.equal((await placeRow(db, PLACE_F1_T1)).status, "active");
    });

    it("refuses an exchange with the same family, a duty already held, a started duty and a place already in a request", async () => {
      await db.query(
        "insert into assignments (organization_id, task_id, family_id, source) values ($1, $2, $3, 'admin_assign')",
        [
          (await placeRow(db, PLACE_F1_T1)).family_id && "aaaaaaaa-0000-4000-8000-000000000001",
          TASK_3,
          FAMILY_1,
        ],
      );
      refused(
        await calls.request(PARENT_F1, PLACE_F1_T1, PLACE_F2_T3),
        "conflict",
        "DUTY_ALREADY_ASSIGNED",
      );
      await db.query("delete from assignments where task_id = $1 and family_id = $2", [
        TASK_3,
        FAMILY_1,
      ]);
      await setStart(db, TASK_3, "-1 hour");
      refused(await calls.request(PARENT_F1, PLACE_F1_T1, PLACE_F2_T3), "conflict", "DUTY_CLOSED");
      await setStart(db, TASK_3, "12 days");
      const id = await openRequest();
      refused(
        await calls.request(PARENT_F1, PLACE_F1_T1, PLACE_F2_T3),
        "conflict",
        "REQUEST_DUPLICATE",
      );
      refused(
        await calls.request(PARENT_F2, PLACE_AG1_T2, PLACE_F1_T1),
        "denied",
        "authorization_denied",
      );
      assert.equal((await requestRow(db, id)).status, "open");
    });

    it("refuses an exchange that the changeover rule forbids with the reason for the caller's own family only (BR71.4)", async () => {
      await setChangeover(db, "2027-02-01");
      await setStanding(db, schema, FAMILY_2, "leaving");
      // The second family is leaving after the changeover date, so it cannot receive a duty that starts after it.
      await db.query(
        "update tasks set starts_at = '2027-03-01T10:00:00Z', ends_at = '2027-03-01T12:00:00Z' where id = $1",
        [TASK_1],
      );
      const own = await calls.request(PARENT_F2, PLACE_F2_T3, PLACE_F1_T1);
      assert.deepEqual(
        [own.state, own.code, own.reason],
        ["conflict", "DUTY_INELIGIBLE", "leaving_after_changeover"],
      );
      const other = await calls.request(PARENT_F1, PLACE_F1_T1, PLACE_F2_T3);
      assert.deepEqual(
        [other.state, other.code, other.reason],
        ["conflict", "DUTY_INELIGIBLE", undefined],
      );
      assert.equal((await placeRow(db, PLACE_F1_T1)).status, "active");
    });

    it("refuses forged and invalid requests: a place that is not the caller's, a made-up place, a place of another community, missing inputs", async () => {
      refused(
        await calls.request(PARENT_F2, PLACE_F1_T1, PLACE_F2_T3),
        "denied",
        "authorization_denied",
      );
      refused(
        await calls.request(PARENT_F1, uuid(424242), PLACE_F2_T3, { sourceVersion: 1 }),
        "denied",
        "authorization_denied",
      );
      refused(
        await calls.request(PARENT_F1, PLACE_F1_T1, uuid(424242), { targetVersion: 1 }),
        "validation",
        "assignment_not_found",
      );
      refused(
        await calls.request(PARENT_F1, PLACE_F1_T1, PLACE_F1_T1),
        "validation",
        "assignment_not_found",
      );
      refused(await calls.request(TEACHER_G1, PLACE_F1_T1, PLACE_F2_T3), "denied", "no_family");
      refused(await calls.request(OUTSIDER, PLACE_F1_T1, PLACE_F2_T3), "denied", "no_family");
      refused(await calls.request(OTHER_ADMIN, PLACE_F1_T1, PLACE_F2_T3), "denied", "no_family");
      const nulls = await calls.fn(PARENT_F1, "swap_request($1, $2, null, $3, 1, null)", [
        nextKey("sw"),
        PLACE_F1_T1,
        PLACE_F2_T3,
      ]);
      assert.deepEqual([nulls.state, nulls.field], ["validation", "expected_version"]);
      assert.equal((await placeRow(db, PLACE_F1_T1)).status, "active");
    });

    it("audits a denied proposal once and stores the denial for its key, and writes nothing for a business refusal", async () => {
      const key = nextKey("sw");
      refused(
        await calls.request(PARENT_F2, PLACE_F1_T1, PLACE_F2_T3, { key }),
        "denied",
        "authorization_denied",
      );
      refused(
        await calls.request(PARENT_F2, PLACE_F1_T1, PLACE_F2_T3, { key }),
        "denied",
        "replayed",
      );
      const denied = await auditOf(db, "swap.denied", "denied");
      assert.equal(denied.length, 1);
      assert.deepEqual([denied[0]!.target_id, denied[0]!.details], [PLACE_F1_T1, "swap.request"]);
      await setStart(db, TASK_3, "-1 hour");
      refused(await calls.request(PARENT_F1, PLACE_F1_T1, PLACE_F2_T3), "conflict", "DUTY_CLOSED");
      assert.equal((await auditOf(db, "swap.denied")).length, 1);
    });

    it("refuses a stale version of either place and changes nothing (outdated screen)", async () => {
      const stale = (await placeRow(db, PLACE_F1_T1)).version - 1;
      refused(
        await calls.request(PARENT_F1, PLACE_F1_T1, PLACE_F2_T3, { sourceVersion: stale }),
        "invalidated",
        "REQUEST_VERSION_STALE",
      );
      refused(
        await calls.request(PARENT_F1, PLACE_F1_T1, PLACE_F2_T3, { targetVersion: 0 }),
        "invalidated",
        "REQUEST_VERSION_STALE",
      );
      assert.deepEqual(
        [(await placeRow(db, PLACE_F1_T1)).status, (await placeRow(db, PLACE_F2_T3)).status],
        ["active", "active"],
      );
    });

    it("returns the stored result for a repeated key, refuses a changed request under it, and runs another account's call fresh", async () => {
      const key = nextKey("sw");
      const versions = {
        sourceVersion: (await placeRow(db, PLACE_F1_T1)).version,
        targetVersion: (await placeRow(db, PLACE_F2_T3)).version,
      };
      const first = await calls.request(PARENT_F1, PLACE_F1_T1, PLACE_F2_T3, { key, ...versions });
      assert.equal(first.state, "success");
      const again = await calls.request(PARENT_F1, PLACE_F1_T1, PLACE_F2_T3, { key, ...versions });
      assert.deepEqual(
        [again.state, again.reference, again.code],
        ["success", first.reference, "replayed"],
      );
      assert.equal(
        Number(
          (await db.query("select count(*) from change_requests where kind = 'swap'")).rows[0]
            .count,
        ),
        1,
      );
      const changed = await calls.request(PARENT_F1, PLACE_F1_T1, PLACE_F2_T3, {
        key,
        ...versions,
        reason: "más",
      });
      refused(changed, "conflict", "idempotency_key_reused");
      // The other account has no record under this key: its call runs under its own checks and is denied.
      refused(
        await calls.request(PARENT_F2, PLACE_F1_T1, PLACE_F2_T3, { key, ...versions }),
        "denied",
        "authorization_denied",
      );
    });

    it("cannot read the table directly: the reason is seen through the functions only (NFR1.3)", async () => {
      await openRequest("Titkos ok");
      for (const account of [PARENT_F1, PARENT_F2, ADMIN_G1, SUPER_ADMIN]) {
        const failure = await failureOf(() =>
          asActor(db, schema, authenticated(account), () =>
            db.query("select * from change_requests"),
          ),
        );
        assert.equal(failure?.code, "42501", account);
      }
    });

    // ------------------------------------------------------------------ accepting (BR72.1, BR72.2)
    it("applies the swap when the other family accepts: places exchanged and active, versions stored, both families told, no audit entry", async () => {
      const id = await openRequest();
      const request = await requestRow(db, id);
      const done = await calls.respond(PARENT_F2, id, true, Number(request.version));
      assert.deepEqual([done.state, done.outcome], ["success", "applied"]);
      const one = await placeRow(db, PLACE_F1_T1);
      const two = await placeRow(db, PLACE_F2_T3);
      assert.deepEqual(
        [one.family_id, one.status, two.family_id, two.status],
        [FAMILY_2, "active", FAMILY_1, "active"],
      );
      const row = await requestRow(db, id);
      assert.equal(row.status, "applied");
      assert.deepEqual(
        [row.applied_source_version, row.applied_target_version],
        [one.version, two.version],
      );
      assert.equal(row.target_confirmed, true);
      for (const parent of [PARENT_ROW_F1, PARENT_ROW_F2, PARENT_ROW_CO]) {
        assert.equal((await noticesOf(db, parent, "swap_decided")).length, 1, parent);
      }
      assert.deepEqual(await auditOf(db, "swap.denied"), []);
      assert.equal(
        Number(
          (await db.query("select count(*) from audit_events where action like 'approval.%'"))
            .rows[0].count,
        ),
        0,
      );
    });

    it("lets either parent of the target family answer and nobody else, and answers made-up and foreign requests alike", async () => {
      const id = await openRequest();
      for (const account of [PARENT_F1, CO_PARENT_F1]) {
        refused(await calls.respond(account, id, true), "denied", "authorization_denied");
      }
      for (const account of [SUPER_ADMIN, TEACHER_G1, OUTSIDER, OTHER_ADMIN]) {
        refused(await calls.respond(account, id, true), "denied", "no_family");
      }
      refused(await calls.respond(PARENT_F2, uuid(424242), true), "denied", "authorization_denied");
      assert.equal((await requestRow(db, id)).status, "open");
      assert.ok((await auditOf(db, "swap.denied", "denied")).length >= 1);
      assert.equal((await calls.respond(PARENT_F2, id, true)).state, "success");
    });

    it("declines: rejected, both places active, the proposer told, the duties unchanged", async () => {
      const id = await openRequest();
      const done = await calls.respond(PARENT_F2, id, false);
      assert.deepEqual([done.state, done.outcome], ["success", "declined"]);
      const row = await requestRow(db, id);
      assert.deepEqual(
        [row.status, row.ended_reason, row.target_confirmed],
        ["rejected", "declined", false],
      );
      assert.deepEqual(
        [(await placeRow(db, PLACE_F1_T1)).status, (await placeRow(db, PLACE_F2_T3)).status],
        ["active", "active"],
      );
      assert.equal((await placeRow(db, PLACE_F1_T1)).family_id, FAMILY_1);
      assert.equal((await noticesOf(db, PARENT_ROW_F1, "swap_decided")).length, 1);
      assert.equal((await noticesOf(db, PARENT_ROW_F2, "swap_decided")).length, 0);
    });

    it("refuses an answer to a request that has ended, one that expired, and one whose request version is stale", async () => {
      const id = await openRequest();
      const version = Number((await requestRow(db, id)).version);
      refused(
        await calls.respond(PARENT_F2, id, true, version - 1),
        "invalidated",
        "REQUEST_VERSION_STALE",
      );
      await setStart(db, TASK_1, "-1 hour");
      refused(await calls.respond(PARENT_F2, id, true, version), "conflict", "SWAP_EXPIRED");
      assert.equal((await requestRow(db, id)).status, "open", "a refused answer changes nothing");
      await setStart(db, TASK_1, "10 days");
      assert.equal((await calls.respond(PARENT_F2, id, false)).state, "success");
      refused(await calls.respond(PARENT_F2, id, true), "conflict", "SWAP_REQUEST_NOT_OPEN");
      refused(await calls.respond(PARENT_F2, id, false), "conflict", "SWAP_REQUEST_NOT_OPEN");
    });

    it("refuses an acceptance when a place changed since the proposal, and when the rules no longer pass, leaving the request open (BR72.1)", async () => {
      const id = await openRequest();
      await db.query("update assignments set parent_id = null where id = $1", [PLACE_F2_T3]);
      refused(await calls.respond(PARENT_F2, id, true), "conflict", "SWAP_CANNOT_BE_APPLIED");
      assert.equal((await requestRow(db, id)).status, "open");
      assert.equal((await placeRow(db, PLACE_F1_T1)).family_id, FAMILY_1);
      // A request whose places are intact but whose rule now fails reports the reason code.
      await calls.withdraw(PARENT_F1, id);
      const second = await openRequest();
      await setChangeover(db, "2027-02-01");
      await setStanding(db, schema, FAMILY_1, "leaving");
      await db.query(
        "update tasks set starts_at = '2027-03-01T10:00:00Z', ends_at = '2027-03-01T12:00:00Z' where id = $1",
        [TASK_3],
      );
      const blocked = await calls.respond(PARENT_F2, second, true);
      assert.deepEqual(
        [blocked.state, blocked.code, blocked.reason],
        ["conflict", "SWAP_CANNOT_BE_APPLIED", "DUTY_INELIGIBLE"],
      );
    });

    it("returns the stored answer for a repeated click with the same outcome, for an acceptance and a decline", async () => {
      const accepted = await openRequest();
      const key = nextKey("rs");
      const acceptedVersion = await requestVersion(db, accepted);
      const first = await calls.respond(PARENT_F2, accepted, true, acceptedVersion, key);
      const again = await calls.respond(PARENT_F2, accepted, true, acceptedVersion, key);
      assert.deepEqual(
        [again.state, again.reference, again.code, again.outcome],
        ["success", first.reference, "replayed", "applied"],
      );
      // The places were exchanged: the second family now holds the first duty, so it proposes it back.
      const declined = await calls.request(PARENT_F2, PLACE_F1_T1, PLACE_F2_T3);
      assert.equal(declined.state, "success", JSON.stringify(declined));
      const declineKey = nextKey("rs");
      const declinedVersion = await requestVersion(db, String(declined.reference));
      await calls.respond(
        PARENT_F1,
        String(declined.reference),
        false,
        declinedVersion,
        declineKey,
      );
      const repeat = await calls.respond(
        PARENT_F1,
        String(declined.reference),
        false,
        declinedVersion,
        declineKey,
      );
      assert.deepEqual(
        [repeat.state, repeat.code, repeat.outcome],
        ["success", "replayed", "declined"],
      );
    });

    // ------------------------------------------------------------------ withdrawing (BR72.5)
    it("withdraws: only the proposing family, places active, the other family told, a second withdrawal refused", async () => {
      const id = await openRequest();
      refused(await calls.withdraw(PARENT_F2, id), "denied", "authorization_denied");
      for (const account of [SUPER_ADMIN, TEACHER_G1]) {
        refused(await calls.withdraw(account, id), "denied", "no_family");
      }
      const done = await calls.withdraw(CO_PARENT_F1, id);
      assert.equal(done.state, "success", JSON.stringify(done));
      const row = await requestRow(db, id);
      assert.deepEqual([row.status, row.ended_reason], ["withdrawn", "withdrawn_by_requester"]);
      assert.deepEqual(
        [(await placeRow(db, PLACE_F1_T1)).status, (await placeRow(db, PLACE_F2_T3)).status],
        ["active", "active"],
      );
      assert.equal((await noticesOf(db, PARENT_ROW_F2, "swap_withdrawn")).length, 1);
      refused(await calls.withdraw(PARENT_F1, id), "conflict", "SWAP_REQUEST_NOT_OPEN");
      const key = nextKey("wd");
      const second = await openRequest();
      await calls.withdraw(PARENT_F1, second, key);
      refused(await calls.withdraw(PARENT_F1, second, key), "success", "replayed");
    });

    it("refuses a withdrawal once the earlier duty has started", async () => {
      const id = await openRequest();
      await setStart(db, TASK_3, "-1 hour");
      refused(await calls.withdraw(PARENT_F1, id), "conflict", "SWAP_EXPIRED");
    });

    // ------------------------------------------------------------------ the family's own list (BR70.3)
    it("shows each family its own and incoming requests with the reason, and nobody else's", async () => {
      const id = await openRequest("Beteg a gyerek");
      const mine = await calls.incoming(PARENT_F1);
      const theirs = await calls.incoming(PARENT_F2);
      const items = (r: typeof mine) => r.items as Record<string, unknown>[];
      const ours = items(mine).find((i) => i.request_id === id)!;
      const incoming = items(theirs).find((i) => i.request_id === id)!;
      assert.deepEqual(
        [ours.direction, ours.status, ours.reason],
        ["outgoing", "open", "Beteg a gyerek"],
      );
      assert.deepEqual([incoming.direction, incoming.reason], ["incoming", "Beteg a gyerek"]);
      assert.equal(items(mine).filter((i) => i.request_id === id).length, 1);
      assert.deepEqual(items(await calls.incoming(ADMIN_G1)), []);
      refused(await calls.incoming(TEACHER_G1), "denied", "no_family");
      await setStart(db, TASK_1, "-1 hour");
      assert.equal(
        items(await calls.incoming(PARENT_F2)).find((i) => i.request_id === id)!.status,
        "expired",
      );
      assert.equal(ROTA_FAMILIES.includes(FAMILY_NO_GROUP), true);
    });

    // ------------------------------------------------------------------ cancellation requests (BR76.1)
    it("stores a cancellation request, keeps the place with the family, and refuses a duplicate, a stale version, a foreign place and a started duty", async () => {
      const made = await calls.cancel(PARENT_F1, PLACE_F1_T1);
      assert.equal(made.state, "success", JSON.stringify(made));
      const place = await placeRow(db, PLACE_F1_T1);
      assert.deepEqual([place.status, place.family_id], ["cancellation_pending", FAMILY_1]);
      const row = await requestRow(db, String(made.reference));
      assert.deepEqual(
        [
          row.kind,
          row.status,
          row.reason,
          row.source_family_id,
          row.target_family_id,
          row.source_assignment_version,
        ],
        ["cancellation", "open", "Beteg lettem", FAMILY_1, null, place.version],
      );
      refused(await calls.cancel(PARENT_F1, PLACE_F1_T1), "conflict", "REQUEST_DUPLICATE");
      refused(
        await calls.cancel(PARENT_F2, PLACE_F2_T3, 0),
        "invalidated",
        "REQUEST_VERSION_STALE",
      );
      refused(await calls.cancel(PARENT_F2, PLACE_F1_T1), "denied", "authorization_denied");
      refused(await calls.cancel(PARENT_F2, uuid(424242), 1), "denied", "authorization_denied");
      await setStart(db, TASK_3, "-1 hour");
      refused(await calls.cancel(PARENT_F2, PLACE_F2_T3), "conflict", "DUTY_CLOSED");
      refused(await calls.cancel(TEACHER_G1, PLACE_F1_T1), "denied", "no_family");
      assert.ok((await auditOf(db, "cancellation.denied", "denied")).length >= 1);
    });

    it("withdraws a cancellation request with no notice, and repeats safely", async () => {
      const made = await calls.cancel(PARENT_F1, PLACE_F1_T1);
      const key = nextKey("wd");
      assert.equal((await calls.withdraw(PARENT_F1, String(made.reference), key)).state, "success");
      assert.equal((await placeRow(db, PLACE_F1_T1)).status, "active");
      refused(await calls.withdraw(PARENT_F1, String(made.reference), key), "success", "replayed");
      assert.equal(
        Number(
          (await db.query("select count(*) from notifications where kind like 'swap_%'")).rows[0]
            .count,
        ),
        0,
      );
    });

    it("keeps the parent of the proposing family on the request and clears nothing else", async () => {
      const id = await openRequest();
      assert.equal((await requestRow(db, id)).requested_by_parent_id, PARENT_ROW_F1);
      assert.equal(PARENT_ROW_F2.length > 0, true);
    });
  });
}
