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
  prepareSchema,
  seedGrants,
  SUPER_ADMIN,
  SYSTEM_ACCOUNT,
  useSchema,
  uuid,
} from "./stack-support.ts";

/**
 * The audit purge (NFR1.68, NFR2.35, NFR6.27): events older than 365 days can be deleted by the system caller's
 * housekeeping and by nothing else; updates are never allowed. Aged events are placed through the owner connection with
 * an explicit `occurred_at`, never by waiting.
 */
for (const schema of ["worker_1", "public"]) {
  describe(`audit purge in ${schema}`, () => {
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

    /** Inserts an event as the schema owner with the given age; the age is a Postgres interval text. */
    const insertEvent = async (n: number, age: string) => {
      await db.query(
        `insert into audit_events (actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome, occurred_at)
         values ($1, 'system', 'role.grant', 'account', $2, $3, 'success', now() - $4::interval)`,
        [SYSTEM_ACCOUNT, uuid(n), ORGANIZATION, age],
      );
      return uuid(n);
    };
    const remaining = async () =>
      (await db.query("select target_id from audit_events order by target_id")).rows.map((row) =>
        String(row.target_id),
      );
    const purgeAs = (actor: Parameters<typeof asActor>[2]) =>
      asActor(
        db,
        schema,
        actor,
        async () => (await db.query("select audit_purge() as purged")).rows[0].purged as number,
      );
    const service = { role: "service_role" as const };

    it("deletes only events older than 365 days: one just over goes, one just under stays", async () => {
      const over = await insertEvent(1, "365 days 1 hour");
      const under = await insertEvent(2, "364 days 23 hours");
      const recent = await insertEvent(3, "1 minute");
      assert.equal(await purgeAs(service), 1);
      const left = await remaining();
      assert.deepEqual(left, [under, recent].sort());
      assert.ok(!left.includes(over));
    });

    it("returns the number of deleted events and zero when nothing is old enough", async () => {
      assert.equal(await purgeAs(service), 0);
      await insertEvent(1, "10 days");
      assert.equal(await purgeAs(service), 0);
      for (let n = 10; n < 15; n++) await insertEvent(n, "400 days");
      assert.equal(await purgeAs(service), 5);
      assert.equal(await purgeAs(service), 0);
      assert.equal((await remaining()).length, 1);
    });

    it("is executable only by the system caller: anon, signed-in accounts and everyone else are refused", async () => {
      await insertEvent(1, "400 days");
      for (const actor of [
        { role: "anon" as const },
        { role: "authenticated" as const, account: SUPER_ADMIN },
      ]) {
        const error = await failureOf(() => purgeAs(actor));
        assert.equal(error?.code, "42501", actor.role);
      }
      assert.equal((await remaining()).length, 1, "the refused calls deleted nothing");
      assert.equal(await purgeAs(service), 1);
    });

    it("is callable by the owner connection (the operator and the tests) as a system caller", async () => {
      await insertEvent(1, "400 days");
      const result = await db.query("select audit_purge() as purged");
      assert.equal(result.rows[0].purged, 1);
    });

    it("still refuses every update, even for an old event and with the purge setting on", async () => {
      await insertEvent(1, "400 days");
      for (const setting of ["off", "on"]) {
        await db.query("begin");
        try {
          await db.query("select set_config('app.audit_purge', $1, true)", [setting]);
          const error = await failureOf(() =>
            db.query("update audit_events set details = 'changed'"),
          );
          assert.equal(error?.code, "42501", `setting ${setting}`);
          assert.match(error?.message ?? "", /append-only/);
        } finally {
          await db.query("rollback");
        }
      }
      assert.equal((await remaining()).length, 1);
    });

    it("still refuses a delete outside the purge, even for an event older than 365 days", async () => {
      await insertEvent(1, "400 days");
      const error = await failureOf(() => db.query("delete from audit_events"));
      assert.equal(error?.code, "42501");
      assert.match(error?.message ?? "", /append-only/);
      assert.equal((await remaining()).length, 1);
    });

    it("still refuses to delete a recent event while the purge setting is on", async () => {
      await insertEvent(1, "10 days");
      const recent = await insertEvent(2, "364 days 23 hours");
      const old = await insertEvent(3, "366 days");
      // A failed statement aborts its transaction, so every attempt gets a transaction of its own.
      const attempt = async (target: string) => {
        await db.query("begin");
        try {
          await db.query("select set_config('app.audit_purge', 'on', true)");
          return {
            error: await failureOf(() =>
              db.query("delete from audit_events where target_id = $1", [target]),
            ),
          };
        } finally {
          await db.query("rollback");
        }
      };
      for (const target of [uuid(1), recent]) {
        assert.equal((await attempt(target)).error?.code, "42501", target);
      }
      assert.equal(
        (await attempt(old)).error,
        undefined,
        "the aged event may go while the setting is on",
      );
      assert.equal((await remaining()).length, 3, "every attempt was rolled back");
    });

    it("lets the setting live only inside the purge's own transaction: it is off again afterwards", async () => {
      await insertEvent(1, "400 days");
      await db.query("begin");
      try {
        await db.query("select audit_purge()");
        const setting = await db.query("select current_setting('app.audit_purge', true) as value");
        assert.equal(setting.rows[0].value, "off");
        await insertEvent(2, "400 days");
        const error = await failureOf(() => db.query("delete from audit_events"));
        assert.equal(
          error?.code,
          "42501",
          "a delete after the purge, in the same transaction, is refused",
        );
      } finally {
        await db.query("rollback");
      }
      const outside = await db.query("select current_setting('app.audit_purge', true) as value");
      assert.ok(
        !outside.rows[0].value || outside.rows[0].value === "off",
        "nothing leaks to the session",
      );
    });

    it("gives no application role a delete right, so the setting alone changes nothing for them", async () => {
      await insertEvent(1, "400 days");
      for (const actor of [
        { role: "anon" as const },
        { role: "authenticated" as const, account: SUPER_ADMIN },
        service,
      ]) {
        const error = await failureOf(() =>
          asActor(db, schema, actor, async () => {
            await db.query("select set_config('app.audit_purge', 'on', true)");
            await db.query("delete from audit_events");
          }),
        );
        assert.equal(error?.code, "42501", actor.role);
      }
      assert.equal((await remaining()).length, 1);
    });

    it("writes no audit event of its own and returns a plain number without personal data", async () => {
      await insertEvent(1, "400 days");
      await insertEvent(2, "1 day");
      const result = await asActor(
        db,
        schema,
        service,
        async () => (await db.query("select audit_purge() as purged")).rows[0],
      );
      assert.deepEqual(Object.keys(result), ["purged"]);
      assert.equal(typeof result.purged, "number");
      assert.deepEqual(
        await remaining(),
        [uuid(2)],
        "only the recent event is left, nothing was added",
      );
    });

    it("deletes a large aged set in one call and keeps every recent event", async () => {
      await db.query(
        `insert into audit_events (actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome, occurred_at)
         select $1, 'system', 'role.grant', 'account', gen_random_uuid(), $2, 'success',
                now() - (case when n % 2 = 0 then interval '500 days' else interval '30 days' end)
           from generate_series(1, 600) as n`,
        [SYSTEM_ACCOUNT, ORGANIZATION],
      );
      assert.equal(await purgeAs(service), 300);
      assert.equal((await remaining()).length, 300);
    });

    /** Inserts `total` aged events, the nth being `366 days + n minutes` old, so a higher n is older. */
    const insertAged = async (total: number) =>
      db.query(
        `insert into audit_events (actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome, occurred_at)
         select $1, 'system', 'role.grant', 'account', gen_random_uuid(), $2, 'success',
                now() - interval '366 days' - n * interval '1 minute'
           from generate_series(1, $3::int) as n`,
        [SYSTEM_ACCOUNT, ORGANIZATION, total],
      );
    const agedCount = async () =>
      (
        await db.query(
          "select count(*)::int as n from audit_events where occurred_at < now() - interval '365 days'",
        )
      ).rows[0].n as number;

    // Follow-up B1 (FR2): one call deletes at most 5000 rows, the oldest first; the rest is left for the next run.
    it("deletes at most 5000 aged events per call, oldest first, and leaves the rest for the next call", async () => {
      await insertAged(5001);
      await insertEvent(1, "1 day");
      assert.equal(await purgeAs(service), 5000);
      assert.equal(await agedCount(), 1, "one aged event is left");
      const survivor = await db.query(
        "select (now() - occurred_at) < interval '366 days 2 minutes' as youngest from audit_events where occurred_at < now() - interval '365 days'",
      );
      assert.equal(survivor.rows[0].youngest, true, "the youngest aged event is the one left");
      assert.equal(await purgeAs(service), 1);
      assert.equal(await purgeAs(service), 0);
      assert.deepEqual(await remaining(), [uuid(1)], "the recent event was never touched");
    });

    it("deletes exactly 5000 aged events in one call and leaves none", async () => {
      await insertAged(5000);
      assert.equal(await purgeAs(service), 5000);
      assert.equal(await agedCount(), 0);
      assert.equal(await purgeAs(service), 0);
    });

    it("is a security-definer function with a pinned search path and no rights for anon or everyone", async () => {
      const row = (
        await db.query(
          `select p.prosecdef, p.proconfig,
                  has_function_privilege('anon', p.oid, 'execute') as anon,
                  has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
                  has_function_privilege('service_role', p.oid, 'execute') as service_role,
                  has_function_privilege('public', p.oid, 'execute') as public
             from pg_proc p where p.proname = 'audit_purge' and p.pronamespace = current_schema()::regnamespace`,
        )
      ).rows[0];
      assert.equal(row.prosecdef, true);
      assert.ok((row.proconfig as string[]).some((setting) => setting.startsWith("search_path=")));
      assert.deepEqual(
        [row.anon, row.authenticated, row.public, row.service_role],
        [false, false, false, true],
      );
    });
  });
}
