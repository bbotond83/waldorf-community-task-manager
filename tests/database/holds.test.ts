import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { resetWorkerData } from "../../scripts/db/worker.ts";
import {
  asActor,
  type Envelope,
  failureOf,
  lockSchemas,
  openDatabase,
  ORGANIZATION,
  OTHER_ADMIN,
  OTHER_ORGANIZATION,
  PARENT,
  placeHold,
  prepareSchema,
  seedGrants,
  SUPER_ADMIN,
  SYSTEM_ACCOUNT,
  useSchema,
  uuid,
} from "./stack-support.ts";

/** Lifecycle holds (BR3.5, BR3.8), against a worker schema and the default schema (BR10.4). */
for (const schema of ["worker_3", "public"]) {
  describe(`lifecycle holds in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openDatabase();
      await lockSchemas(db, [schema]);
      await prepareSchema(db, schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await useSchema(db, schema);
      await resetWorkerData(db, schema);
      await seedGrants(db);
    });

    const release = async (key: string, holdId: string, version: number, account = SUPER_ADMIN) =>
      asActor(db, schema, { role: "authenticated", account }, async () => {
        const result = await db.query("select lifecycle_hold_release($1, $2, $3) as result", [
          key,
          holdId,
          version,
        ]);
        return result.rows[0].result as Envelope;
      });
    const hold = async (id: string) =>
      (await db.query("select * from lifecycle_holds where id = $1", [id])).rows[0];
    const auditActions = async () =>
      (await db.query("select action, outcome from audit_events order by occurred_at, id")).rows;

    it("allows at most one open hold per target and refuses a second with a conflict", async () => {
      const first = await placeHold(db, { key: "k1", targetId: uuid(1) });
      const second = await placeHold(db, { key: "k2", targetId: uuid(1), reason: "other_reason" });
      assert.equal(first.state, "success");
      assert.equal(second.state, "conflict");
      assert.equal(second.code, "hold_already_open");
      assert.equal((await db.query("select count(*)::int as n from lifecycle_holds")).rows[0].n, 1);
    });

    it("enforces the one-open-hold rule in the table itself, not only in the function", async () => {
      const insert = () =>
        db.query(
          "insert into lifecycle_holds (target_type, target_id, organization_id, reason, placed_by_account_id) values ('child', $1, $2, 'legal_hold:case_1', $3)",
          [uuid(2), ORGANIZATION, SYSTEM_ACCOUNT],
        );
      await insert();
      assert.equal((await failureOf(insert))?.code, "23505");
    });

    it("keeps holds on different targets and different target types apart", async () => {
      assert.equal((await placeHold(db, { key: "k1", targetId: uuid(3) })).state, "success");
      assert.equal((await placeHold(db, { key: "k2", targetId: uuid(4) })).state, "success");
      assert.equal(
        (await placeHold(db, { key: "k3", targetId: uuid(3), targetType: "family" })).state,
        "success",
      );
    });

    it("releases a hold with the current version, which then rises by exactly one", async () => {
      const placed = await placeHold(db, { key: "k1", targetId: uuid(5) });
      const before = await hold(placed.reference!);
      assert.equal(before.version, 1);
      assert.equal(before.released_at, null);
      const released = await release("r1", placed.reference!, 1);
      assert.equal(released.state, "success");
      const after = await hold(placed.reference!);
      assert.equal(after.version, 2);
      assert.notEqual(after.released_at, null);
      assert.ok(after.updated_at >= before.updated_at);
    });

    it("refuses a stale version with a conflict and leaves the hold open", async () => {
      const placed = await placeHold(db, { key: "k1", targetId: uuid(6) });
      const stale = await release("r1", placed.reference!, 7);
      assert.equal(stale.state, "conflict");
      assert.equal(stale.code, "hold_version_stale");
      const row = await hold(placed.reference!);
      assert.equal(row.released_at, null);
      assert.equal(row.version, 1);
    });

    it("refuses a second release because the version has moved on", async () => {
      const placed = await placeHold(db, { key: "k1", targetId: uuid(7) });
      assert.equal((await release("r1", placed.reference!, 1)).state, "success");
      assert.equal((await release("r2", placed.reference!, 1)).state, "conflict");
      assert.equal((await release("r3", placed.reference!, 2)).state, "conflict");
    });

    it("allows a new hold on a target once its hold was released", async () => {
      const placed = await placeHold(db, { key: "k1", targetId: uuid(8) });
      await release("r1", placed.reference!, 1);
      const again = await placeHold(db, { key: "k2", targetId: uuid(8) });
      assert.equal(again.state, "success");
      assert.notEqual(again.reference, placed.reference);
    });

    it("denies placing and releasing to accounts that are not super administrators, with denied events", async () => {
      const denied = await asActor(
        db,
        schema,
        { role: "authenticated", account: PARENT },
        async () => {
          const result = await db.query(
            "select lifecycle_hold_place('k-parent', 'child', $1, $2, 'legal_hold:case_1') as result",
            [uuid(9), ORGANIZATION],
          );
          return result.rows[0].result as Envelope;
        },
      );
      assert.equal(denied.state, "denied");
      const placed = await placeHold(db, { key: "k1", targetId: uuid(9) });
      assert.equal((await release("r-parent", placed.reference!, 1, PARENT)).state, "denied");
      assert.equal((await release("r-other", placed.reference!, 1, OTHER_ADMIN)).state, "denied");
      assert.equal((await hold(placed.reference!)).released_at, null);
      assert.deepEqual(await auditActions(), [
        { action: "lifecycle.hold_place", outcome: "denied" },
        { action: "lifecycle.hold_place", outcome: "success" },
        { action: "lifecycle.hold_release", outcome: "denied" },
        { action: "lifecycle.hold_release", outcome: "denied" },
      ]);
    });

    it("writes one audit event for each placement and release, naming the target", async () => {
      const placed = await placeHold(db, { key: "k1", targetId: uuid(10), targetType: "family" });
      await release("r1", placed.reference!, 1);
      const events = await db.query(
        "select action, target_type, target_id, outcome, details from audit_events order by occurred_at, id",
      );
      assert.deepEqual(events.rows, [
        {
          action: "lifecycle.hold_place",
          target_type: "family",
          target_id: uuid(10),
          outcome: "success",
          details: "legal_hold:case_1",
        },
        {
          action: "lifecycle.hold_release",
          target_type: "family",
          target_id: uuid(10),
          outcome: "success",
          details: "hold_released",
        },
      ]);
    });

    it("accepts a code-shaped reason up to 300 characters and returns validation for free text or longer", async () => {
      assert.equal(
        (await placeHold(db, { key: "k1", targetId: uuid(11), reason: "a".repeat(300) })).state,
        "success",
      );
      for (const [index, reason] of [
        "a".repeat(301),
        "Kovács Anna",
        "has space",
        "",
        "UPPER",
      ].entries()) {
        const result = await placeHold(db, { key: `bad-${index}`, targetId: uuid(12), reason });
        assert.equal(result.state, "validation", JSON.stringify(reason));
        assert.equal(result.code, "hold_reason_invalid");
      }
      const direct = await failureOf(() =>
        db.query(
          "insert into lifecycle_holds (target_type, target_id, organization_id, reason, placed_by_account_id) values ('child', $1, $2, $3, $4)",
          [uuid(13), ORGANIZATION, "Free Text", SYSTEM_ACCOUNT],
        ),
      );
      assert.equal(direct?.code, "23514");
    });

    it("answers an unknown hold and a missing target with a validation result", async () => {
      assert.equal((await release("r1", uuid(99), 1)).code, "hold_not_found");
      const missing = await db.query(
        "select lifecycle_hold_place('k1', null, $1, $2, 'legal_hold:case_1') as result",
        [uuid(14), ORGANIZATION],
      );
      assert.equal(missing.rows[0].result.code, "hold_target_missing");
    });

    it("lets a hold change only by being released: no other update, no change after release, no delete", async () => {
      const placed = await placeHold(db, { key: "k1", targetId: uuid(15) });
      for (const statement of [
        `update lifecycle_holds set reason = 'changed' where id = '${placed.reference}'`,
        `update lifecycle_holds set target_id = gen_random_uuid() where id = '${placed.reference}'`,
        `update lifecycle_holds set version = 9 where id = '${placed.reference}'`,
        `delete from lifecycle_holds where id = '${placed.reference}'`,
      ]) {
        assert.equal((await failureOf(() => db.query(statement)))?.code, "42501", statement);
      }
      await release("r1", placed.reference!, 1);
      const again = await failureOf(() =>
        db.query(`update lifecycle_holds set released_at = null where id = '${placed.reference}'`),
      );
      assert.equal(again?.code, "42501");
      assert.equal((await hold(placed.reference!)).version, 2);
    });

    it("refuses application roles any direct access to the holds table", async () => {
      await placeHold(db, { key: "k1", targetId: uuid(16) });
      for (const role of ["anon", "authenticated", "service_role"] as const) {
        for (const statement of [
          "select * from lifecycle_holds",
          "update lifecycle_holds set released_at = now()",
          "delete from lifecycle_holds",
        ]) {
          const error = await failureOf(() =>
            asActor(db, schema, { role, account: SUPER_ADMIN }, () => db.query(statement)),
          );
          assert.equal(error?.code, "42501", `${role}: ${statement}`);
        }
      }
    });

    it("keeps the scope of each hold, so a super administrator of another organization cannot act on it", async () => {
      const placed = await placeHold(db, { key: "k1", targetId: uuid(17) });
      assert.equal((await hold(placed.reference!)).organization_id, ORGANIZATION);
      const foreign = await asActor(
        db,
        schema,
        { role: "authenticated", account: OTHER_ADMIN },
        async () => {
          const result = await db.query(
            "select lifecycle_hold_place('k-foreign', 'child', $1, $2, 'legal_hold:case_1') as result",
            [uuid(18), ORGANIZATION],
          );
          return result.rows[0].result as Envelope;
        },
      );
      assert.equal(foreign.state, "denied");
      const ownOrg = await asActor(
        db,
        schema,
        { role: "authenticated", account: OTHER_ADMIN },
        async () => {
          const result = await db.query(
            "select lifecycle_hold_place('k-own', 'child', $1, $2, 'legal_hold:case_1') as result",
            [uuid(18), OTHER_ORGANIZATION],
          );
          return result.rows[0].result as Envelope;
        },
      );
      assert.equal(ownOrg.state, "success");
    });

    it("provides a generic version trigger that makes a stale update change nothing (BR3.8)", async () => {
      await db.query(
        "create table version_probe (id int primary key, note text, version integer not null default 1, updated_at timestamptz not null default now())",
      );
      await db.query(
        "create trigger version_probe_touch before update on version_probe for each row execute function platform_touch_version()",
      );
      try {
        await db.query("insert into version_probe (id, note) values (1, 'first')");
        const accepted = await db.query(
          "update version_probe set note = 'second' where id = 1 and version = 1",
        );
        assert.equal(accepted.rowCount, 1);
        const stale = await db.query(
          "update version_probe set note = 'third' where id = 1 and version = 1",
        );
        assert.equal(stale.rowCount, 0);
        const row = (await db.query("select note, version from version_probe")).rows[0];
        assert.deepEqual(row, { note: "second", version: 2 });
      } finally {
        await db.query("drop table version_probe");
      }
    });
  });
}
