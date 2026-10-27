import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { resetWorkerData } from "../../scripts/db/worker.ts";
import {
  asActor,
  failureOf,
  lockSchemas,
  openDatabase,
  ORGANIZATION,
  OUTSIDER,
  PARENT,
  prepareSchema,
  seedGrants,
  SUPER_ADMIN,
  SYSTEM_ACCOUNT,
  useSchema,
  uuid,
} from "./stack-support.ts";

/**
 * The denied-call audit limit (follow-up B3, migration 20261046): at most 20 denied audit events per account in any
 * sliding 60 minutes. The caller's result never changes; success events and the system account are never limited.
 * Denials come from `lifecycle_hold_place` called by an account without the super admin role. Aged events are placed
 * through the owner connection with an explicit `occurred_at`, never by waiting.
 */
const LIMIT = 20;

for (const schema of ["worker_1", "public"]) {
  describe(`denied audit limit in ${schema}`, () => {
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

    const asAuthenticated = (account: string) => ({ role: "authenticated" as const, account });

    /** Calls `lifecycle_hold_place` as the account on the given connection and returns the result envelope. */
    const placeAs = async (client: pg.Client, account: string, key: string, target = uuid(1)) =>
      (
        await asActor(client, schema, asAuthenticated(account), () =>
          client.query(
            "select lifecycle_hold_place($1, 'child', $2, $3, 'legal_hold:case_1') as result",
            [key, target, ORGANIZATION],
          ),
        )
      ).rows[0].result as { state: string; code: string | null };

    const countEvents = async (account: string, outcome: "denied" | "success") =>
      (
        await db.query(
          "select count(*)::int as n from audit_events where actor_account_id = $1 and outcome = $2",
          [account, outcome],
        )
      ).rows[0].n as number;

    /** Inserts `count` events of the account as the schema owner, all with the given age (a Postgres interval text). */
    const insertEvents = (
      account: string,
      role: string,
      outcome: "denied" | "success",
      count: number,
      age: string,
    ) =>
      db.query(
        `insert into audit_events (actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome, occurred_at)
         select $1, $2, 'lifecycle.hold_place', 'child', gen_random_uuid(), $3, $4, now() - $5::interval
           from generate_series(1, $6)`,
        [account, role, ORGANIZATION, outcome, age, count],
      );

    it("writes the 1st to 20th denied events of an account and not the 21st, and the 21st call and its replay still return denied", async () => {
      for (let n = 1; n <= LIMIT; n++) {
        const result = await placeAs(db, PARENT, `deny-${n}`);
        assert.equal(result.state, "denied", `call ${n}`);
        assert.equal(await countEvents(PARENT, "denied"), n, `event of call ${n}`);
      }
      const over = await placeAs(db, PARENT, "deny-21");
      assert.equal(over.state, "denied");
      assert.equal(over.code, "authorization_denied");
      assert.equal(await countEvents(PARENT, "denied"), LIMIT);
      const replay = await placeAs(db, PARENT, "deny-21");
      assert.equal(replay.state, "denied");
      assert.equal(replay.code, "replayed");
      assert.equal(await countEvents(PARENT, "denied"), LIMIT);
      assert.equal((await db.query("select count(*)::int as n from lifecycle_holds")).rows[0].n, 0);
    });

    it("counts a sliding 60-minute window: 20 events aged 61 minutes do not block, 20 aged 59 minutes do", async () => {
      await insertEvents(PARENT, "parent", "denied", LIMIT, "61 minutes");
      assert.equal((await placeAs(db, PARENT, "deny-old")).state, "denied");
      assert.equal(await countEvents(PARENT, "denied"), LIMIT + 1);

      await db.query("truncate audit_events, idempotency_records");
      await insertEvents(PARENT, "parent", "denied", LIMIT, "59 minutes");
      assert.equal((await placeAs(db, PARENT, "deny-recent")).state, "denied");
      assert.equal(await countEvents(PARENT, "denied"), LIMIT);
    });

    it("keeps accounts independent: with one account at the limit, another account's denial is written", async () => {
      await insertEvents(PARENT, "parent", "denied", LIMIT, "1 minute");
      assert.equal((await placeAs(db, PARENT, "deny-parent")).state, "denied");
      assert.equal(await countEvents(PARENT, "denied"), LIMIT);
      assert.equal((await placeAs(db, OUTSIDER, "deny-outsider")).state, "denied");
      assert.equal(await countEvents(OUTSIDER, "denied"), 1);
    });

    it("limits only denied events: a success is written at the limit, and success events do not count", async () => {
      await insertEvents(SUPER_ADMIN, "super_admin", "denied", LIMIT, "1 minute");
      assert.equal((await placeAs(db, SUPER_ADMIN, "place-ok")).state, "success");
      assert.equal(await countEvents(SUPER_ADMIN, "success"), 1);

      await insertEvents(PARENT, "parent", "success", LIMIT, "1 minute");
      assert.equal((await placeAs(db, PARENT, "deny-after-success")).state, "denied");
      assert.equal(await countEvents(PARENT, "denied"), 1);
    });

    it("exempts the system account: 21 denied events written by the system caller are all stored", async () => {
      for (let n = 1; n <= LIMIT + 1; n++) {
        const id = (
          await db.query(
            "select platform_audit_write('lifecycle.hold_place', 'child', $1, $2, null, 'denied', null) as id",
            [uuid(n), ORGANIZATION],
          )
        ).rows[0].id;
        assert.ok(id, `system event ${n} has an id`);
      }
      assert.equal(await countEvents(SYSTEM_ACCOUNT, "denied"), LIMIT + 1);
    });

    it("holds the limit under simultaneous calls: 25 concurrent denied calls of one account store exactly 20 events", async () => {
      const clients: pg.Client[] = [];
      try {
        for (let n = 0; n < 25; n++) clients.push(await openDatabase());
        const results = await Promise.all(
          clients.map((client, n) => placeAs(client, PARENT, `concurrent-${n}`)),
        );
        assert.ok(results.every((result) => result.state === "denied"));
      } finally {
        await Promise.all(clients.map((client) => client.end()));
      }
      assert.equal(await countEvents(PARENT, "denied"), LIMIT);
    });

    it("keeps the audit write closed to anon, authenticated and service_role, and has the partial index", async () => {
      for (const actor of [
        { role: "anon" as const },
        asAuthenticated(PARENT),
        { role: "service_role" as const },
      ]) {
        const error = await failureOf(() =>
          asActor(db, schema, actor, () =>
            db.query(
              "select platform_audit_write('lifecycle.hold_place', 'child', $1, $2, null, 'denied', null)",
              [uuid(1), ORGANIZATION],
            ),
          ),
        );
        assert.equal(error?.code, "42501", `${actor.role} must be refused`);
      }
      const definition = (
        await db.query(
          `select p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = $1 and p.proname = 'platform_audit_write'`,
          [schema],
        )
      ).rows;
      assert.equal(definition.length, 1);
      assert.equal(definition[0].prosecdef, true);
      assert.ok(
        (definition[0].proconfig as string[]).some((setting) => setting.startsWith("search_path=")),
      );
      const index = (
        await db.query(
          "select indexdef from pg_indexes where schemaname = $1 and tablename = 'audit_events' and indexname = 'audit_events_actor_denied'",
          [schema],
        )
      ).rows;
      assert.equal(index.length, 1);
      const indexdef = String(index[0].indexdef);
      assert.ok(indexdef.includes("(actor_account_id, occurred_at DESC)"), indexdef);
      assert.match(indexdef, /WHERE \(outcome = 'denied'::text\)/);
    });
  });
}
