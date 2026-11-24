import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  openDirectoryDatabase,
  OTHER_ADMIN,
  TEACHER_G1,
} from "./directory-support.ts";
import {
  caller,
  checklistOf,
  claimDirect,
  COMMUNITY_EVENT,
  GROUP_EVENT,
  idsOf,
  json,
  makeOrganiser,
  nextKey,
  rowsOf,
  seedEventWorld,
  seedSampleChecklist,
} from "./checklist-support.ts";
import { CANCELLED_EVENT, eventVersion, PAST_EVENT } from "./events-support.ts";
import { openDatabase } from "./stack-support.ts";
import {
  ADMIN_G1,
  ADMIN_G2,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  SUPER_ADMIN,
} from "./working-groups-support.ts";

/**
 * The managers' edits of an event's own checklist (W5; BR164.1 to BR164.3) on the fixed list: allowed, refused, out of
 * reach, outdated screen, repeated click and two people at once. No command here reads or changes the event's version.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`checklist edits in ${schema}`, () => {
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
      await seedSampleChecklist(
        caller(() => db, schema),
        SUPER_ADMIN,
        COMMUNITY_EVENT,
        true,
        db,
      );
    });

    const call = caller(() => db, schema);
    const callSecond = caller(() => second, schema);
    const outcome = (result: { state: string; code: string | null }) => [result.state, result.code];
    const version = async (event = COMMUNITY_EVENT) =>
      (await checklistOf(call, SUPER_ADMIN, event)).item.checklist_version;
    const addSection = async (
      account: string,
      title: string,
      kind = "parents",
      at?: number,
      event = COMMUNITY_EVENT,
      key = nextKey("sec"),
    ) =>
      call(account, "checklist_section_save($1, $2, $3, $4::jsonb)", [
        key,
        event,
        at ?? (await version(event)),
        json({ title, kind }),
      ]);
    const addTask = async (
      account: string,
      section: string,
      extra: Record<string, unknown> = {},
      at?: number,
      event = COMMUNITY_EVENT,
      key = nextKey("tsk"),
    ) =>
      call(account, "checklist_task_save($1, $2, $3, $4::jsonb)", [
        key,
        event,
        at ?? (await version(event)),
        json({ section_id: section, title: "Új feladat", ...extra }),
      ]);
    const saveTask = (
      account: string,
      id: string,
      expected: number,
      body: Record<string, unknown>,
      atVersion: number | null = null,
    ) =>
      call(account, "checklist_task_save($1, $2, $3, $4::jsonb)", [
        nextKey("chg"),
        COMMUNITY_EVENT,
        atVersion,
        json({ id, expected_version: expected, ...body }),
      ]);
    const removeTask = async (account: string, id: string, at?: number) =>
      call(account, "checklist_task_remove($1, $2, $3)", [
        nextKey("rt"),
        id,
        at ?? (await version()),
      ]);
    const removeSection = async (account: string, id: string, at?: number) =>
      call(account, "checklist_section_remove($1, $2, $3)", [
        nextKey("rs"),
        id,
        at ?? (await version()),
      ]);
    const reorder = async (account: string, order: unknown, at?: number) =>
      call(account, "checklist_reorder($1, $2, $3, $4::jsonb)", [
        nextKey("ro"),
        COMMUNITY_EVENT,
        at ?? (await version()),
        json(order),
      ]);
    const versionOf = (table: string, id: string) =>
      db
        .query(`select version from ${table} where id = $1`, [id])
        .then((result) => result.rows[0].version as number);

    describe("allowed", () => {
      it("a manager adds a section and a task, changes both, and the event's own version never moves", async () => {
        const eventBefore = await eventVersion(db, COMMUNITY_EVENT);
        const start = await version();
        const section = await addSection(SUPER_ADMIN, "Konyha");
        assert.equal(section.state, "success");
        assert.equal(
          await version(),
          start + 1,
          "adding a section sends and raises the checklist's version",
        );
        const task = await addTask(SUPER_ADMIN, section.reference!, {
          place: "Konyha",
          priority: 2,
          deadline: new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10),
          summer_only: true,
          helpers_needed: 3,
        });
        assert.equal(task.state, "success");
        const renamed = await call(SUPER_ADMIN, "checklist_section_save($1, $2, null, $3::jsonb)", [
          nextKey("sec"),
          COMMUNITY_EVENT,
          json({
            id: section.reference,
            expected_version: 1,
            title: "Konyha és kamra",
            kind: "organisers",
          }),
        ]);
        assert.deepEqual([renamed.state, renamed.version], ["success", 2]);
        const changed = await saveTask(SUPER_ADMIN, task.reference!, 1, {
          section_id: section.reference,
          title: "Átírt",
          helpers_needed: 2,
        });
        assert.deepEqual([changed.state, changed.version], ["success", 2]);
        assert.equal(await eventVersion(db, COMMUNITY_EVENT), eventBefore);
      });
      it("a manager of a group event is its coordinator; deleting an unclaimed task and an empty section renumbers the rest", async () => {
        const ids = await idsOf(db, COMMUNITY_EVENT);
        const gone = await removeTask(SUPER_ADMIN, ids.task("Székek bevitele"));
        assert.equal(gone.state, "success");
        const after = await idsOf(db, COMMUNITY_EVENT);
        assert.deepEqual(
          after.tasks
            .filter((row) => row.section_id === ids.section("Szülők"))
            .map((row) => [row.title, row.position]),
          [
            ["Süti sütése", 1],
            ["Nyári virágok", 2],
          ],
        );
        const removed = await removeSection(SUPER_ADMIN, ids.section("Szervezők"));
        assert.equal(removed.state, "success");
        assert.deepEqual(
          (await idsOf(db, COMMUNITY_EVENT)).sections.map((row) => [row.title, row.position]),
          [
            ["Szülők", 1],
            ["Óvónők", 2],
          ],
        );
      });
      it("a task moves to another section of the same kind and keeps its claims and done mark", async () => {
        const extra = await addSection(SUPER_ADMIN, "Másik szülői");
        const ids = await idsOf(db, COMMUNITY_EVENT);
        const claim = await claimDirect(db, ids.task("Süti sütése"), PARENT_ROW_F1, FAMILY_1);
        const moved = await saveTask(
          SUPER_ADMIN,
          ids.task("Süti sütése"),
          1,
          { section_id: extra.reference, title: "Süti sütése" },
          await version(),
        );
        assert.equal(moved.state, "success");
        const row = (
          await rowsOf(db, "event_checklist_tasks", "id = $1", [ids.task("Süti sütése")])
        )[0]!;
        assert.deepEqual([row.section_id, row.position], [extra.reference, 1]);
        assert.equal((await rowsOf(db, "checklist_claims", "id = $1", [claim])).length, 1);
        assert.deepEqual(
          (
            await rowsOf(db, "event_checklist_tasks", "section_id = $1 order by position", [
              ids.section("Szülők"),
            ])
          ).map((task) => task.position),
          [1, 2],
        );
      });
      it("the full order is saved: sections and the tasks in each, positions 1 to the count", async () => {
        const ids = await idsOf(db, COMMUNITY_EVENT);
        const parents = ids.tasks
          .filter((row) => row.section_id === ids.section("Szülők"))
          .map((row) => row.id)
          .reverse();
        const order = [
          {
            section_id: ids.section("Óvónők"),
            task_ids: ids.tasks
              .filter((row) => row.section_id === ids.section("Óvónők"))
              .map((row) => row.id),
          },
          { section_id: ids.section("Szülők"), task_ids: parents },
          {
            section_id: ids.section("Szervezők"),
            task_ids: ids.tasks
              .filter((row) => row.section_id === ids.section("Szervezők"))
              .map((row) => row.id),
          },
        ];
        const start = await version();
        assert.equal((await reorder(SUPER_ADMIN, order)).state, "success");
        assert.equal(await version(), start + 1);
        const view = await checklistOf(call, SUPER_ADMIN, COMMUNITY_EVENT);
        assert.deepEqual(
          view.item.sections.map((section) => section.title),
          ["Óvónők", "Szülők", "Szervezők"],
        );
        assert.deepEqual(
          view.item.sections[1]!.tasks.map((task) => task.title),
          ["Nyári virágok", "Süti sütése", "Székek bevitele"],
        );
      });
      it("a teachers' section keeps helpers 1 and no times; a coordinator manages their group's event", async () => {
        const ids = await idsOf(db, COMMUNITY_EVENT);
        const added = await addTask(SUPER_ADMIN, ids.section("Óvónők"), {
          helpers_needed: 6,
          time_matters: true,
        });
        const row = (await rowsOf(db, "event_checklist_tasks", "id = $1", [added.reference]))[0]!;
        assert.deepEqual([row.helpers_needed, row.time_matters], [1, false]);
        assert.equal(
          (await addSection(ADMIN_G1, "Csoport szakasz", "parents", 0, GROUP_EVENT)).state,
          "success",
        );
      });
    });

    describe("refused", () => {
      it("a parent, a teacher, an organiser who is not a manager and a signed-out caller are denied on every command; nothing changes", async () => {
        await makeOrganiser(db, COMMUNITY_EVENT, PARENT_ROW_F2);
        const ids = await idsOf(db, COMMUNITY_EVENT);
        const tableBefore = JSON.stringify(await rowsOf(db, "event_checklist_tasks"));
        for (const account of [PARENT_F1, PARENT_F2, TEACHER_G1, DEACTIVATED]) {
          assert.equal((await addSection(account, "Tiltott")).state, "denied", account);
          assert.equal((await addTask(account, ids.section("Szülők"))).state, "denied", account);
          assert.equal(
            (await removeTask(account, ids.task("Székek bevitele"))).state,
            "denied",
            account,
          );
          assert.equal(
            (await removeSection(account, ids.section("Szülők"))).state,
            "denied",
            account,
          );
          assert.equal((await reorder(account, [])).state, "denied", account);
        }
        assert.equal(JSON.stringify(await rowsOf(db, "event_checklist_tasks")), tableBefore);
        assert.equal((await rowsOf(db, "event_checklist_sections")).length, 3);
      });
      it("a finished or cancelled event's checklist is read-only (EVENT_CLOSED)", async () => {
        for (const event of [PAST_EVENT, CANCELLED_EVENT]) {
          assert.deepEqual(
            outcome(await addSection(SUPER_ADMIN, "Késő", "parents", 0, event)),
            ["conflict", "EVENT_CLOSED"],
            event,
          );
        }
        await db.query("update events set status = 'cancelled' where id = $1", [COMMUNITY_EVENT]);
        const ids = await idsOf(db, COMMUNITY_EVENT);
        assert.equal((await addTask(SUPER_ADMIN, ids.section("Szülők"))).code, "EVENT_CLOSED");
        assert.equal(
          (await removeTask(SUPER_ADMIN, ids.task("Székek bevitele"))).code,
          "EVENT_CLOSED",
        );
        assert.equal((await reorder(SUPER_ADMIN, [])).code, "EVENT_CLOSED");
      });
      it("the fields are checked: title, kind, deadline after the event, counts, helpers below the claims", async () => {
        const ids = await idsOf(db, COMMUNITY_EVENT);
        const bad = async (
          result: Promise<Record<string, unknown>>,
          field: string,
          reason?: string,
        ) => {
          const answer = await result;
          assert.deepEqual(
            [answer.state, answer.field, reason ? answer.reason : undefined],
            ["validation", field, reason],
          );
        };
        await bad(addSection(SUPER_ADMIN, " "), "title");
        await bad(addSection(SUPER_ADMIN, "Jó", "weird"), "kind");
        await bad(addTask(SUPER_ADMIN, ids.section("Szülők"), { title: "" }), "title");
        await bad(addTask(SUPER_ADMIN, ids.section("Szülők"), { priority: 9 }), "priority");
        await bad(
          addTask(SUPER_ADMIN, ids.section("Szülők"), { deadline: "2099-12-31" }),
          "deadline",
          "after_end",
        );
        await bad(
          addTask(SUPER_ADMIN, ids.section("Szülők"), { deadline: "holnap" }),
          "deadline",
          "invalid",
        );
        await bad(
          addTask(SUPER_ADMIN, "00000000-0000-4000-8000-0000000000aa"),
          "section_id",
          "not_found",
        );
        await claimDirect(db, ids.task("Székek bevitele"), PARENT_ROW_F1, FAMILY_1);
        await claimDirect(db, ids.task("Székek bevitele"), null, null, "Vendég");
        const below = await saveTask(SUPER_ADMIN, ids.task("Székek bevitele"), 1, {
          section_id: ids.section("Szülők"),
          title: "Székek bevitele",
          helpers_needed: 1,
        });
        assert.deepEqual(
          [below.state, below.field, below.reason],
          ["validation", "helpers_needed", "below_claims"],
        );
        await db.query(
          "insert into event_checklist_sections (organization_id, checklist_id, event_id, position, title) select organization_id, id, event_id, 3 + g, 'Töltő ' || g from event_checklists, generate_series(1, 27) g where event_id = $1",
          [COMMUNITY_EVENT],
        );
        await bad(addSection(SUPER_ADMIN, "Harmincegyedik"), "sections", "too_many_sections");
      });
      it("a task with a claim or a done mark, and the section that holds it, cannot be deleted; the kind of such a section cannot change", async () => {
        const ids = await idsOf(db, COMMUNITY_EVENT);
        await claimDirect(db, ids.task("Süti sütése"), PARENT_ROW_F1, FAMILY_1);
        await db.query("update event_checklist_tasks set done_at = now() where id = $1", [
          ids.task("Székek bevitele"),
        ]);
        assert.deepEqual(outcome(await removeTask(SUPER_ADMIN, ids.task("Süti sütése"))), [
          "conflict",
          "TASK_HAS_CLAIMS",
        ]);
        assert.deepEqual(outcome(await removeTask(SUPER_ADMIN, ids.task("Székek bevitele"))), [
          "conflict",
          "TASK_HAS_CLAIMS",
        ]);
        assert.deepEqual(outcome(await removeSection(SUPER_ADMIN, ids.section("Szülők"))), [
          "conflict",
          "TASK_HAS_CLAIMS",
        ]);
        const kind = await call(SUPER_ADMIN, "checklist_section_save($1, $2, null, $3::jsonb)", [
          nextKey("kind"),
          COMMUNITY_EVENT,
          json({
            id: ids.section("Szülők"),
            expected_version: 1,
            title: "Szülők",
            kind: "organisers",
          }),
        ]);
        assert.deepEqual(outcome(kind), ["conflict", "SECTION_HAS_CLAIMS"]);
        const other = await idsOf(db, COMMUNITY_EVENT);
        const move = await saveTask(
          SUPER_ADMIN,
          ids.task("Süti sütése"),
          1,
          { section_id: other.section("Szervezők"), title: "Süti sütése" },
          await version(),
        );
        assert.deepEqual(outcome(move), ["conflict", "SECTION_HAS_CLAIMS"]);
        assert.equal(
          (await rowsOf(db, "event_checklist_tasks")).length,
          5,
          "every task is still there",
        );
      });
      it("the order must list exactly the event's sections and each section's tasks", async () => {
        const ids = await idsOf(db, COMMUNITY_EVENT);
        const short = [{ section_id: ids.section("Szülők"), task_ids: [] }];
        assert.deepEqual(
          [(await reorder(SUPER_ADMIN, short)).field, (await reorder(SUPER_ADMIN, short)).reason],
          ["order", "sections_differ"],
        );
        const wrong = ids.sections.map((section) => ({
          section_id: section.id,
          task_ids: [] as string[],
        }));
        assert.equal((await reorder(SUPER_ADMIN, wrong)).reason, "tasks_differ");
      });
    });

    describe("out of reach", () => {
      it("another group's coordinator is denied on a group event and on the community event; another community's admin finds nothing; made-up row ids are denied the same way", async () => {
        const ids = await idsOf(db, COMMUNITY_EVENT);
        assert.equal(
          (await addSection(ADMIN_G2, "Idegen", "parents", 0, GROUP_EVENT)).state,
          "denied",
        );
        assert.equal(
          (await addSection(ADMIN_G1, "Közösségi", "parents", 0, COMMUNITY_EVENT)).state,
          "denied",
        );
        assert.equal(
          (await addSection(OTHER_ADMIN, "Kívülálló", "parents", 0, COMMUNITY_EVENT)).state,
          "validation",
        );
        assert.equal((await removeTask(ADMIN_G2, ids.task("Székek bevitele"))).state, "denied");
        assert.equal(
          (await removeTask(OTHER_ADMIN, ids.task("Székek bevitele"))).state,
          "denied",
          "a task of another community is not found",
        );
        assert.equal(
          (await removeTask(SUPER_ADMIN, "00000000-0000-4000-8000-0000000000aa")).state,
          "denied",
        );
        assert.equal((await removeSection(OTHER_ADMIN, ids.section("Szülők"))).state, "denied");
      });
    });

    describe("outdated screen", () => {
      it("a stale checklist version is refused on add, delete and reorder; a stale task or section version too", async () => {
        const ids = await idsOf(db, COMMUNITY_EVENT);
        const stale = (await version()) - 1;
        assert.deepEqual(outcome(await addSection(SUPER_ADMIN, "Régi", "parents", stale)), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        assert.deepEqual(outcome(await addTask(SUPER_ADMIN, ids.section("Szülők"), {}, stale)), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        assert.deepEqual(
          outcome(await removeTask(SUPER_ADMIN, ids.task("Székek bevitele"), stale)),
          ["conflict", "VERSION_CONFLICT"],
        );
        assert.deepEqual(outcome(await removeSection(SUPER_ADMIN, ids.section("Óvónők"), stale)), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        assert.deepEqual(outcome(await reorder(SUPER_ADMIN, [], stale)), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        const task = await saveTask(SUPER_ADMIN, ids.task("Székek bevitele"), 7, {
          section_id: ids.section("Szülők"),
          title: "Más",
        });
        assert.deepEqual(outcome(task), ["conflict", "VERSION_CONFLICT"]);
        const section = await call(SUPER_ADMIN, "checklist_section_save($1, $2, null, $3::jsonb)", [
          nextKey("s"),
          COMMUNITY_EVENT,
          json({ id: ids.section("Szülők"), expected_version: 5, title: "Más" }),
        ]);
        assert.deepEqual(outcome(section), ["conflict", "VERSION_CONFLICT"]);
        assert.equal(await versionOf("event_checklist_tasks", ids.task("Székek bevitele")), 1);
      });
    });

    describe("repeated click", () => {
      it("the same key adds once and returns the stored result; the same key with other content is a conflict", async () => {
        const key = nextKey("dup");
        const at = await version();
        const send = (title: string) =>
          call(SUPER_ADMIN, "checklist_section_save($1, $2, $3, $4::jsonb)", [
            key,
            COMMUNITY_EVENT,
            at,
            json({ title, kind: "parents" }),
          ]);
        const first = await send("Egyszer");
        const again = await send("Egyszer");
        assert.deepEqual(
          [again.state, again.code, again.reference],
          ["success", "replayed", first.reference],
        );
        assert.equal((await rowsOf(db, "event_checklist_sections", "title = 'Egyszer'")).length, 1);
        assert.deepEqual(outcome(await send("Másképp")), ["conflict", "idempotency_key_reused"]);
      });
    });

    describe("two people at once", () => {
      it("two managers adding at one version leave one winner; two deletes of one task leave it deleted once", async () => {
        const at = await version();
        const answers = await Promise.all([
          addSection(SUPER_ADMIN, "Egyik", "parents", at),
          callSecond(SUPER_ADMIN, "checklist_section_save($1, $2, $3, $4::jsonb)", [
            nextKey("b"),
            COMMUNITY_EVENT,
            at,
            json({ title: "Másik", kind: "parents" }),
          ]),
        ]);
        assert.deepEqual(answers.map((answer) => answer.state).sort(), ["conflict", "success"]);
        const ids = await idsOf(db, COMMUNITY_EVENT);
        const next = await version();
        const deletes = await Promise.all([
          removeTask(SUPER_ADMIN, ids.task("Székek bevitele"), next),
          callSecond(SUPER_ADMIN, "checklist_task_remove($1, $2, $3)", [
            nextKey("d"),
            ids.task("Székek bevitele"),
            next,
          ]),
        ]);
        assert.deepEqual(
          deletes.map((answer) => answer.state).sort(),
          ["success", "validation"],
          "the loser finds the task already gone",
        );
        assert.equal((await rowsOf(db, "event_checklist_tasks")).length, 4);
      });
    });
  });
}
