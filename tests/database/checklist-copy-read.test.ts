import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  openDirectoryDatabase,
  OTHER_ADMIN,
  OUTSIDER,
  SIGNED_OUT,
  TEACHER_G1,
} from "./directory-support.ts";
import {
  caller,
  checklistOf,
  COMMUNITY_EVENT,
  copyInto,
  GROUP_EVENT,
  makeOrganiser,
  nextKey,
  newTemplate,
  rowsOf,
  SAMPLE,
  saveTemplate,
  sectionBody,
  seedEventWorld,
  setRemoved,
  setSummer,
  taskBody,
  templateBody,
} from "./checklist-support.ts";
import { CANCELLED_EVENT, PAST_EVENT } from "./events-support.ts";
import { openDatabase } from "./stack-support.ts";
import {
  ADMIN_G1,
  ADMIN_G2,
  GROUP_1,
  GROUP_2,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F2,
  SUPER_ADMIN,
} from "./working-groups-support.ts";

/**
 * Copying a template into an event and reading the event's checklist (W4, W7; BR163.1 to BR163.3, BR167.1 to BR167.3)
 * on the fixed list. The read has no outdated screen, no repeated click and no two people at once.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`checklist copy and read in ${schema}`, () => {
    let db: pg.Client;
    let second: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      second = await openDatabase();
    });
    after(async () => {
      await second.end();
      await db.end();
    });
    beforeEach(async () => {
      await seedEventWorld(db, schema);
      await db.query("delete from checklist_templates");
    });

    const call = caller(() => db, schema);
    const callSecond = caller(() => second, schema);
    const outcome = (result: { state: string; code: string | null }) => [result.state, result.code];
    const titles = (view: Awaited<ReturnType<typeof checklistOf>>) =>
      view.item.sections.map((section) => [section.title, section.tasks.map((task) => task.title)]);

    describe("W4 checklist_copy_template", () => {
      it("allowed: the copy keeps order, fields and section kinds, leaves out summer-only tasks in a winter event, and adds no claim, done mark or deadline", async () => {
        const template = await newTemplate(call, SUPER_ADMIN, SAMPLE);
        const copied = await copyInto(call, SUPER_ADMIN, COMMUNITY_EVENT, template);
        assert.equal(copied.state, "success");
        const view = await checklistOf(call, SUPER_ADMIN, COMMUNITY_EVENT);
        assert.deepEqual(titles(view), [
          ["Szülők", ["Székek bevitele", "Süti sütése"]],
          ["Szervezők", ["Értesítő küldése"]],
          ["Óvónők", ["Dal kiválasztása"]],
        ]);
        assert.deepEqual(
          view.item.sections.map((section) => section.kind),
          ["parents", "organisers", "teachers"],
        );
        assert.equal(view.item.copied_from_template_id, template);
        const bake = view.item.sections[0]!.tasks[1]!;
        assert.deepEqual(
          [bake.tip, bake.time_matters, bake.helpers_needed],
          ["Hozz tálcát", true, 1],
        );
        assert.equal(view.item.sections[0]!.tasks[0]!.helpers_needed, 2);
        assert.equal((await rowsOf(db, "checklist_claims")).length, 0);
        assert.equal(
          (await rowsOf(db, "event_checklist_tasks", "done_at is not null or deadline is not null"))
            .length,
          0,
        );
      });
      it("allowed: a summer event gets the summer-only tasks; a section left with no task is not copied", async () => {
        await setSummer(db, COMMUNITY_EVENT, true);
        const template = await newTemplate(call, SUPER_ADMIN, SAMPLE);
        await copyInto(call, SUPER_ADMIN, COMMUNITY_EVENT, template);
        assert.deepEqual(titles(await checklistOf(call, SUPER_ADMIN, COMMUNITY_EVENT))[0], [
          "Szülők",
          ["Székek bevitele", "Süti sütése", "Nyári virágok"],
        ]);
        const summerOnly = await newTemplate(
          call,
          SUPER_ADMIN,
          templateBody("Csak nyári", [
            sectionBody("Nyár", [taskBody("Medence", { summer_only: true })]),
            sectionBody("Mindig", [taskBody("Takarítás")]),
          ]),
        );
        await setSummer(db, GROUP_EVENT, false);
        await copyInto(call, SUPER_ADMIN, GROUP_EVENT, summerOnly);
        assert.deepEqual(titles(await checklistOf(call, SUPER_ADMIN, GROUP_EVENT)), [
          ["Mindig", ["Takarítás"]],
        ]);
      });
      it("allowed: a coordinator copies a community template and their own group's template into their group's event", async () => {
        const community = await newTemplate(call, SUPER_ADMIN, SAMPLE);
        const own = await newTemplate(call, ADMIN_G1, {
          ...templateBody("Csoport", [sectionBody("Csoportos", [taskBody("Egy")])]),
          working_group_id: GROUP_1,
        });
        assert.equal((await copyInto(call, ADMIN_G1, GROUP_EVENT, own)).state, "success");
        await db.query("delete from event_checklists");
        assert.equal((await copyInto(call, ADMIN_G1, GROUP_EVENT, community)).state, "success");
      });
      it("refused: a parent, a teacher and an organiser who is not a manager are denied; nothing is written", async () => {
        await makeOrganiser(db, COMMUNITY_EVENT, PARENT_ROW_F2);
        const template = await newTemplate(call, SUPER_ADMIN, SAMPLE);
        for (const account of [PARENT_F1, PARENT_F2, TEACHER_G1, SIGNED_OUT, DEACTIVATED]) {
          assert.equal(
            (await copyInto(call, account, COMMUNITY_EVENT, template)).state,
            "denied",
            account,
          );
        }
        assert.equal((await rowsOf(db, "event_checklists")).length, 0);
        assert.equal((await rowsOf(db, "event_checklist_sections")).length, 0);
      });
      it("refused: a removed or unknown template, a second copy, and a finished or cancelled event", async () => {
        const template = await newTemplate(call, SUPER_ADMIN, SAMPLE);
        const gone = await newTemplate(
          call,
          SUPER_ADMIN,
          templateBody("Eltávolított", [sectionBody("S", [taskBody("T")])]),
        );
        await setRemoved(call, SUPER_ADMIN, gone, true, 1);
        assert.deepEqual(outcome(await copyInto(call, SUPER_ADMIN, COMMUNITY_EVENT, gone)), [
          "denied",
          "TEMPLATE_UNAVAILABLE",
        ]);
        assert.deepEqual(
          outcome(
            await copyInto(
              call,
              SUPER_ADMIN,
              COMMUNITY_EVENT,
              "00000000-0000-4000-8000-0000000000aa",
            ),
          ),
          ["denied", "TEMPLATE_UNAVAILABLE"],
        );
        assert.equal(
          (await copyInto(call, SUPER_ADMIN, COMMUNITY_EVENT, template)).state,
          "success",
        );
        assert.deepEqual(outcome(await copyInto(call, SUPER_ADMIN, COMMUNITY_EVENT, template)), [
          "conflict",
          "CHECKLIST_NOT_EMPTY",
        ]);
        for (const event of [PAST_EVENT, CANCELLED_EVENT]) {
          assert.deepEqual(
            outcome(await copyInto(call, SUPER_ADMIN, event, template)),
            ["conflict", "EVENT_CLOSED"],
            event,
          );
        }
        assert.equal(
          (await rowsOf(db, "event_checklist_sections")).length,
          3,
          "only the first copy was made",
        );
      });
      it("out of reach: another group's coordinator is denied on a group event; a group's template is unavailable to another group's coordinator; another community's admin finds no event", async () => {
        const template = await newTemplate(call, SUPER_ADMIN, SAMPLE);
        assert.deepEqual(outcome(await copyInto(call, ADMIN_G2, GROUP_EVENT, template)), [
          "denied",
          "authorization_denied",
        ]);
        assert.deepEqual(outcome(await copyInto(call, ADMIN_G1, COMMUNITY_EVENT, template)), [
          "denied",
          "authorization_denied",
        ]);
        assert.equal(
          (await copyInto(call, OTHER_ADMIN, COMMUNITY_EVENT, template)).state,
          "validation",
        );
        const other = await db.query(
          `insert into checklist_templates (organization_id, working_group_id, name)
           values ((select organization_id from events where id = $1), $2, 'Másik csoport') returning id`,
          [COMMUNITY_EVENT, GROUP_2],
        );
        assert.deepEqual(
          outcome(await copyInto(call, ADMIN_G1, GROUP_EVENT, other.rows[0].id as string)),
          ["denied", "TEMPLATE_UNAVAILABLE"],
        );
        assert.equal((await rowsOf(db, "event_checklist_sections")).length, 0);
      });
      it("outdated screen: an event whose checklist was filled in meanwhile is not copied over (CHECKLIST_NOT_EMPTY)", async () => {
        const template = await newTemplate(call, SUPER_ADMIN, SAMPLE);
        await copyInto(call, SUPER_ADMIN, COMMUNITY_EVENT, template);
        assert.equal(
          (await copyInto(call, SUPER_ADMIN, COMMUNITY_EVENT, template, nextKey("late"))).code,
          "CHECKLIST_NOT_EMPTY",
        );
      });
      it("repeated click: the same key returns the stored result and copies once", async () => {
        const template = await newTemplate(call, SUPER_ADMIN, SAMPLE);
        const key = nextKey("once");
        const first = await copyInto(call, SUPER_ADMIN, COMMUNITY_EVENT, template, key);
        const again = await copyInto(call, SUPER_ADMIN, COMMUNITY_EVENT, template, key);
        assert.deepEqual(
          [again.state, again.code, again.reference],
          ["success", "replayed", first.reference],
        );
        assert.equal((await rowsOf(db, "event_checklist_sections")).length, 3);
      });
      it("two people at once: two managers copying into one event give one copy and one CHECKLIST_NOT_EMPTY", async () => {
        const template = await newTemplate(call, SUPER_ADMIN, SAMPLE);
        const answers = await Promise.all([
          copyInto(call, SUPER_ADMIN, COMMUNITY_EVENT, template),
          copyInto(callSecond, SUPER_ADMIN, COMMUNITY_EVENT, template),
        ]);
        assert.deepEqual(answers.map((answer) => answer.state).sort(), ["conflict", "success"]);
        assert.equal((await rowsOf(db, "event_checklists")).length, 1);
        assert.equal((await rowsOf(db, "event_checklist_sections")).length, 3);
      });
      it("allowed (BR163.3): changing, removing or restoring the template and switching the event to summer later change nothing in the copy", async () => {
        const template = await newTemplate(call, SUPER_ADMIN, SAMPLE);
        await copyInto(call, SUPER_ADMIN, COMMUNITY_EVENT, template);
        const before = JSON.stringify(await rowsOf(db, "event_checklist_tasks"));
        await saveTemplate(call, SUPER_ADMIN, {
          ...templateBody("Más", [sectionBody("X", [taskBody("Y")])]),
          id: template,
          expected_version: 1,
        });
        await setRemoved(call, SUPER_ADMIN, template, true, 2);
        await setRemoved(call, SUPER_ADMIN, template, false, 3);
        await setSummer(db, COMMUNITY_EVENT, true);
        assert.equal(JSON.stringify(await rowsOf(db, "event_checklist_tasks")), before);
        assert.equal(
          (await rowsOf(db, "event_checklists"))[0]!.copied_from_template_id,
          template,
          "kept for information",
        );
      });
    });

    describe("W7 checklist_get", () => {
      beforeEach(async () => {
        await setSummer(db, COMMUNITY_EVENT, true);
        const template = await newTemplate(call, SUPER_ADMIN, SAMPLE);
        await copyInto(call, SUPER_ADMIN, COMMUNITY_EVENT, template);
        await makeOrganiser(db, COMMUNITY_EVENT, PARENT_ROW_F2);
      });

      it("allowed: parents and teachers read the parents' and teachers' sections and never the organisers' section or its tasks", async () => {
        for (const account of [PARENT_F1, TEACHER_G1]) {
          const view = await checklistOf(call, account, COMMUNITY_EVENT);
          assert.deepEqual(
            view.item.sections.map((section) => section.kind),
            ["parents", "teachers"],
            account,
          );
          assert.equal(view.item.caller.in_team, false);
          assert.equal(
            view.item.all_done,
            null,
            "the closing-round flag is for the organising team only",
          );
        }
        assert.doesNotMatch(
          JSON.stringify(await checklistOf(call, PARENT_F1, COMMUNITY_EVENT)),
          /Értesítő küldése/,
        );
      });
      it("allowed: the organising team (a manager, and a parent marked as organiser) reads every section and the closing-round flag", async () => {
        for (const account of [SUPER_ADMIN, PARENT_F2]) {
          const view = await checklistOf(call, account, COMMUNITY_EVENT);
          assert.equal(view.item.sections.length, 3, account);
          assert.equal(view.item.caller.in_team, true);
          assert.equal(view.item.all_done, false);
        }
        assert.equal(
          (await checklistOf(call, PARENT_F2, COMMUNITY_EVENT)).item.caller.can_manage,
          false,
        );
        assert.equal(
          (await checklistOf(call, SUPER_ADMIN, COMMUNITY_EVENT)).item.caller.can_manage,
          true,
        );
      });
      it("allowed: the sign-up deadline is returned and blocks nothing; a teacher cannot do anything on a task", async () => {
        await db.query(
          "update events set signup_deadline = (now() at time zone 'Europe/Budapest')::date - 1 where id = $1",
          [COMMUNITY_EVENT],
        );
        const view = await checklistOf(call, PARENT_F1, COMMUNITY_EVENT);
        assert.notEqual(view.item.signup_deadline, null);
        assert.equal(
          view.item.sections[0]!.tasks[0]!.can.claim,
          true,
          "a past deadline blocks nothing",
        );
        const teacher = await checklistOf(call, TEACHER_G1, COMMUNITY_EVENT);
        assert.ok(
          teacher.item.sections.every((section) =>
            section.tasks.every((task) => !task.can.claim && !task.can.mark_done),
          ),
        );
      });
      it("allowed: an event with no checklist reads as empty with version 0, and a finished event reads as not open", async () => {
        const empty = await checklistOf(call, PARENT_F1, GROUP_EVENT);
        assert.deepEqual(
          [empty.item.is_empty, empty.item.checklist_version, empty.item.sections.length],
          [true, 0, 0],
        );
        const past = await checklistOf(call, PARENT_F1, PAST_EVENT);
        assert.deepEqual([past.item.is_open, past.item.is_finished], [false, true]);
      });
      it("refused and out of reach: a caller with no access, and another community's reader, get the denied refusal, never an empty list", async () => {
        for (const account of [SIGNED_OUT, DEACTIVATED, OUTSIDER]) {
          assert.equal(
            (await call(account, "checklist_get($1)", [COMMUNITY_EVENT])).state,
            "denied",
            account,
          );
        }
        assert.deepEqual(outcome(await call(OTHER_ADMIN, "checklist_get($1)", [COMMUNITY_EVENT])), [
          "denied",
          "EVENT_UNAVAILABLE",
        ]);
        assert.deepEqual(
          outcome(
            await call(PARENT_F1, "checklist_get($1)", ["00000000-0000-4000-8000-0000000000aa"]),
          ),
          ["denied", "EVENT_UNAVAILABLE"],
        );
      });
      it("nem értelmezhető: a read has no outdated screen, no repeated click and no two people at once", () => {
        assert.ok(true);
      });
    });
  });
}
