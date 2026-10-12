import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import pg from "pg";
import { resetWorkerData } from "../../scripts/db/worker.ts";
import {
  asActor,
  type Envelope,
  failureOf,
  lockSchemas,
  openDatabase,
  ORGANIZATION,
  OTHER_ADMIN,
  PARENT,
  placeHold,
  prepareSchema,
  report,
  seedGrants,
  stackSettings,
  SUPER_ADMIN,
  SYSTEM_ACCOUNT,
  useSchema,
  uuid,
} from "./stack-support.ts";

const FINGERPRINT = "a".repeat(64);

/** Idempotency behavior (BR3.6, BR3.7, NFR6.5), against a worker schema and the default schema (BR10.4). */
for (const schema of ["worker_2", "public"]) {
  describe(`idempotency in ${schema}`, () => {
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

    const count = async (table: string) =>
      (await db.query(`select count(*)::int as n from ${table}`)).rows[0].n as number;
    const place = (
      client: pg.Client,
      key: string,
      target = uuid(1),
      reason = "legal_hold:case_1",
    ) => asAdmin(client, key, target, reason);
    const asAdmin = async (
      client: pg.Client,
      key: string,
      target: string,
      reason: string,
      account = SUPER_ADMIN,
    ) => {
      await client.query("begin");
      try {
        await client.query(`set local search_path to "${schema}", pg_catalog`);
        await client.query("set local role authenticated");
        await client.query("select set_config('request.jwt.claim.sub', $1, true)", [account]);
        const result = await client.query(
          "select lifecycle_hold_place($1, 'child', $2, $3, $4) as result",
          [key, target, ORGANIZATION, reason],
        );
        await client.query("commit");
        return result.rows[0].result as Envelope;
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    };

    it("returns the stored result for a repeated key and creates nothing new", async () => {
      const first = await place(db, "key-1");
      const second = await place(db, "key-1");
      assert.equal(first.state, "success");
      assert.equal(second.state, "success");
      assert.equal(second.reference, first.reference);
      assert.equal(second.code, "replayed");
      assert.equal(await count("lifecycle_holds"), 1);
      assert.equal(await count("audit_events"), 1);
      assert.equal(await count("idempotency_records"), 1);
    });

    it("returns a conflict when the same key is reused for a different request, and changes nothing", async () => {
      await place(db, "key-1", uuid(1));
      const different = await place(db, "key-1", uuid(2));
      assert.equal(different.state, "conflict");
      assert.equal(different.code, "idempotency_key_reused");
      assert.equal(await count("lifecycle_holds"), 1);
      assert.equal(await count("audit_events"), 1);
    });

    it("replays a stored denied result instead of acting again", async () => {
      const denied = await asAdmin(db, "key-d", uuid(3), "legal_hold:case_1", PARENT);
      assert.equal(denied.state, "denied");
      const again = await asAdmin(db, "key-d", uuid(3), "legal_hold:case_1", PARENT);
      assert.equal(again.state, "denied");
      assert.equal(again.code, "replayed");
      assert.equal(await count("audit_events"), 1);
    });

    it("stores validation, conflict and terminal results too, so a repeat returns the same answer", async () => {
      assert.equal((await place(db, "key-v", uuid(4), "Not Code Shaped")).state, "validation");
      assert.equal((await place(db, "key-v", uuid(4), "Not Code Shaped")).code, "replayed");
      await place(db, "key-a", uuid(5));
      const conflict = await place(db, "key-c", uuid(5));
      assert.equal(conflict.code, "hold_already_open");
      assert.equal((await place(db, "key-c", uuid(5))).state, "conflict");
      const states = await db.query(
        "select result_state from idempotency_records order by result_state",
      );
      assert.deepEqual(
        states.rows.map((row) => row.result_state),
        ["conflict", "success", "validation"],
      );
    });

    it("never stores a retryable result, and a failed attempt is acted on again by the retry", async () => {
      const error = await failureOf(() =>
        db.query("select platform_idempotency_store('op.test', 'k', $1, 'retryable', null)", [
          FINGERPRINT,
        ]),
      );
      assert.equal(error?.code, "22023");
      const direct = await failureOf(() =>
        db.query(
          "insert into idempotency_records (account_id, operation, idempotency_key, request_fingerprint, result_state) values ($1, 'op.test', 'k', $2, 'retryable')",
          [SYSTEM_ACCOUNT, FINGERPRINT],
        ),
      );
      assert.equal(direct?.code, "23514");
      await db.query(
        "create function fail_hold_insert() returns trigger language plpgsql as $$ begin raise exception 'transient failure'; end $$",
      );
      await db.query(
        "create trigger fail_hold before insert on lifecycle_holds for each row execute function fail_hold_insert()",
      );
      try {
        assert.match(
          (await failureOf(() => placeHold(db, { key: "key-retry", targetId: uuid(6) })))
            ?.message ?? "",
          /transient failure/,
        );
      } finally {
        await db.query("drop trigger fail_hold on lifecycle_holds");
        await db.query("drop function fail_hold_insert()");
      }
      assert.equal(await count("idempotency_records"), 0);
      const retried = await placeHold(db, { key: "key-retry", targetId: uuid(6) });
      assert.equal(retried.state, "success");
      assert.notEqual(retried.code, "replayed");
    });

    it("replaces an expired record in the same statement, so an expired key behaves as new", async () => {
      await place(db, "key-old", uuid(7));
      await db.query(
        "update idempotency_records set created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour'",
      );
      const again = await place(db, "key-old", uuid(8));
      assert.equal(again.state, "success");
      assert.notEqual(again.code, "replayed");
      const rows = await db.query(
        "select request_fingerprint, expires_at > now() as fresh from idempotency_records",
      );
      assert.equal(rows.rows.length, 1);
      assert.equal(rows.rows[0].fresh, true);
      assert.equal(await count("lifecycle_holds"), 2);
    });

    it("gives every record a 24 hour expiry", async () => {
      await place(db, "key-ttl");
      const row = (
        await db.query(
          "select extract(epoch from (expires_at - created_at))::int as seconds from idempotency_records",
        )
      ).rows[0];
      assert.equal(row.seconds, 24 * 3600);
    });

    it("lets only one of two simultaneous submissions with the same key act (NFR6.5)", async () => {
      const other = new pg.Client({ connectionString: stackSettings().databaseUrl });
      await other.connect();
      try {
        const results = await Promise.all([
          place(db, "key-race", uuid(9)),
          place(other, "key-race", uuid(9)),
        ]);
        assert.deepEqual(
          results.map((result) => result.state),
          ["success", "success"],
        );
        assert.equal(results[0]?.reference, results[1]?.reference);
        assert.equal(results.filter((result) => result.code === "replayed").length, 1);
        assert.equal(await count("lifecycle_holds"), 1);
        assert.equal(await count("audit_events"), 1);
        assert.equal(await count("idempotency_records"), 1);
      } finally {
        await other.end();
      }
    });

    it("keeps keys apart per account: another account with the same key acts on its own", async () => {
      await place(db, "shared-key", uuid(10));
      const other = await asAdmin(db, "shared-key", uuid(11), "legal_hold:case_2", OTHER_ADMIN);
      assert.equal(other.state, "denied");
      assert.notEqual(other.code, "replayed");
      assert.equal(await count("idempotency_records"), 2);
    });

    it("refuses application roles any access to the idempotency table, so no account can read another's record", async () => {
      await place(db, "key-1");
      for (const role of ["anon", "authenticated", "service_role"] as const) {
        for (const statement of [
          "select * from idempotency_records",
          "insert into idempotency_records (account_id, operation, idempotency_key, request_fingerprint, result_state) values (gen_random_uuid(), 'x', 'k', repeat('a', 64), 'success')",
          "update idempotency_records set result_state = 'denied'",
          "delete from idempotency_records",
        ]) {
          const error = await failureOf(() =>
            asActor(db, schema, { role, account: PARENT }, () => db.query(statement)),
          );
          assert.equal(error?.code, "42501", `${role}: ${statement}`);
        }
      }
      const flags = await db.query(
        "select relrowsecurity from pg_class where oid = 'idempotency_records'::regclass",
      );
      assert.equal(flags.rows[0].relrowsecurity, true);
    });

    it("keeps one record per account, operation and key, and checks the stored shapes", async () => {
      const insert = (
        overrides: Partial<Record<"operation" | "key" | "fingerprint" | "state", string>> = {},
      ) =>
        db.query(
          "insert into idempotency_records (account_id, operation, idempotency_key, request_fingerprint, result_state) values ($1, $2, $3, $4, $5)",
          [
            SYSTEM_ACCOUNT,
            overrides.operation ?? "op.test",
            overrides.key ?? "k",
            overrides.fingerprint ?? FINGERPRINT,
            overrides.state ?? "success",
          ],
        );
      await insert();
      assert.equal((await failureOf(() => insert()))?.code, "23505");
      assert.equal((await failureOf(() => insert({ key: "x".repeat(201) })))?.code, "23514");
      assert.equal((await failureOf(() => insert({ key: "" })))?.code, "23514");
      assert.equal((await failureOf(() => insert({ fingerprint: "not-a-hash" })))?.code, "23514");
      assert.equal((await failureOf(() => insert({ operation: "Has Space" })))?.code, "23514");
      for (const state of ["validation", "denied", "conflict", "terminal"])
        await insert({ key: `k-${state}`, state });
      assert.equal(
        (await failureOf(() => insert({ key: "k-bad", state: "pending" })))?.code,
        "23514",
      );
    });

    it("rejects an invalid idempotency key with a validation result that is not stored", async () => {
      const result = await placeHold(db, { key: "", targetId: uuid(12) });
      assert.equal(result.state, "validation");
      assert.equal(result.code, "idempotency_key_invalid");
      assert.equal(await count("idempotency_records"), 0);
    });

    it("removes only expired rows with the cleanup function, which only the operator role may call", async () => {
      await place(db, "key-keep", uuid(13));
      await place(db, "key-drop", uuid(14));
      await db.query(
        "update idempotency_records set created_at = now() - interval '2 days', expires_at = now() - interval '1 day' where idempotency_key = 'key-drop'",
      );
      for (const role of ["anon", "authenticated"] as const) {
        const error = await failureOf(() =>
          asActor(db, schema, { role, account: SUPER_ADMIN }, () =>
            db.query("select platform_cleanup_expired()"),
          ),
        );
        assert.equal(error?.code, "42501", role);
      }
      const removed = await asActor(db, schema, { role: "service_role" }, () =>
        db.query("select platform_cleanup_expired() as removed"),
      );
      assert.equal(removed.rows[0].removed, 1);
      const left = await db.query("select idempotency_key from idempotency_records");
      assert.deepEqual(
        left.rows.map((row) => row.idempotency_key),
        ["key-keep"],
      );
    });

    it("has the unique key and expiry indexes the lookups use (NFR3.3)", async () => {
      const result = await db.query(
        "select indexdef from pg_indexes where schemaname = $1 and tablename = 'idempotency_records'",
        [schema],
      );
      const definitions = result.rows.map((row) => String(row.indexdef));
      assert.ok(
        definitions.some(
          (text) =>
            text.includes("UNIQUE") && text.includes("(account_id, operation, idempotency_key)"),
        ),
      );
      assert.ok(definitions.some((text) => text.includes("(expires_at)")));
    });

    it("adds less than 50 ms for the lookup and the store of one operation (NFR4.5)", async () => {
      const runs = 60;
      const started = performance.now();
      for (let n = 0; n < runs; n++) {
        await db.query("select platform_idempotency_check('op.timing', $1, $2)", [
          `t-${n}`,
          FINGERPRINT,
        ]);
        await db.query("select platform_idempotency_store('op.timing', $1, $2, 'success', null)", [
          `t-${n}`,
          FINGERPRINT,
        ]);
      }
      const perOperation = (performance.now() - started) / runs;
      report(
        `idempotency lookup and store in ${schema}: ${perOperation.toFixed(2)} ms per operation (target under 50 ms)`,
      );
      assert.ok(perOperation < 50);
    });
  });
}
