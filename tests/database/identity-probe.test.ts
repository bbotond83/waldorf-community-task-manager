import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ADMIN_G2,
  asActor,
  ASSIGNMENT_1,
  authenticated,
  DEACTIVATED,
  FAMILY_1,
  IDENTITY_SCHEMAS,
  openIdentityDatabase,
  OTHER_ADMIN,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  seedGroupAssignment,
  seedIdentityWorld,
  SIGNED_OUT,
  SUPER_ADMIN,
  TEACHER_G1,
  uuid,
} from "./identity-support.ts";
import { report } from "./stack-support.ts";

/** The scope probe: allowed, denied or not_found, and nothing else (BR2.17, NFR1.13, NFR4.4). */
for (const schema of IDENTITY_SCHEMAS) {
  describe(`scope probe in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openIdentityDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedIdentityWorld(db, schema);
    });

    const probe = (account: string, type: string, id: string, session?: string | null) =>
      asActor(
        db,
        schema,
        authenticated(account, session),
        async () =>
          (await db.query("select scope_probe($1, $2) as answer", [type, id])).rows[0]
            .answer as string,
      );

    it("answers allowed for a family to its parent and a super admin (BR3.9)", async () => {
      for (const account of [PARENT_F1, SUPER_ADMIN]) {
        assert.equal(await probe(account, "family", FAMILY_1), "allowed", account);
      }
    });

    it("answers denied for a family that exists in the caller's organization but outside their scope", async () => {
      for (const account of [PARENT_F2, ADMIN_G1, ADMIN_G2, TEACHER_G1, OUTSIDER]) {
        assert.equal(await probe(account, "family", FAMILY_1), "denied", account);
      }
    });

    it("answers not_found for a missing record, an unsupported type, and another organization's record, all alike", async () => {
      assert.equal(await probe(SUPER_ADMIN, "family", uuid(31337)), "not_found");
      assert.equal(
        await probe(OTHER_ADMIN, "family", FAMILY_1),
        "not_found",
        "another organization's record",
      );
      assert.equal(await probe(OTHER_ADMIN, "family", uuid(31337)), "not_found");
      for (const type of [
        "task",
        "event",
        "parent",
        "notification",
        "change_request",
        "nonsense",
        "",
      ]) {
        assert.equal(await probe(SUPER_ADMIN, type, FAMILY_1), "not_found", type);
      }
    });

    it("supports assignments (group admins and super admins)", async () => {
      await seedGroupAssignment(db);
      assert.equal(await probe(ADMIN_G1, "assignment", ASSIGNMENT_1), "allowed");
      assert.equal(await probe(SUPER_ADMIN, "assignment", ASSIGNMENT_1), "allowed");
      assert.equal(await probe(ADMIN_G2, "assignment", ASSIGNMENT_1), "denied");
      assert.equal(await probe(PARENT_F1, "assignment", ASSIGNMENT_1), "denied");
      assert.equal(
        await probe(TEACHER_G1, "assignment", ASSIGNMENT_1),
        "denied",
        "teachers have no raw table access",
      );
    });

    it("answers denied to a signed-out, deactivated or unregistered token, whatever the record", async () => {
      assert.equal(await probe(SIGNED_OUT, "family", FAMILY_1), "denied");
      assert.equal(await probe(DEACTIVATED, "family", FAMILY_1), "denied");
      assert.equal(await probe(SUPER_ADMIN, "family", FAMILY_1, uuid(1)), "denied");
      assert.equal(
        await probe(SUPER_ADMIN, "family", uuid(31337), uuid(1)),
        "denied",
        "no hint whether the record exists",
      );
    });

    it("returns text only: no column, count or identifier of the record leaks", async () => {
      for (const account of [PARENT_F2, OUTSIDER, OTHER_ADMIN]) {
        const result = await asActor(db, schema, authenticated(account), () =>
          db.query("select scope_probe('family', $1)", [FAMILY_1]),
        );
        assert.deepEqual(
          result.fields.map((field) => field.name),
          ["scope_probe"],
        );
        assert.ok(["allowed", "denied", "not_found"].includes(String(result.rows[0].scope_probe)));
      }
      const type = (
        await db.query(
          "select pg_get_function_result('scope_probe(text, uuid)'::regprocedure) as t",
        )
      ).rows[0].t;
      assert.equal(type, "text");
    });

    it("adds little to a detail screen (reported, target 50 ms)", async () => {
      const runs = 30;
      const times: number[] = [];
      for (let index = 0; index < runs; index += 1) {
        const started = performance.now();
        await probe(PARENT_F1, "family", FAMILY_1);
        times.push(performance.now() - started);
      }
      const median = times.sort((a, b) => a - b)[Math.floor(runs / 2)]!;
      report(
        `scope probe in ${schema}: median ${median.toFixed(2)} ms including the request setup (target 50 ms)`,
      );
      assert.ok(median < 200);
    });
  });
}
