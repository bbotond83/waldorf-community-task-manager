import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ASSIGNMENT_F1_T1,
  ASSIGNMENT_F2_T3,
  callFunction,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  GROUP_1,
  openDirectoryDatabase,
  ORGANIZATION,
  PARENT_F2,
  PARENT_ROW_F1,
  SUPER_ADMIN,
  TASK_1,
  TEACHER_G1,
} from "./directory-support.ts";
import { COMMUNITY_EVENT, FOOD_EVENT } from "./events-support.ts";
import { count } from "./identity-support.ts";
import {
  BOOK_HELD,
  BOOK_OWNED,
  CHECKLIST_EVENT,
  DUTY_ROTA,
  FAMILY_1_NAMES,
  OCC_DONE,
  PLACE_ANIMAL,
  PLACE_PAST,
  PLACE_ROTA,
  PLACE_WEEKEND,
  removeFamily,
  removeParent,
  seedRemovalWorld,
  stepOf,
  succeeded,
  TODO_DONE,
} from "./removal-support.ts";

/**
 * The duties step and how removed people show (U14; BR202.1, BR202.2, BR204.1; AC3.6.2, AC3.6.5; NFR1.1, NFR11.2).
 * The step takes no version and no role can call it, so its "refused", "out of reach", "outdated screen" and "repeated
 * click" cases are the command's, in removal-commands.test.ts; two at once is in removal-races.test.ts.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`removal: duties and former names in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedRemovalWorld(db, schema);
    });

    const places = async () =>
      new Map(
        (await db.query("select id, status, family_id, done_by from assignments")).rows.map(
          (row) => [String(row.id), row],
        ),
      );
    const reminderRecipients = async (task: string) =>
      (
        await db.query(
          `select r.family_id, r.status, j.status as job_status from reminder_recipients r
             join reminder_jobs j on j.id = r.reminder_job_id where j.task_id = $1 order by 1, 2, 3`,
          [task],
        )
      ).rows as { family_id: string; status: string; job_status: string }[];

    it("allowed: a removed family's future manual places are freed; rota, weekend and animal places and past places stay (BR202.1)", async () => {
      const result = succeeded(await removeFamily(db, schema));

      const after = await places();
      assert.equal(after.get(ASSIGNMENT_F1_T1)!.status, "removed");
      for (const kept of [PLACE_ROTA, PLACE_WEEKEND, PLACE_ANIMAL, PLACE_PAST]) {
        assert.deepEqual(
          [after.get(kept)!.status, after.get(kept)!.family_id],
          ["active", FAMILY_1],
          kept,
        );
      }
      assert.equal(after.get(ASSIGNMENT_F2_T3)!.status, "active");
      assert.deepEqual(stepOf(result, "duties"), { block: "duties", to_clear: 1, to_flag: 3 });
      assert.equal(result.removed_places, 1);
    });

    it("allowed: the freed manual duty's reminders are planned again without the family and no notice is sent (NFR11.2)", async () => {
      const before = await reminderRecipients(TASK_1);
      assert.ok(
        before.some((row) => row.family_id === FAMILY_1 && row.status === "active"),
        "the family was to be reminded",
      );
      succeeded(await removeFamily(db, schema));

      const after = await reminderRecipients(TASK_1);
      assert.deepEqual(
        after.filter((row) => row.family_id === FAMILY_1 && row.status === "active"),
        [],
      );
      assert.deepEqual(
        after.filter(
          (row) =>
            row.status === "active" && row.job_status === "queued" && row.family_id === FAMILY_1,
        ),
        [],
      );
      // Today's archive sends no "your place was removed" notice, and the removed family's notices are gone.
      assert.equal(await count(db, "notifications", "kind = 'place_removed'"), 0);
    });

    it("allowed: the kept places show on the flagged-duties list until an administrator reassigns them", async () => {
      succeeded(await removeFamily(db, schema));
      await db.query(`set search_path to "${schema}", pg_catalog`);
      const flagged = await db.query(
        "select duty_id, reason from rota_flagged_duties($1) where family_id = $2 and duty_id is not null",
        [ORGANIZATION, FAMILY_1],
      );
      assert.ok(
        flagged.rows.some((row) => row.duty_id === DUTY_ROTA && row.reason === "family_inactive"),
      );
      assert.equal(flagged.rowCount, 3);
    });

    it("allowed: removing one parent frees and flags no place, because places belong to families", async () => {
      const before = await places();
      const result = succeeded(await removeParent(db, schema));
      assert.deepEqual(stepOf(result, "duties"), { block: "duties", to_clear: 0, to_flag: 0 });
      assert.deepEqual(await places(), before);
    });

    for (const [name, remove] of [
      ["family", () => removeFamily(db, schema)],
      ["parent", () => removeParent(db, schema)],
    ] as const) {
      it(`allowed: a done mark keeps the removed parent's id after a ${name} removal (BR202.2)`, async () => {
        succeeded(await remove());
        assert.equal((await places()).get(PLACE_PAST)!.done_by, PARENT_ROW_F1);
      });
    }

    /** Every read other people use that names a parent or a family, with who asks. */
    const historyReads: [string, string, unknown[]][] = [
      [TEACHER_G1, "schedule_get($1)", ["all"]],
      [SUPER_ADMIN, "schedule_get($1)", ["all"]],
      [SUPER_ADMIN, "event_get($1)", [COMMUNITY_EVENT]],
      [PARENT_F2, "event_get($1)", [COMMUNITY_EVENT]],
      [SUPER_ADMIN, "event_get($1)", [FOOD_EVENT]],
      [SUPER_ADMIN, "checklist_get($1)", [CHECKLIST_EVENT]],
      [PARENT_F2, "checklist_get($1)", [CHECKLIST_EVENT]],
      [SUPER_ADMIN, "library_list()", []],
      [PARENT_F2, "library_list()", []],
      [SUPER_ADMIN, "library_get($1)", [BOOK_OWNED]],
      [PARENT_F2, "library_get($1)", [BOOK_HELD]],
      [SUPER_ADMIN, "todo_list_for_group($1)", [GROUP_1]],
      [SUPER_ADMIN, "todo_get($1)", [TODO_DONE]],
      [SUPER_ADMIN, "recurring_occurrence_get($1)", [OCC_DONE]],
      [SUPER_ADMIN, "recurring_list_admin()", []],
      [SUPER_ADMIN, "recurring_list($1)", [GROUP_1]],
      [PARENT_F2, "duty_list()", []],
      [PARENT_F2, "duty_get($1)", [TASK_1]],
      [SUPER_ADMIN, "rota_duty_card($1)", [DUTY_ROTA]],
      [SUPER_ADMIN, "rota_overview()", []],
      [SUPER_ADMIN, "rota_plan_get()", []],
      [SUPER_ADMIN, "school_calendar_get()", []],
      [SUPER_ADMIN, "swap_list()", []],
      [SUPER_ADMIN, "cancellation_list()", []],
      [SUPER_ADMIN, "weekend_unpicked_list()", []],
      [SUPER_ADMIN, "working_group_detail($1)", [GROUP_1]],
      [PARENT_F2, "working_group_detail($1)", [GROUP_1]],
    ];

    const readAll = async () => {
      const answers: { label: string; state: string; text: string }[] = [];
      for (const [account, sql, values] of historyReads) {
        const answer = await callFunction(db, schema, account, sql, values);
        answers.push({
          label: `${sql} ${values.join(" ")} ${account}`,
          state: String(answer.state ?? "success"),
          text: JSON.stringify(answer),
        });
      }
      return answers;
    };

    it("allowed: after a family removal no history read shows a stored name, and the family reads korábbi család (BR204.1, NFR1.1)", async () => {
      const before = await readAll();
      // A refused read would show no name for the wrong reason.
      assert.deepEqual(
        before.filter((read) => read.state !== "success").map((read) => [read.label, read.state]),
        [],
      );
      assert.ok(
        before.some((read) => FAMILY_1_NAMES.some((name) => read.text.includes(name))),
        "the names were visible before",
      );

      succeeded(await removeFamily(db, schema));

      const after = await readAll();
      for (const read of after) {
        for (const name of FAMILY_1_NAMES) {
          assert.equal(read.text.includes(name), false, `${read.label} shows ${name}`);
        }
      }
      const everything = after.map((read) => read.text).join("");
      assert.ok(everything.includes("korábbi család"));
      assert.ok(everything.includes("korábbi tag"));
      const schedule = after.find((read) => read.label.startsWith("schedule_get"))!;
      assert.ok(schedule.text.includes("korábbi család"), schedule.text);
      for (const detail of ["+36 30 777", "anna@example.test", "Fenyő Gergő"]) {
        assert.equal(everything.includes(detail), false, detail);
      }
    });

    it("allowed: after a parent removal that parent reads korábbi tag while the family and co-parent keep their names", async () => {
      succeeded(await removeParent(db, schema));
      const everything = (await readAll()).map((read) => read.text).join("");
      assert.equal(everything.includes("Fenyő Anna"), false);
      assert.equal(everything.includes("Anonimizált szülő"), false);
      assert.ok(everything.includes("korábbi tag"));
      assert.ok(everything.includes("Fenyő család"));
    });

    it("allowed: the two name helpers answer for active, removed and anonymised people (C6)", async () => {
      await db.query(`set search_path to "${schema}", pg_catalog`);
      const names = async () =>
        (
          await db.query("select parent_display_name($1) as p, family_display_name($2) as f", [
            PARENT_ROW_F1,
            FAMILY_1,
          ])
        ).rows[0];
      assert.deepEqual(await names(), { p: "Fenyő Anna", f: "Fenyő család" });
      await db.query("update parents set status = 'archived' where id = $1", [PARENT_ROW_F1]);
      assert.deepEqual(await names(), { p: "korábbi tag", f: "Fenyő család" });
      await db.query("update parents set status = 'active' where id = $1", [PARENT_ROW_F1]);
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_1,
      ]);
      assert.deepEqual(await names(), { p: "korábbi tag", f: "korábbi család" });
    });
  });
}
