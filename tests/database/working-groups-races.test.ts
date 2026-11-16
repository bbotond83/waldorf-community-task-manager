import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, nextKey, openDirectoryDatabase } from "./directory-support.ts";
import { ensureAccount, openDatabase, report, uuid } from "./stack-support.ts";
import {
  caller,
  GROUP_1,
  groupAdminWithoutMembership,
  openGrants,
  ORGANIZATION,
  seedGroupWorld,
  SUPER_ADMIN,
} from "./working-groups-support.ts";

/**
 * The four race tests of the scalability design (NFR5.11, NFR5.12), each run 50 times on separate connections with
 * no deadlock error allowed: a join against the removal of the same parent; a coordinator's leave, a revoke and an
 * appointment, each against the family's lifecycle step. They live apart from working-groups.test.ts so they can be
 * run on their own.
 *
 * In the three lifecycle races every parent of the family has a linked account, so the lifecycle step really locks
 * and bumps their version rows. The lifecycle needs an archived family, and an archived family has no current parent,
 * so a leave sent after the archive is simply refused. To make the leave a real contender, a third connection holds the
 * membership row while the leave is sent (the leave has passed its caller check and waits for the row), then archives
 * the family and lets go, and the lifecycle starts at the same moment the leave resumes. A revoke needs no parent, so
 * it races the lifecycle directly. An appointment of a member of an archived family is refused by the grant function, but
 * it still takes the membership lock first, which is what the test is about.
 */
const ITERATIONS = 50;
const ACCOUNT_1 = "bbbbbbbb-0000-4000-8000-000000000501";
const ACCOUNT_2 = "bbbbbbbb-0000-4000-8000-000000000502";
const FAMILY = uuid(9501);
const PARENT_1 = uuid(9502);
const PARENT_2 = uuid(9503);
const MEMBERSHIP_1 = uuid(9504);
const MEMBERSHIP_2 = uuid(9505);

type Outcome = { value?: unknown; error?: Error & { code?: string } };
const settled = async (work: Promise<unknown>): Promise<Outcome> =>
  work.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`working group races in ${schema}`, () => {
    let db: pg.Client;
    let sender: pg.Client;
    let other: pg.Client;
    let holder: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      sender = await openDatabase();
      other = await openDatabase();
      holder = await openDatabase();
    });
    after(async () => {
      await Promise.all([sender.end(), other.end(), holder.end()]);
      await db.end();
    });
    beforeEach(() => seedGroupWorld(db, schema));

    const onSender = caller(() => sender, schema);
    const onOther = caller(() => other, schema);

    /** One family whose two parents both have linked accounts, rebuilt before every iteration. */
    async function prepare(options: {
      coordinator: boolean;
      archived: boolean;
      memberTwo: boolean;
    }) {
      const parents = [PARENT_1, PARENT_2];
      await db.query("delete from notifications where parent_id = any ($1)", [parents]);
      await db.query("delete from app_role_grants where subject_id in ($1, $2)", [
        ACCOUNT_1,
        ACCOUNT_2,
      ]);
      await db.query("delete from group_memberships where parent_id = any ($1)", [parents]);
      await db.query("delete from parent_profiles where parent_id = any ($1)", [parents]);
      await db.query("delete from parents where id = any ($1)", [parents]);
      await db.query("delete from families where id = $1", [FAMILY]);
      await ensureAccount(db, { id: ACCOUNT_1, organization: ORGANIZATION });
      await ensureAccount(db, { id: ACCOUNT_2, organization: ORGANIZATION });
      await db.query(
        `insert into families (id, organization_id, display_name, status, archived_at)
         values ($1, $2, 'Verseny család', $3::text, case when $3::text = 'archived' then now() - interval '40 days' end)`,
        [FAMILY, ORGANIZATION, options.archived ? "archived" : "active"],
      );
      await db.query(
        `insert into parents (id, organization_id, family_id, display_name, account_id, status)
         values ($1, $3, $4, 'Verseny Egy', $5, $7), ($2, $3, $4, 'Verseny Kettő', $6, $7)`,
        [
          PARENT_1,
          PARENT_2,
          ORGANIZATION,
          FAMILY,
          ACCOUNT_1,
          ACCOUNT_2,
          options.archived ? "archived" : "active",
        ],
      );
      await db.query(
        "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, 'parent', 'family', $3, $4), ($2, 'parent', 'family', $3, $4)",
        [ACCOUNT_1, ACCOUNT_2, FAMILY, ORGANIZATION],
      );
      await db.query(
        "insert into group_memberships (id, organization_id, parent_id, group_id) values ($1, $2, $3, $4)",
        [MEMBERSHIP_1, ORGANIZATION, PARENT_1, GROUP_1],
      );
      if (options.memberTwo) {
        await db.query(
          "insert into group_memberships (id, organization_id, parent_id, group_id) values ($1, $2, $3, $4)",
          [MEMBERSHIP_2, ORGANIZATION, PARENT_2, GROUP_1],
        );
      }
      if (options.coordinator) {
        await db.query(
          "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, 'group_admin', 'group', $2, $3)",
          [ACCOUNT_1, GROUP_1, ORGANIZATION],
        );
      }
      await db.query(
        "insert into app_authorization_versions (subject_id, authorization_version) values ($1, 1), ($2, 1) on conflict do nothing",
        [ACCOUNT_1, ACCOUNT_2],
      );
    }
    const familyVersion = async () =>
      (await db.query("select version from families where id = $1", [FAMILY])).rows[0]
        .version as number;
    const noDeadlock = (outcomes: Outcome[], label: string) => {
      for (const outcome of outcomes) {
        assert.equal(outcome.error?.code, undefined, `${label}: ${outcome.error?.message}`);
      }
    };
    const lifecycle = (client: "sender" | "other", version: number) =>
      (client === "sender" ? onSender : onOther)(SUPER_ADMIN, "lifecycle_run($1, $2, $3, true)", [
        nextKey("lc"),
        FAMILY,
        version,
      ]);

    it(`join against the removal of the same parent, ${ITERATIONS} times`, async () => {
      const started = performance.now();
      let joinedFirst = 0;
      for (let round = 0; round < ITERATIONS; round += 1) {
        await prepare({ coordinator: false, archived: false, memberTwo: false });
        const joining = settled(
          onSender(ACCOUNT_2, "working_group_join($1, $2)", [nextKey("join"), GROUP_1]),
        );
        const removing = settled(
          (async () => {
            await other.query("begin");
            try {
              await other.query(`set local search_path to "${schema}", pg_catalog`);
              await other.query("select working_groups_removal_apply('parent', $1)", [PARENT_2]);
              await other.query("select directory_removal_apply('parent', $1)", [PARENT_2]);
              await other.query("commit");
            } catch (error) {
              await other.query("rollback").catch(() => undefined);
              throw error;
            }
          })(),
        );
        const outcomes = await Promise.all([joining, removing]);
        // Once the removal has ended the account, the join's own session check refuses it with an error; that is the
        // expected "removal came first" outcome, so only the removal must run clean here.
        noDeadlock([outcomes[1]], `round ${round}`);
        for (const code of ["40P01", "40001"])
          assert.notEqual(outcomes[0].error?.code, code, `round ${round}`);
        if (outcomes[0].error) {
          assert.match(outcomes[0].error.message, /session is not active/, `round ${round}`);
        } else {
          const answer = outcomes[0].value as { state: string };
          assert.ok(
            ["success", "denied"].includes(answer.state),
            `round ${round}: ${JSON.stringify(answer)}`,
          );
          if (answer.state === "success") joinedFirst += 1;
        }
        const active = await db.query(
          "select count(*)::int as n from group_memberships where parent_id = $1 and status = 'active'",
          [PARENT_2],
        );
        assert.equal(
          active.rows[0].n,
          0,
          `round ${round}: the removed parent holds no active membership`,
        );
        assert.deepEqual(await groupAdminWithoutMembership(db), []);
      }
      report(
        `join against removal in ${schema}: ${ITERATIONS} rounds in ${(performance.now() - started).toFixed(0)} ms, join first in ${joinedFirst}`,
      );
    });

    it(`a coordinator's leave against the lifecycle step on their family, ${ITERATIONS} times`, async () => {
      const started = performance.now();
      for (let round = 0; round < ITERATIONS; round += 1) {
        await prepare({ coordinator: true, archived: false, memberTwo: true });
        const version = await familyVersion();
        // The third connection holds the membership, so the leave has passed its caller check and waits for the row.
        await holder.query("begin");
        await holder.query(`set local search_path to "${schema}", pg_catalog`);
        await holder.query("select 1 from group_memberships where id = $1 for update", [
          MEMBERSHIP_1,
        ]);
        const leaving = settled(
          onSender(ACCOUNT_1, "working_group_leave($1, $2, $3)", [
            nextKey("leave"),
            MEMBERSHIP_1,
            1,
          ]),
        );
        await sleep(15);
        // The family leaves (archived with its parents) and the row is let go; the lifecycle starts as the leave resumes.
        await holder.query("update parents set status = 'archived' where family_id = $1", [FAMILY]);
        await holder.query(
          "update families set status = 'archived', archived_at = now() - interval '40 days' where id = $1",
          [FAMILY],
        );
        await holder.query("commit");
        const running = settled(lifecycle("other", version + 1));
        const outcomes = await Promise.all([leaving, running]);
        noDeadlock(outcomes, `round ${round}`);
        assert.deepEqual(await openGrants(db, ACCOUNT_1), [], `round ${round}: no grant is left`);
        assert.deepEqual(await groupAdminWithoutMembership(db), [], `round ${round}`);
      }
      report(
        `leave against lifecycle in ${schema}: ${ITERATIONS} rounds in ${(performance.now() - started).toFixed(0)} ms`,
      );
    });

    it(`a revoke against the lifecycle step, ${ITERATIONS} times`, async () => {
      const started = performance.now();
      for (let round = 0; round < ITERATIONS; round += 1) {
        await prepare({ coordinator: true, archived: true, memberTwo: true });
        const version = await familyVersion();
        const outcomes = await Promise.all([
          settled(
            onSender(SUPER_ADMIN, "coordinator_revoke($1, $2, $3)", [
              nextKey("rev"),
              MEMBERSHIP_1,
              1,
            ]),
          ),
          settled(lifecycle("other", version)),
        ]);
        noDeadlock(outcomes, `round ${round}`);
        const revoked = outcomes[0].value as { state: string; code: string | null };
        assert.ok(
          ["success", "conflict", "denied"].includes(revoked.state),
          `round ${round}: ${JSON.stringify(revoked)}`,
        );
        assert.deepEqual(await openGrants(db, ACCOUNT_1), [], `round ${round}: no grant is left`);
        assert.deepEqual(await groupAdminWithoutMembership(db), [], `round ${round}`);
      }
      report(
        `revoke against lifecycle in ${schema}: ${ITERATIONS} rounds in ${(performance.now() - started).toFixed(0)} ms`,
      );
    });

    it(`an appointment against the lifecycle step, ${ITERATIONS} times`, async () => {
      const started = performance.now();
      for (let round = 0; round < ITERATIONS; round += 1) {
        await prepare({ coordinator: false, archived: true, memberTwo: true });
        const version = await familyVersion();
        const outcomes = await Promise.all([
          settled(
            onSender(SUPER_ADMIN, "coordinator_appoint($1, $2, $3)", [
              nextKey("app"),
              MEMBERSHIP_2,
              1,
            ]),
          ),
          settled(lifecycle("other", version)),
        ]);
        noDeadlock(outcomes, `round ${round}`);
        const appointed = outcomes[0].value as { state: string; code: string | null };
        assert.ok(
          ["validation", "denied", "conflict"].includes(appointed.state),
          `round ${round}: ${JSON.stringify(appointed)}`,
        );
        assert.deepEqual(await openGrants(db, ACCOUNT_2), [], `round ${round}: no grant is left`);
        assert.deepEqual(await groupAdminWithoutMembership(db), [], `round ${round}`);
      }
      report(
        `appoint against lifecycle in ${schema}: ${ITERATIONS} rounds in ${(performance.now() - started).toFixed(0)} ms`,
      );
    });
  });
}
