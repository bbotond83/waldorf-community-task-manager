import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { resetWorkerData } from "../../scripts/db/worker.ts";
import {
  asActor,
  failureOf,
  lockSchemas,
  OTHER_ADMIN,
  OUTSIDER,
  openDatabase,
  ORGANIZATION,
  PARENT,
  placeHold,
  prepareSchema,
  report,
  seedGrants,
  SUPER_ADMIN,
  SYSTEM_ACCOUNT,
  useSchema,
  uuid,
} from "./stack-support.ts";

/** Audit log behavior (BR3.2 to BR3.4, BR3.9), against a worker schema and the default schema (BR10.4). */
for (const schema of ["worker_1", "public"]) {
  describe(`audit log in ${schema}`, () => {
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

    const events = async () =>
      (
        await db.query(
          "select actor_account_id, actor_role, action, target_type, target_id, outcome, details from audit_events order by occurred_at, id",
        )
      ).rows;
    const asAuthenticated = (account: string) => ({ role: "authenticated" as const, account });

    it("refuses the audit write function to anon, authenticated and service_role", async () => {
      for (const actor of [
        { role: "anon" as const },
        asAuthenticated(SUPER_ADMIN),
        { role: "service_role" as const },
      ]) {
        const error = await failureOf(() =>
          asActor(db, schema, actor, () =>
            db.query(
              "select platform_audit_write('role.grant', 'account', $1, $2, null, 'success', null)",
              [uuid(1), ORGANIZATION],
            ),
          ),
        );
        assert.equal(error?.code, "42501", `${actor.role} must be refused`);
      }
      assert.equal((await events()).length, 0);
    });

    it("refuses a direct insert into the audit table to every application role", async () => {
      for (const actor of [
        { role: "anon" as const },
        asAuthenticated(SUPER_ADMIN),
        { role: "service_role" as const },
      ]) {
        const error = await failureOf(() =>
          asActor(db, schema, actor, () =>
            db.query(
              "insert into audit_events (actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome) values ($1, 'super_admin', 'role.grant', 'account', $2, $3, 'success')",
              [SUPER_ADMIN, uuid(1), ORGANIZATION],
            ),
          ),
        );
        assert.equal(error?.code, "42501", `${actor.role} must be refused`);
      }
    });

    it("lets only a super admin of the organization read events, and refuses anon and the service role (U2 policy, BR2.15)", async () => {
      await placeHold(db, { key: "k1", targetId: uuid(1) });
      const read = (actor: Parameters<typeof asActor>[2]) =>
        asActor(
          db,
          schema,
          actor,
          async () => (await db.query("select id from audit_events")).rows,
        );
      assert.equal((await read(asAuthenticated(SUPER_ADMIN))).length, 1);
      assert.equal((await read(asAuthenticated(OUTSIDER))).length, 0);
      assert.equal((await read(asAuthenticated(OTHER_ADMIN))).length, 0);
      for (const actor of [{ role: "anon" as const }, { role: "service_role" as const }]) {
        const error = await failureOf(() => read(actor));
        assert.equal(error?.code, "42501", actor.role);
      }
    });

    it("refuses update and delete of an event to application roles and to the table owner", async () => {
      await placeHold(db, { key: "k1", targetId: uuid(1) });
      for (const actor of [asAuthenticated(SUPER_ADMIN), { role: "service_role" as const }]) {
        for (const statement of [
          "update audit_events set details = 'changed'",
          "delete from audit_events",
        ]) {
          const error = await failureOf(() =>
            asActor(db, schema, actor, () => db.query(statement)),
          );
          assert.equal(error?.code, "42501", `${actor.role}: ${statement}`);
        }
      }
      for (const statement of [
        "update audit_events set details = 'changed'",
        "delete from audit_events",
      ]) {
        const error = await failureOf(() => db.query(statement));
        assert.equal(error?.code, "42501");
        assert.match(error?.message ?? "", /append-only/);
      }
      assert.equal((await events()).length, 1);
    });

    // U5: the purge relaxes the delete rule for one case only (aged rows, inside the purge); everything else holds.
    it("still refuses an update and a delete of a recent event, and a delete of an aged event outside the purge", async () => {
      await db.query(
        `insert into audit_events (actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome, occurred_at)
         values ($1, 'system', 'role.grant', 'account', $2, $4, 'success', now() - interval '1 day'),
                ($1, 'system', 'role.grant', 'account', $3, $4, 'success', now() - interval '400 days')`,
        [SYSTEM_ACCOUNT, uuid(1), uuid(2), ORGANIZATION],
      );
      for (const statement of [
        "update audit_events set details = 'changed' where target_id = '" + uuid(1) + "'",
        "update audit_events set details = 'changed' where target_id = '" + uuid(2) + "'",
        "delete from audit_events where target_id = '" + uuid(1) + "'",
        "delete from audit_events where target_id = '" + uuid(2) + "'",
      ]) {
        const error = await failureOf(() => db.query(statement));
        assert.equal(error?.code, "42501", statement);
        assert.match(error?.message ?? "", /append-only/);
      }
      assert.equal((await events()).length, 2);
    });

    it("writes one event with the actor taken from the session, for a super administrator", async () => {
      const result = await asActor(db, schema, asAuthenticated(SUPER_ADMIN), () =>
        db.query(
          "select lifecycle_hold_place('k1', 'child', $1, $2, 'legal_hold:case_1') as result",
          [uuid(1), ORGANIZATION],
        ),
      );
      assert.equal(result.rows[0].result.state, "success");
      const [event, ...rest] = await events();
      assert.equal(rest.length, 0);
      assert.deepEqual(event, {
        actor_account_id: SUPER_ADMIN,
        actor_role: "super_admin",
        action: "lifecycle.hold_place",
        target_type: "child",
        target_id: uuid(1),
        outcome: "success",
        details: "legal_hold:case_1",
      });
    });

    it("records the system actor for the operator command and the seed", async () => {
      const result = await placeHold(db, { key: "k1", targetId: uuid(1) });
      assert.equal(result.state, "success");
      const [event] = await events();
      assert.equal(event?.actor_account_id, SYSTEM_ACCOUNT);
      assert.equal(event?.actor_role, "system");
    });

    it("commits a denied event together with a denied result, and changes nothing else", async () => {
      for (const [account, role] of [
        [PARENT, "parent"],
        [OUTSIDER, "none"],
      ] as const) {
        await db.query("truncate audit_events, lifecycle_holds, idempotency_records");
        const result = await asActor(db, schema, asAuthenticated(account), () =>
          db.query(
            "select lifecycle_hold_place('k-denied', 'child', $1, $2, 'legal_hold:case_1') as result",
            [uuid(2), ORGANIZATION],
          ),
        );
        assert.equal(result.rows[0].result.state, "denied", role);
        assert.equal((await events()).length, 1);
        const [event] = await events();
        assert.equal(event?.outcome, "denied");
        assert.equal(event?.actor_account_id, account);
        assert.equal(event?.actor_role, role);
        assert.equal(
          (await db.query("select count(*)::int as n from lifecycle_holds")).rows[0].n,
          0,
        );
      }
    });

    it("rolls back the change, the event and the idempotency record when a later step fails", async () => {
      await db.query(
        "create or replace function fail_audit_insert() returns trigger language plpgsql as $$ begin raise exception 'injected failure' using errcode = 'P0001'; end $$",
      );
      await db.query(
        "create trigger fail_audit before insert on audit_events for each row execute function fail_audit_insert()",
      );
      try {
        const error = await failureOf(() => placeHold(db, { key: "k-atomic", targetId: uuid(3) }));
        assert.match(error?.message ?? "", /injected failure/);
      } finally {
        await db.query("drop trigger fail_audit on audit_events");
        await db.query("drop function fail_audit_insert()");
      }
      assert.equal((await db.query("select count(*)::int as n from lifecycle_holds")).rows[0].n, 0);
      assert.equal(
        (await db.query("select count(*)::int as n from idempotency_records")).rows[0].n,
        0,
      );
      assert.equal((await events()).length, 0);
    });

    it("accepts a code-shaped details text and refuses free text and an over-length value", async () => {
      const insert = (details: string | null) =>
        db.query(
          "insert into audit_events (actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome, details) values ($1, 'system', 'role.grant', 'account', $2, $3, 'success', $4)",
          [SYSTEM_ACCOUNT, uuid(4), ORGANIZATION, details],
        );
      await insert("role_granted:group-3.v2");
      await insert(null);
      await insert("a".repeat(500));
      for (const bad of [
        "Kovács Anna",
        "anna@example.test",
        "has space",
        "UPPER",
        "a".repeat(501),
      ]) {
        const error = await failureOf(() => insert(bad));
        assert.equal(error?.code, "23514", bad);
      }
      assert.equal((await events()).length, 3);
    });

    it("refuses actions outside the fixed list, outcomes other than success or denied, and unknown roles", async () => {
      const insert = (action: string, outcome: string, role: string) =>
        db.query(
          "insert into audit_events (actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome) values ($1, $4, $2, 'account', $5, $6, $3)",
          [SYSTEM_ACCOUNT, action, outcome, role, uuid(5), ORGANIZATION],
        );
      for (const action of [
        "role.grant",
        "role.revoke",
        "role.first_super_admin",
        "approval.approve",
        "approval.reject",
        "import.commit",
        "lifecycle.anonymize",
        "lifecycle.delete",
        "lifecycle.hold_place",
        "lifecycle.hold_release",
      ]) {
        await insert(action, "success", "system");
      }
      assert.equal((await events()).length, 10);
      assert.equal(
        (await failureOf(() => insert("role.promote", "success", "system")))?.code,
        "23514",
      );
      assert.equal(
        (await failureOf(() => insert("role.grant", "failed", "system")))?.code,
        "23514",
      );
      assert.equal(
        (await failureOf(() => insert("role.grant", "success", "owner")))?.code,
        "23514",
      );
    });

    it("returns a validation result for a free-text hold reason and writes no event", async () => {
      const result = await placeHold(db, {
        key: "k-text",
        targetId: uuid(6),
        reason: "Kovács Anna kérte",
      });
      assert.equal(result.state, "validation");
      assert.equal(result.code, "hold_reason_invalid");
      assert.equal((await events()).length, 0);
    });

    it("has indexes for the audit queries by actor, target and time (NFR3.3)", async () => {
      const result = await db.query(
        "select indexdef from pg_indexes where schemaname = $1 and tablename = 'audit_events'",
        [schema],
      );
      const definitions = result.rows.map((row) => String(row.indexdef));
      assert.ok(definitions.some((text) => text.includes("(actor_account_id, occurred_at DESC)")));
      assert.ok(
        definitions.some((text) => text.includes("(target_type, target_id, occurred_at DESC)")),
      );
      assert.ok(definitions.some((text) => text.includes("(occurred_at DESC)")));
    });

    it("adds less than 50 ms per operation for the audit write and idempotency lookup (NFR4.5)", async () => {
      const runs = 60;
      const hold = () =>
        `insert into lifecycle_holds (target_type, target_id, organization_id, reason, placed_by_account_id) values ('child', gen_random_uuid(), '${ORGANIZATION}', 'legal_hold:timing', '${SYSTEM_ACCOUNT}')`;
      const plainStart = performance.now();
      for (let n = 0; n < runs; n++) await db.query(hold());
      const plain = performance.now() - plainStart;
      await db.query("truncate lifecycle_holds");
      const audited = performance.now();
      for (let n = 0; n < runs; n++) {
        await db.query(
          "select lifecycle_hold_place($1, 'child', gen_random_uuid(), $2, 'legal_hold:timing')",
          [`timing-${n}`, ORGANIZATION],
        );
      }
      const auditedTotal = performance.now() - audited;
      const added = (auditedTotal - plain) / runs;
      report(
        `audit overhead in ${schema}: ${added.toFixed(2)} ms per operation (target under 50 ms)`,
      );
      assert.ok(added < 50, `added ${added} ms per operation`);
    });
  });
}
