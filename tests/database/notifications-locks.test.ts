import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  callFunction,
  FAMILY_1,
  GROUP_1,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_1,
  uuid,
} from "./directory-support.ts";
import { NOTIFICATION_SCHEMAS } from "./notifications-support.ts";
import { ensureAccount, failureOf, openDatabase, sessionIdFor } from "./stack-support.ts";

const ACCOUNT_A = "bbbbbbbb-0000-4000-8000-000000000051";
const ACCOUNT_B = "bbbbbbbb-0000-4000-8000-000000000053";
const FAMILY_A = uuid(9601);
const FAMILY_B = uuid(9602);
const PARENT_A = uuid(9611);
const PARENT_B = uuid(9613);
/** The lower task id (held by family A) and the higher task id (held by family B): the swap partners. */
const TASK_LOW = uuid(9621);
const TASK_HIGH = uuid(9622);

const ROUNDS = 8;
const DEADLOCK = "40P01";

type Result = Awaited<ReturnType<typeof callFunction>>;
type Outcome = { result?: Result; error?: Error & { code?: string } };

/**
 * Lock order of the notice and reminder hooks under the recipient scope `group` (U3 NFR3.8: family row first,
 * then task rows in ascending id order). Under that scope the reminder planning of a family touches the tasks
 * of the family's whole group, including tasks below the ones the family holds a place on, so a wrapper that
 * planned after the use case had locked its own tasks would take a lower task after a higher one. A swap
 * exchange and `settings_save` take tasks in ascending order, so the two could wait for each other. Each
 * deterministic test below holds the lower task from a second connection, starts the archive, waits until the
 * archive is blocked, and only then lets the other side take the higher task; on a wrong lock order the two
 * wait for each other and Postgres cancels one of them (SQLSTATE 40P01). The repeated races then run the real
 * functions against each other without any help.
 */
for (const schema of NOTIFICATION_SCHEMAS) {
  describe(`reminder planning lock order in ${schema}`, () => {
    let db: pg.Client;
    let holder: pg.Client;
    const connections: pg.Client[] = [];

    before(async () => {
      db = await openDirectoryDatabase(schema);
      holder = await openDatabase();
      for (let index = 0; index < 5; index += 1) connections.push(await openDatabase());
    });
    after(async () => {
      await Promise.all([...connections, holder].map((client) => client.end()));
      await db.end();
    });
    beforeEach(async () => {
      await world();
    });

    const as = (
      account: string,
      sql: string,
      values: unknown[] = [],
      client = db,
    ): Promise<Result> => callFunction(client, schema, account, sql, values);
    const taskVersion = async (id: string) =>
      (await db.query("select version from tasks where id = $1", [id])).rows[0].version as number;
    const placeOf = async (family: string, task: string) =>
      (
        await db.query(
          "select id, version from assignments where family_id = $1 and task_id = $2 and status <> 'removed'",
          [family, task],
        )
      ).rows[0] as { id: string; version: number };
    const familyVersion = async (id: string) =>
      (await db.query("select version from families where id = $1", [id])).rows[0]
        .version as number;
    const settle = (work: Promise<Result>): Promise<Outcome> =>
      work.then(
        (result) => ({ result }),
        (error: Error & { code?: string }) => ({ error }),
      );

    /** Two families of group 1, the group scope, family A on the lower task and family B on the higher one. */
    async function world() {
      await seedCoordinationWorld(db, schema);
      for (const id of [ACCOUNT_A, ACCOUNT_B]) {
        await ensureAccount(db, { id, organization: ORGANIZATION });
      }
      await db.query(
        "insert into families (id, organization_id, display_name) values ($1, $3, 'Zár A család'), ($2, $3, 'Zár B család')",
        [FAMILY_A, FAMILY_B, ORGANIZATION],
      );
      await db.query(
        `insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id)
         values ($1, 'parent', 'family', $3, $5), ($2, 'parent', 'family', $4, $5)`,
        [ACCOUNT_A, ACCOUNT_B, FAMILY_A, FAMILY_B, ORGANIZATION],
      );
      await db.query(
        `insert into parents (id, organization_id, family_id, display_name, account_id)
         values ($1, $3, $4, 'Zár Aranka', $5), ($2, $3, $6, 'Zár Berta', $7)`,
        [PARENT_A, PARENT_B, ORGANIZATION, FAMILY_A, ACCOUNT_A, FAMILY_B, ACCOUNT_B],
      );
      await db.query(
        "insert into group_memberships (organization_id, parent_id, group_id) values ($1, $2, $4), ($1, $3, $4)",
        [ORGANIZATION, PARENT_A, PARENT_B, GROUP_1],
      );
      await db.query(
        `insert into tasks (id, organization_id, group_id, title, capacity, starts_at, ends_at, location)
         values ($1, $3, $4, 'Zár alsó', 2, now() + interval '8 days', now() + interval '8 days 2 hours', 'Terem'),
                ($2, $3, $4, 'Zár felső', 2, now() + interval '9 days', now() + interval '9 days 2 hours', 'Kert')`,
        [TASK_LOW, TASK_HIGH, ORGANIZATION, GROUP_1],
      );
      const setting = await as(SUPER_ADMIN, "settings_get()");
      const saved = await as(SUPER_ADMIN, "settings_save($1, $2, $3, $4)", [
        nextKey("scope"),
        setting.version,
        true,
        "group",
      ]);
      assert.equal(saved.state, "success");
      const lowSignUp = await as(ACCOUNT_A, "duty_sign_up($1, $2, $3)", [
        nextKey("su"),
        TASK_LOW,
        await taskVersion(TASK_LOW),
      ]);
      const highSignUp = await as(ACCOUNT_B, "duty_sign_up($1, $2, $3)", [
        nextKey("su"),
        TASK_HIGH,
        await taskVersion(TASK_HIGH),
      ]);
      assert.deepEqual([lowSignUp.state, highSignUp.state], ["success", "success"]);
    }

    /** A swap request of family A (lower task) to family B (higher task), not yet answered. */
    async function requestSwap(): Promise<string> {
      const source = await placeOf(FAMILY_A, TASK_LOW);
      const target = await placeOf(FAMILY_B, TASK_HIGH);
      const request = await as(ACCOUNT_A, "swap_request($1, $2, $3, $4, $5, $6)", [
        nextKey("sw"),
        source.id,
        source.version,
        target.id,
        target.version,
        null,
      ]);
      assert.equal(request.state, "success");
      return request.reference as string;
    }

    async function waitUntilBlocked(pid: number) {
      for (let attempt = 0; attempt < 400; attempt += 1) {
        const waiting = await db.query(
          "select 1 from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'",
          [pid],
        );
        if (waiting.rowCount) return;
        await sleep(25);
      }
      throw new Error("the archive never started waiting for a lock");
    }

    /**
     * The crossing: the holder takes the lower task (as the first step of an exchange or of a settings save),
     * the archive of family B starts and waits behind it, then the holder carries on with its real work, which
     * needs the higher task. Returns what each side got.
     */
    async function crossing(
      held: string,
      second: (client: pg.Client) => Promise<unknown>,
    ): Promise<{ archive: Outcome; other: (Error & { code?: string }) | undefined }> {
      const pid = (await connections[0]!.query("select pg_backend_pid() as pid")).rows[0]
        .pid as number;
      await holder.query("begin");
      await holder.query(`set local search_path to "${schema}", pg_catalog`);
      await holder.query("select 1 from tasks where id = $1 for update", [held]);
      const archive = settle(
        as(
          SUPER_ADMIN,
          "family_archive($1, $2, $3)",
          [nextKey("fa"), FAMILY_B, await familyVersion(FAMILY_B)],
          connections[0]!,
        ),
      );
      await waitUntilBlocked(pid);
      const other = await failureOf(() => second(holder));
      await holder.query(other ? "rollback" : "commit");
      return { archive: await archive, other };
    }

    function assertNoDeadlock(outcome: Outcome | Error | undefined, label: string) {
      const error = outcome instanceof Error ? outcome : (outcome as Outcome | undefined)?.error;
      assert.notEqual(
        (error as { code?: string } | undefined)?.code,
        DEADLOCK,
        `${label}: deadlock`,
      );
      assert.equal(error, undefined, `${label}: ${error?.message}`);
    }

    it("lets a group-scope archive and a swap exchange that crosses it finish, with no deadlock", async () => {
      const request = await requestSwap();
      const { archive, other } = await crossing(TASK_LOW, async (client) => {
        // The exchange as family B answers it: it already holds the lower task and now takes the higher one.
        await client.query("set local role authenticated");
        await client.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({
            sub: ACCOUNT_B,
            role: "authenticated",
            session_id: sessionIdFor(ACCOUNT_B),
          }),
        ]);
        await client.query("select set_config('request.jwt.claim.sub', $1, true)", [ACCOUNT_B]);
        const answered = await client.query("select swap_respond($1, $2, true, null) as result", [
          nextKey("yes"),
          request,
        ]);
        await client.query("reset role");
        assert.equal(answered.rows[0].result.state, "success");
      });
      assertNoDeadlock(other, "the exchange");
      assertNoDeadlock(archive, "the archive");
      assert.equal(archive.result?.state, "success");
    });

    it("lets a group-scope archive and a settings save that crosses it finish, with no deadlock", async () => {
      const setting = await as(SUPER_ADMIN, "settings_get()");
      // A settings save takes the upcoming tasks from the lowest id up, so the task it holds is the lowest one.
      const { archive, other } = await crossing(TASK_1, async (client) => {
        await client.query("set local role authenticated");
        await client.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({
            sub: SUPER_ADMIN,
            role: "authenticated",
            session_id: sessionIdFor(SUPER_ADMIN),
          }),
        ]);
        await client.query("select set_config('request.jwt.claim.sub', $1, true)", [SUPER_ADMIN]);
        const saved = await client.query("select settings_save($1, $2, true, 'group') as result", [
          nextKey("set"),
          setting.version,
        ]);
        await client.query("reset role");
        assert.equal(saved.rows[0].result.state, "success");
      });
      assertNoDeadlock(other, "the settings save");
      assertNoDeadlock(archive, "the archive");
      assert.equal(archive.result?.state, "success");
    });

    it("keeps the planned recipients right after the archive that waited for the lower task", async () => {
      const request = await requestSwap();
      await crossing(TASK_LOW, async (client) => {
        await client.query("set local role authenticated");
        await client.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({
            sub: ACCOUNT_B,
            role: "authenticated",
            session_id: sessionIdFor(ACCOUNT_B),
          }),
        ]);
        await client.query("select set_config('request.jwt.claim.sub', $1, true)", [ACCOUNT_B]);
        await client.query("select swap_respond($1, $2, true, null)", [nextKey("yes"), request]);
        await client.query("reset role");
      });
      // Family B is archived, so under the group scope it is no recipient of any live job; the active families
      // of the group (the seeded family 1 and family A) still are.
      const rows = await db.query(
        `select distinct r.family_id from reminder_recipients r join reminder_jobs j on j.id = r.reminder_job_id
          where r.status = 'active' and j.status not in ('stale', 'cancelled') and j.task_id in ($1, $2)`,
        [TASK_LOW, TASK_HIGH],
      );
      assert.deepEqual(
        rows.rows.map((row) => row.family_id as string).sort(),
        [FAMILY_1, FAMILY_A].sort(),
      );
    });

    it("takes the family row before it reads the parents, so a parent linked while the lifecycle waits loses the notices too (lifecycle.run)", async () => {
      const lateParent = uuid(9690);
      const archived = await as(SUPER_ADMIN, "family_archive($1, $2, $3)", [
        nextKey("fa"),
        FAMILY_A,
        await familyVersion(FAMILY_A),
      ]);
      assert.equal(archived.state, "success");
      await db.query("update families set archived_at = now() - interval '40 days' where id = $1", [
        FAMILY_A,
      ]);
      const pid = (await connections[0]!.query("select pg_backend_pid() as pid")).rows[0]
        .pid as number;
      // Someone else holds the family row, as a directory save linking a parent would.
      await holder.query("begin");
      try {
        await holder.query(`set local search_path to "${schema}", pg_catalog`);
        await holder.query("select 1 from families where id = $1 for update", [FAMILY_A]);
        const lifecycle = settle(
          as(
            SUPER_ADMIN,
            "lifecycle_run($1, $2, $3, true)",
            [nextKey("lc"), FAMILY_A, await familyVersion(FAMILY_A)],
            connections[0]!,
          ),
        );
        await waitUntilBlocked(pid);
        await holder.query(
          "insert into parents (id, organization_id, family_id, display_name, status) values ($1, $2, $3, 'Késői szülő', 'archived')",
          [lateParent, ORGANIZATION, FAMILY_A],
        );
        await holder.query(
          "insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, dedupe_key) values ($1, $2, 'sign_up_confirmed', 'task', $3, $3, now(), 'late-notice')",
          [ORGANIZATION, lateParent, TASK_LOW],
        );
        await holder.query("commit");
        const outcome = await lifecycle;
        assertNoDeadlock(outcome, "the lifecycle");
        assert.deepEqual(
          [outcome.result?.state, outcome.result?.outcome],
          ["success", "anonymized"],
        );
      } catch (error) {
        await holder.query("rollback");
        throw error;
      }
      assert.equal(
        (
          await db.query("select count(*)::int as n from notifications where parent_id = $1", [
            lateParent,
          ])
        ).rows[0].n,
        0,
        "the notice of the parent linked while the lifecycle waited is deleted",
      );
      assert.equal(
        (
          await db.query("select count(*)::int as n from notifications where parent_id = $1", [
            PARENT_A,
          ])
        ).rows[0].n,
        0,
      );
    });

    it(`survives ${ROUNDS} parallel rounds of a group-scope archive against a swap exchange`, async () => {
      for (let round = 0; round < ROUNDS; round += 1) {
        await world();
        const request = await requestSwap();
        const answered = settle(
          as(
            ACCOUNT_B,
            "swap_respond($1, $2, true, null)",
            [nextKey("yes"), request],
            connections[1]!,
          ),
        );
        const archived = settle(
          as(
            SUPER_ADMIN,
            "family_archive($1, $2, $3)",
            [nextKey("fa"), FAMILY_B, await familyVersion(FAMILY_B)],
            connections[0]!,
          ),
        );
        const outcomes = await Promise.all([answered, archived]);
        outcomes.forEach((outcome, index) =>
          assertNoDeadlock(outcome, `round ${round} side ${index}`),
        );
        assert.ok(
          outcomes.every((outcome) =>
            ["success", "conflict", "invalidated"].includes(outcome.result!.state),
          ),
          `round ${round}: ${JSON.stringify(outcomes.map((outcome) => outcome.result))}`,
        );
      }
    });

    it(`survives ${ROUNDS} parallel rounds of an archive, a swap exchange, a settings save, a task change and a removal at once`, async () => {
      for (let round = 0; round < ROUNDS; round += 1) {
        await world();
        const request = await requestSwap();
        const setting = await as(SUPER_ADMIN, "settings_get()");
        const highTask = (
          await db.query("select starts_at, ends_at, version from tasks where id = $1", [TASK_HIGH])
        ).rows[0];
        const lowPlace = await placeOf(FAMILY_A, TASK_LOW);
        const outcomes = await Promise.all([
          settle(
            as(
              ACCOUNT_B,
              "swap_respond($1, $2, true, null)",
              [nextKey("yes"), request],
              connections[1]!,
            ),
          ),
          settle(
            as(
              SUPER_ADMIN,
              "family_archive($1, $2, $3)",
              [nextKey("fa"), FAMILY_B, await familyVersion(FAMILY_B)],
              connections[0]!,
            ),
          ),
          settle(
            as(
              SUPER_ADMIN,
              "settings_save($1, $2, true, 'group')",
              [nextKey("set"), setting.version],
              connections[2]!,
            ),
          ),
          settle(
            as(
              ADMIN_G1,
              "task_save($1, $2::jsonb)",
              [
                nextKey("ts"),
                JSON.stringify({
                  id: TASK_HIGH,
                  expected_version: highTask.version,
                  group_id: GROUP_1,
                  title: "Zár felső, új cím",
                  capacity: 2,
                  starts_at: (highTask.starts_at as Date).toISOString(),
                  ends_at: (highTask.ends_at as Date).toISOString(),
                }),
              ],
              connections[3]!,
            ),
          ),
          settle(
            as(
              ADMIN_G1,
              "assignment_remove($1, $2, $3)",
              [nextKey("rm"), lowPlace.id, lowPlace.version],
              connections[4]!,
            ),
          ),
        ]);
        outcomes.forEach((outcome, index) =>
          assertNoDeadlock(outcome, `round ${round} call ${index}`),
        );
      }
    });

    it(`survives ${ROUNDS} parallel rounds of a group-scope archive against a settings save`, async () => {
      for (let round = 0; round < ROUNDS; round += 1) {
        await world();
        const setting = await as(SUPER_ADMIN, "settings_get()");
        const saved = settle(
          as(
            SUPER_ADMIN,
            "settings_save($1, $2, true, 'group')",
            [nextKey("set"), setting.version],
            connections[1]!,
          ),
        );
        const archived = settle(
          as(
            SUPER_ADMIN,
            "family_archive($1, $2, $3)",
            [nextKey("fa"), FAMILY_B, await familyVersion(FAMILY_B)],
            connections[0]!,
          ),
        );
        const outcomes = await Promise.all([saved, archived]);
        outcomes.forEach((outcome, index) =>
          assertNoDeadlock(outcome, `round ${round} side ${index}`),
        );
        assert.deepEqual(
          outcomes.map((outcome) => outcome.result!.state),
          ["success", "success"],
          `round ${round}`,
        );
      }
    });
  });
}
