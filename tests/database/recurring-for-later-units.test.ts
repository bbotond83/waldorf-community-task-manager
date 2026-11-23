import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ADMIN_G2,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  GROUP_1,
  GROUP_2,
  openDirectoryDatabase,
  ORGANIZATION,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  SIGNED_OUT,
  SUPER_ADMIN,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import { asActor, asServiceRole, failureOf } from "./identity-support.ts";
import {
  auditFor,
  dayOffset,
  insertOccurrence,
  insertSchedule,
  mondayAfter,
  OCC,
  occurrenceRow,
  publishWeeks,
  recurringCalls,
  SCHEDULE_F1,
  SCHEDULE_G1,
  SCHEDULE_G2,
  SCHEDULE_WATER,
  seedRecurringWorld,
} from "./recurring-support.ts";

/**
 * What U9 gives later units (C1, C9, C12, C14, C16; BR150, BR151; NFR3.6, NFR3.7, NFR11.1, NFR11.2): the reads other
 * units call, the removal pair that U14 calls, the registered daily check, and the promise that no existing unit writes a
 * row of this one.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`recurring duties for later units in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    const calls = recurringCalls(() => db, schema);
    const denied = (result: { state: string; code: string | null }) =>
      assert.deepEqual([result.state, result.code], ["denied", "authorization_denied"]);
    const ROTA_DUTY = uuid(99030);
    let monday = "";
    let week = "";

    beforeEach(async () => {
      await seedRecurringWorld(db, schema);
      monday = await mondayAfter(db, 0);
      week = (await publishWeeks(db, [{ monday, family: FAMILY_1 }]))[0]!;
      await db.query(
        `insert into tasks (id, organization_id, title, category, capacity, starts_at, ends_at, origin_kind, origin_id)
         values ($1, $2, 'Vízhordás', 'rota', 1, now(), now() + interval '1 hour', 'rota_week', $3)`,
        [ROTA_DUTY, ORGANIZATION, week],
      );
      const today = await dayOffset(db, 0);
      await insertSchedule(db, { id: SCHEDULE_G1, group: GROUP_1, title: "Első csoport munka" });
      await insertSchedule(db, { id: SCHEDULE_G2, group: GROUP_2, title: "Második csoport munka" });
      await insertSchedule(db, {
        id: SCHEDULE_F1,
        kind: "family",
        family: FAMILY_1,
        title: "Első családi munka",
      });
      await insertSchedule(db, {
        id: SCHEDULE_WATER,
        kind: "rota_week",
        job: "water_carrying",
        interval: 4,
        title: "Palackok",
      });
      await insertOccurrence(db, { id: OCC(1), schedule: SCHEDULE_G1, due: today });
      await insertOccurrence(db, { id: OCC(2), schedule: SCHEDULE_G2, due: today });
      await insertOccurrence(db, { id: OCC(3), schedule: SCHEDULE_F1, due: today });
      await insertOccurrence(db, { id: OCC(4), schedule: SCHEDULE_WATER, due: monday });
    });

    const onlyAs = (role: "service_role" | "anon", sql: string, values: unknown[] = []) =>
      failureOf(() =>
        asActor(db, schema, role === "anon" ? { role: "anon" } : asServiceRole, () =>
          db.query(`select ${sql}`, values),
        ),
      );

    describe("the reads", () => {
      it("are granted to signed-in accounts only: the service role and an anonymous caller are refused at the grant (NFR3.6)", async () => {
        const reads: [string, unknown[]][] = [
          ["recurring_list($1)", [GROUP_1]],
          ["recurring_my_occurrences()", []],
          ["recurring_bottle_for_duty($1)", [ROTA_DUTY]],
          ["recurring_list_for_group($1)", [GROUP_1]],
          ["recurring_occurrence_get($1)", [OCC(1)]],
          ["recurring_schedule_get($1)", [SCHEDULE_G1]],
          ["recurring_list_admin()", []],
        ];
        for (const [sql, values] of reads) {
          assert.equal((await onlyAs("service_role", sql, values))?.code, "42501", sql);
          assert.equal((await onlyAs("anon", sql, values))?.code, "42501", sql);
        }
      });

      it("recurring_list names a group's schedules to its coordinator and a super admin and to nobody else (C14, BR150.2)", async () => {
        for (const account of [ADMIN_G1, SUPER_ADMIN]) {
          const result = await calls.fn(account, "recurring_list($1)", [GROUP_1]);
          assert.equal(result.state, "success", account);
          const items = (
            result as unknown as { items: { id: string; title: string; status: string }[] }
          ).items;
          assert.deepEqual(
            items.map((i) => [i.id, i.title, i.status]),
            [[SCHEDULE_G1, "Első csoport munka", "active"]],
          );
        }
        for (const account of [PARENT_F1, PARENT_F2, ADMIN_G2, TEACHER_G1])
          denied(await calls.fn(account, "recurring_list($1)", [GROUP_1]));
        denied(await calls.fn(ADMIN_G1, "recurring_list($1)", [uuid(99999)]));
        const signedOut = await calls.fn(SIGNED_OUT, "recurring_list($1)", [GROUP_1]);
        assert.equal(signedOut.state, "denied");
      });

      it("recurring_my_occurrences gives a parent the duties of the family, of the water week the family holds and of the groups, and no one else's (BR150.1)", async () => {
        const mine = await calls.fn(PARENT_F1, "recurring_my_occurrences()");
        assert.equal(mine.state, "success", JSON.stringify(mine));
        const ids = JSON.stringify(mine);
        for (const id of [OCC(1), OCC(3), OCC(4)]) assert.ok(ids.includes(id), id);
        assert.ok(!ids.includes(OCC(2)), "not the second group's");
        const other = JSON.stringify(await calls.fn(PARENT_F2, "recurring_my_occurrences()"));
        assert.ok(other.includes(OCC(2)));
        for (const id of [OCC(1), OCC(3), OCC(4)]) assert.ok(!other.includes(id), id);
        // A caller with no parent record has no duties of their own.
        denied(await calls.fn(SUPER_ADMIN, "recurring_my_occurrences()"));
        denied(await calls.fn(TEACHER_G1, "recurring_my_occurrences()"));
      });

      it("recurring_bottle_for_duty shows the holder of the week its cleaning, a super admin too, and refuses everyone else the same way (C12)", async () => {
        const holder = await calls.fn(PARENT_F1, "recurring_bottle_for_duty($1)", [ROTA_DUTY]);
        assert.equal(holder.state, "success", JSON.stringify(holder));
        const items = (holder as unknown as { items: { id: string; can_mark_done: boolean }[] })
          .items;
        assert.deepEqual(
          items.map((i) => [i.id, i.can_mark_done]),
          [[OCC(4), true]],
        );
        const admin = (await calls.fn(SUPER_ADMIN, "recurring_bottle_for_duty($1)", [
          ROTA_DUTY,
        ])) as unknown as {
          items: { can_mark_done: boolean; can_skip: boolean }[];
        };
        assert.deepEqual([admin.items[0]!.can_mark_done, admin.items[0]!.can_skip], [false, true]);
        const real = await calls.fn(PARENT_F2, "recurring_bottle_for_duty($1)", [ROTA_DUTY]);
        const madeUp = await calls.fn(PARENT_F2, "recurring_bottle_for_duty($1)", [uuid(99999)]);
        denied(real);
        assert.deepEqual(real, madeUp);
        denied(await calls.fn(TEACHER_G1, "recurring_bottle_for_duty($1)", [ROTA_DUTY]));
      });

      it("the bottle read follows the week when it is moved (a swap, a cancellation or a reassignment)", async () => {
        await db.query("update rota_weeks set family_id = $1 where id = $2", [FAMILY_2, week]);
        denied(await calls.fn(PARENT_F1, "recurring_bottle_for_duty($1)", [ROTA_DUTY]));
        const now = await calls.fn(PARENT_F2, "recurring_bottle_for_duty($1)", [ROTA_DUTY]);
        assert.equal(now.state, "success");
        assert.equal((now as unknown as { items: unknown[] }).items.length, 1);
      });
    });

    describe("the removal pair (C16, BR151)", () => {
      const run = (kind: string, id: string, apply: boolean) =>
        asActor(
          db,
          schema,
          asServiceRole,
          async () =>
            (
              await db.query(
                `select recurring_duties_removal_${apply ? "apply" : "preview"}($1, $2) as r`,
                [kind, id],
              )
            ).rows[0].r as { to_clear: number; to_flag: number },
        );
      const snapshot = async () =>
        JSON.stringify(
          (
            await db.query(
              `select id, status, done_by_parent_id, done_by_removed, skipped_by_parent_id, skipped_by_removed, version
                 from recurring_occurrences order by id`,
            )
          ).rows,
        );

      it("are callable by the service role and not by a signed-in account or an anonymous caller (NFR3.7)", async () => {
        for (const apply of ["preview", "apply"]) {
          for (const role of ["anon"] as const) {
            assert.equal(
              (
                await onlyAs(role, `recurring_duties_removal_${apply}('parent', $1)`, [
                  PARENT_ROW_F1,
                ])
              )?.code,
              "42501",
            );
          }
          const failure = await failureOf(() =>
            asActor(db, schema, { role: "authenticated", account: SUPER_ADMIN }, () =>
              db.query(`select recurring_duties_removal_${apply}('parent', $1)`, [PARENT_ROW_F1]),
            ),
          );
          assert.equal(failure?.code, "42501", apply);
        }
      });

      it("for a parent: clears the person and sets the flag in one update, keeps the rows, and the preview agrees (NFR11.1)", async () => {
        await db.query("delete from recurring_occurrences");
        await insertOccurrence(db, {
          id: OCC(11),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, -1),
          status: "done",
          doneBy: PARENT_ROW_F1,
        });
        await insertOccurrence(db, {
          id: OCC(12),
          schedule: SCHEDULE_F1,
          due: await dayOffset(db, -2),
          status: "done",
          doneBy: PARENT_ROW_F1,
        });
        await insertOccurrence(db, {
          id: OCC(13),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, -3),
          status: "skipped",
          skippedBy: PARENT_ROW_F1,
        });
        await insertOccurrence(db, {
          id: OCC(14),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, -4),
          status: "done",
          doneBy: PARENT_ROW_F2,
        });
        await insertOccurrence(db, {
          id: OCC(15),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, 5),
        });
        const before = await snapshot();
        const preview = await run("parent", PARENT_ROW_F1, false);
        assert.deepEqual(preview, { to_clear: 3, to_flag: 0 });
        assert.equal(await snapshot(), before, "the preview writes nothing");
        const applied = await run("parent", PARENT_ROW_F1, true);
        assert.deepEqual(applied, preview);
        for (const id of [OCC(11), OCC(12)]) {
          const row = (await occurrenceRow(db, id))!;
          assert.deepEqual(
            [row.status, row.done_by_parent_id, row.done_by_removed],
            ["done", null, true],
            id,
          );
        }
        const skipped = (await occurrenceRow(db, OCC(13)))!;
        assert.deepEqual(
          [skipped.status, skipped.skipped_by_parent_id, skipped.skipped_by_removed],
          ["skipped", null, true],
        );
        assert.equal(
          (await occurrenceRow(db, OCC(14)))!.done_by_parent_id,
          PARENT_ROW_F2,
          "another parent's mark is untouched",
        );
        assert.equal(
          await db
            .query("select count(*)::int as n from recurring_occurrences")
            .then((r) => r.rows[0].n),
          5,
          "no row is deleted",
        );
        assert.deepEqual(await run("parent", PARENT_ROW_F1, false), { to_clear: 0, to_flag: 0 });
        const audit = await auditFor(db, "recurring_removal_applied");
        assert.deepEqual(
          audit.map((a) => a.details),
          ["cleared:3:flagged:0"],
        );
        // The screens show a former member, with no name and no id.
        const card = await calls.fn(SUPER_ADMIN, "recurring_occurrence_get($1)", [OCC(11)]);
        assert.equal(
          (card as unknown as { item: { done_by_display_name: string } }).item.done_by_display_name,
          "korábbi tag",
        );
      });

      it("for a family: counts its schedules and writes nothing but the audit entry; a second apply counts the same", async () => {
        const before = await snapshot();
        const preview = await run("family", FAMILY_1, false);
        assert.deepEqual(preview, { to_clear: 0, to_flag: 1 });
        const applied = await run("family", FAMILY_1, true);
        assert.deepEqual(applied, preview);
        assert.deepEqual(await run("family", FAMILY_1, true), preview);
        assert.equal(await snapshot(), before);
        assert.equal((await auditFor(db, "recurring_removal_applied")).length, 2);
      });

      it("for a subject that holds nothing, an unknown id or another kind: zero counts and no change", async () => {
        const before = await snapshot();
        for (const [kind, id] of [
          ["parent", PARENT_ROW_F2],
          ["family", FAMILY_2],
          ["parent", uuid(99999)],
          ["family", uuid(99999)],
          ["group", GROUP_1],
          ["child", PARENT_ROW_F1],
        ] as const) {
          assert.deepEqual(
            await run(kind, id, false),
            { to_clear: 0, to_flag: 0 },
            `${kind} preview`,
          );
          assert.deepEqual(await run(kind, id, true), { to_clear: 0, to_flag: 0 }, `${kind} apply`);
        }
        assert.equal(await snapshot(), before);
      });
    });

    describe("the daily run", () => {
      it("holds the check in U5's registry at the highest lock step, runs it with the others and records it (C9)", async () => {
        const run = await asActor(
          db,
          schema,
          asServiceRole,
          async () =>
            (
              await db.query("select timed_checks_run_system('daily', $1::timestamptz) as r", [
                `${await dayOffset(db, 0)}T07:00:00Z`,
              ])
            ).rows[0].r as { checks: { check: string; outcome: string }[] },
        );
        const names = run.checks.map((c) => c.check);
        assert.ok(names.includes("recurring_duties"), JSON.stringify(names));
        assert.ok(names.length > 1, "the other checks ran too");
        const step = await db.query(
          "select lock_step, (select max(lock_step) from timed_check_registry) as highest from timed_check_registry where check_name = 'recurring_duties'",
        );
        assert.deepEqual([step.rows[0].lock_step, step.rows[0].highest], [4, 4]);
        assert.ok(
          run.checks.every((c) => c.outcome === "success"),
          JSON.stringify(run.checks),
        );
        const recorded = await db.query(
          "select outcome, detail from timed_check_runs where check_name = 'recurring_duties' order by started_at desc limit 1",
        );
        assert.equal(recorded.rows[0].outcome, "success");
      });
    });

    describe("what no other unit may do (NFR11.2)", () => {
      it("no function outside this unit names a table of this unit, so a swap, a cancellation or a reassignment writes none of its rows", async () => {
        const rows = await db.query(
          `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = $1 and p.proname not like 'recurring%' and p.proname <> 'timed_checks_run_system'
              and (p.prosrc ilike '%recurring_occurrences%' or p.prosrc ilike '%recurring_schedules%')
            order by 1`,
          [schema],
        );
        assert.deepEqual(rows.rows, []);
      });
    });
  });
}
