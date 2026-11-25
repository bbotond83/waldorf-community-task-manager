import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  openDirectoryDatabase,
  SIGNED_OUT,
} from "./directory-support.ts";
import {
  ADMIN_G1,
  ADMIN_G2,
  caller,
  claim,
  CO_PARENT_F1,
  FAMILY_2,
  GROUP_1,
  GROUP_2,
  GROUP_EVENT,
  insertTodo,
  markDone,
  OTHER_ORGANIZATION,
  outcome,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  seedTodoWorld,
  SUPER_ADMIN,
  TEACHER_G1,
  uuid,
} from "./todo-support.ts";

/**
 * The four reads of U12 (W2, W4; BR180.1, BR184.1, BR184.2, BR185.2, BR186.1, BR186.2, NFR1, NFR3.32): the community list,
 * one task, a group's list for its coordinator, and My tasks. A cell that does not apply on a read (a repeated click, two
 * people at once, an outdated screen) is "nem értelmezhető": a read changes nothing and takes no lock.
 */
type Item = Record<string, unknown>;
const itemsOf = (answer: Record<string, unknown>) => answer.items as Item[];
const topics = (answer: Record<string, unknown>) => itemsOf(answer).map((i) => i.topic);

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`todo reads in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedTodoWorld(db, schema);
    });
    const call = caller(() => db, schema);
    const list = (account: string, ...args: unknown[]) =>
      call(account, "todo_list($1, $2, $3, $4, $5)", [
        args[0] ?? false,
        args[1] ?? null,
        args[2] ?? null,
        args[3] ?? null,
        args[4] ?? false,
      ]);
    const get = (account: string, id: string) => call(account, "todo_get($1)", [id]);
    const forGroup = (account: string, group: string) =>
      call(account, "todo_list_for_group($1)", [group]);
    const mine = (account: string) => call(account, "my_tasks_get()");
    const dayOffset = async (days: number) =>
      String(
        (await db.query("select to_char(school_today() + $1::integer, 'YYYY-MM-DD') as d", [days]))
          .rows[0].d,
      );

    it("todo_list: every reader of the community sees the same list, a teacher included; an outsider, a deactivated and a signed-out account get the denied refusal, not an empty list", async () => {
      await insertTodo(db, { topic: "Egy" });
      for (const account of [
        PARENT_F1,
        CO_PARENT_F1,
        PARENT_F2,
        TEACHER_G1,
        ADMIN_G1,
        ADMIN_G2,
        SUPER_ADMIN,
      ]) {
        const answer = await list(account);
        assert.equal(answer.state, "success", account);
        assert.deepEqual(topics(answer), ["Egy"], account);
      }
      for (const account of [OUTSIDER, DEACTIVATED, SIGNED_OUT]) {
        const answer = await list(account);
        assert.equal(answer.state, "denied", account);
        assert.equal(answer.items, undefined, "no empty list for a refused caller");
      }
    });

    it("todo_list: the exact field list of a card, and who may claim it", async () => {
      await insertTodo(db, { claimant: PARENT_ROW_F2, priority: 2, deadline: await dayOffset(3) });
      const item = itemsOf(await list(PARENT_F1))[0]!;
      assert.deepEqual(Object.keys(item).sort(), [
        "can_claim",
        "claimant_display_name",
        "claimed_by_me",
        "deadline",
        "done_on_event",
        "id",
        "is_done",
        "is_not_yet",
        "is_overdue",
        "needs_attention",
        "not_before",
        "on_event",
        "owner_id",
        "owner_kind",
        "owner_label",
        "priority",
        "status",
        "topic",
        "version",
      ]);
      assert.deepEqual(
        [item.owner_kind, item.owner_id, item.can_claim, item.claimed_by_me, item.status],
        ["working_group", GROUP_1, false, false, "in_progress"],
      );
      assert.equal(itemsOf(await list(PARENT_F2))[0]!.claimed_by_me, true);
      const teacher = (await list(TEACHER_G1)) as Record<string, unknown>;
      assert.equal(itemsOf(teacher)[0]!.can_claim, false);
      assert.deepEqual(teacher.caller, { can_claim_tasks: false, can_manage_community: false });
    });

    it("todo_list: the default view hides done and not-yet tasks, the toggle shows them marked, and the order is priority, deadline, id", async () => {
      await insertTodo(db, { topic: "Nincs prioritás", deadline: await dayOffset(1) });
      await insertTodo(db, { topic: "Kettes, korai", priority: 2, deadline: await dayOffset(1) });
      await insertTodo(db, { topic: "Kettes, késői", priority: 2, deadline: await dayOffset(9) });
      await insertTodo(db, { topic: "Egyes", priority: 1 });
      await insertTodo(db, { topic: "Kész", status: "done" });
      await insertTodo(db, { topic: "Még nem", notBefore: await dayOffset(5) });
      assert.deepEqual(topics(await list(PARENT_F1)), [
        "Egyes",
        "Kettes, korai",
        "Kettes, késői",
        "Nincs prioritás",
      ]);
      const all = await list(PARENT_F1, true);
      assert.equal(itemsOf(all).length, 6);
      const byTopic = (name: string) => itemsOf(all).find((i) => i.topic === name)!;
      assert.equal(byTopic("Kész").is_done, true);
      assert.equal(byTopic("Még nem").is_not_yet, true);
      assert.equal(byTopic("Még nem").can_claim, false);
    });

    it("todo_list: filters by owner, status, priority and the attention flag; a bad filter is refused naming the field", async () => {
      await insertTodo(db, { topic: "Egyes csoport", group: GROUP_1, priority: 1 });
      await insertTodo(db, {
        topic: "Kettes csoport",
        group: GROUP_2,
        priority: 2,
        claimant: PARENT_ROW_F1,
      });
      await insertTodo(db, { topic: "Családi", group: null, family: FAMILY_2, attention: true });
      assert.deepEqual(topics(await list(PARENT_F1, false, GROUP_2)), ["Kettes csoport"]);
      assert.deepEqual(topics(await list(PARENT_F1, false, FAMILY_2)), ["Családi"]);
      assert.deepEqual(topics(await list(PARENT_F1, false, null, "in_progress")), [
        "Kettes csoport",
      ]);
      assert.deepEqual(topics(await list(PARENT_F1, false, null, null, 1)), ["Egyes csoport"]);
      assert.deepEqual(topics(await list(PARENT_F1, false, null, null, null, true)), ["Családi"]);
      const status = await list(PARENT_F1, false, null, "kitalált");
      assert.deepEqual([status.state, status.field], ["validation", "status"]);
      const priority = await list(PARENT_F1, false, null, null, 9);
      assert.deepEqual([priority.state, priority.field], ["validation", "priority"]);
    });

    it("todo_list: the list stops at 500 and says so", async () => {
      await db.query(
        `insert into todo_tasks (organization_id, owner_group_id, topic, priority)
         select o.id, $1, 'Tömeges ' || g, (g % 3) + 1 from generate_series(1, 520) g cross join (select id from organizations where id = $2) o`,
        [
          GROUP_1,
          (await db.query("select organization_id as id from groups where id = $1", [GROUP_1]))
            .rows[0].id,
        ],
      );
      const answer = await list(PARENT_F1);
      assert.equal(itemsOf(answer).length, 500);
      assert.equal(answer.truncated, true);
      assert.equal((await list(PARENT_F1, false, GROUP_2)).truncated, false);
    });

    it("todo_list and todo_get: a pulled task says where it went and whether it was finished there, or that the list no longer has it", async () => {
      const id = await insertTodo(db, { topic: "Felvett" });
      const pulled = await call(
        SUPER_ADMIN,
        "todo_pull_to_event($1, $2, $3::uuid[], $4::integer[])",
        ["pl-1", GROUP_EVENT, [id], [1]],
      );
      assert.equal(pulled.state, "success", JSON.stringify(pulled));
      const onList = itemsOf(await list(PARENT_F1))[0]!;
      assert.deepEqual([onList.on_event, onList.done_on_event], [true, false]);
      let links = ((await get(PARENT_F1, id)).item as Item).event_links as Item[];
      assert.deepEqual([links[0]!.state, links[0]!.event_title], ["on_list", "Csoport ünnep"]);
      await db.query("update event_checklist_tasks set done_at = now() where event_id = $1", [
        GROUP_EVENT,
      ]);
      assert.deepEqual(
        [
          itemsOf(await list(PARENT_F1))[0]!.on_event,
          itemsOf(await list(PARENT_F1))[0]!.done_on_event,
        ],
        [true, true],
      );
      links = ((await get(PARENT_F1, id)).item as Item).event_links as Item[];
      assert.equal(links[0]!.state, "done_on_event");
      assert.equal(
        ((await get(PARENT_F1, id)).item as Item).status,
        "open",
        "the checklist side never closes the task",
      );
      await db.query("delete from event_checklist_tasks where event_id = $1", [GROUP_EVENT]);
      links = ((await get(PARENT_F1, id)).item as Item).event_links as Item[];
      assert.equal(links[0]!.state, "gone");
      assert.equal(itemsOf(await list(PARENT_F1))[0]!.on_event, false);
    });

    it("todo_get: fields, history with who and when and no free text, the done mark, and what each reader may do", async () => {
      const id = await insertTodo(db, { topic: "Részletes" });
      await claim(call, PARENT_F1, id, 1);
      await markDone(call, PARENT_F1, id, 2);
      const asClaimant = (await get(PARENT_F1, id)) as Record<string, unknown>;
      const item = asClaimant.item as Item;
      assert.deepEqual(
        (item.history as Item[]).map((h) => [h.change, h.actor]),
        [
          ["claimed", "Fenyő Anna"],
          ["marked_done", "Fenyő Anna"],
        ],
      );
      assert.equal((item.done as Item).is_own, true);
      assert.deepEqual(item.can, {
        claim: false,
        give_back: false,
        update: false,
        mark_done: false,
        undo_done: true,
        free_claim: false,
        edit: false,
      });
      const asManager = (await get(ADMIN_G1, id)).item as Item;
      assert.equal((asManager.done as Item).is_own, false);
      assert.equal((asManager.can as Item).undo_done, true);
      assert.equal((asManager.can as Item).edit, true);
      const asTeacher = (await get(TEACHER_G1, id)).item as Item;
      assert.deepEqual(Object.values(asTeacher.can as Item).filter(Boolean), []);
      const open = await insertTodo(db, { topic: "Nyitott" });
      const asParent = (await get(PARENT_F2, open)).item as Item;
      assert.equal((asParent.can as Item).claim, true);
      assert.equal((asParent.can as Item).mark_done, false);
    });

    it("todo_get: a task or a family that is gone reads korábbi tag and korábbi család; a task of another community and an unknown id answer the same denied refusal", async () => {
      const gone = await insertTodo(db, {
        claimant: "99999999-0000-4000-8000-000000000777",
        group: null,
        family: "99999999-0000-4000-8000-000000000778",
      });
      const item = (await get(PARENT_F1, gone)).item as Item;
      assert.equal(item.claimant_display_name, "korábbi tag");
      assert.equal(item.owner_label, "korábbi család");
      const foreignGroup = (
        await db.query("select id from groups where organization_id = $1 limit 1", [
          OTHER_ORGANIZATION,
        ])
      ).rows[0].id as string;
      const foreign = (
        await db.query(
          "insert into todo_tasks (organization_id, owner_group_id, topic) values ($1, $2, 'Idegen') returning id",
          [OTHER_ORGANIZATION, foreignGroup],
        )
      ).rows[0].id as string;
      const foreignAnswer = await get(PARENT_F1, foreign);
      const unknownAnswer = await get(PARENT_F1, uuid(9998));
      assert.deepEqual(outcome(foreignAnswer), outcome(unknownAnswer));
      assert.equal(foreignAnswer.state, "denied");
      assert.equal(foreignAnswer.item, undefined);
      assert.equal((await get(OUTSIDER, gone)).state, "denied");
    });

    it("todo_list_for_group: the group's coordinator and a super admin see its open tasks and those done in the last 60 days; everyone else is refused", async () => {
      await insertTodo(db, { topic: "Nyitott", group: GROUP_1 });
      await insertTodo(db, { topic: "Friss kész", group: GROUP_1, status: "done" });
      const old = await insertTodo(db, { topic: "Régi kész", group: GROUP_1, status: "done" });
      await db.query("update todo_tasks set done_at = now() - interval '61 days' where id = $1", [
        old,
      ]);
      await insertTodo(db, { topic: "Másik csoport", group: GROUP_2 });
      for (const account of [ADMIN_G1, SUPER_ADMIN]) {
        const answer = await forGroup(account, GROUP_1);
        assert.deepEqual(
          topics({ items: itemsOf(answer).map((i) => ({ topic: i.title })) }),
          ["Nyitott", "Friss kész"],
          account,
        );
        assert.deepEqual(Object.keys(itemsOf(answer)[0]!).slice(0, 3), ["id", "title", "status"]);
      }
      for (const account of [ADMIN_G2, PARENT_F1, TEACHER_G1, OUTSIDER]) {
        const answer = await forGroup(account, GROUP_1);
        assert.equal(answer.state, "denied", account);
        assert.equal(answer.items, undefined);
      }
    });

    it("my_tasks_get: the family's duty, the claimed task and nothing of another family; claimed tasks with no date sit under no date", async () => {
      await insertTodo(db, {
        topic: "Datált",
        claimant: PARENT_ROW_F1,
        deadline: await dayOffset(1),
      });
      await insertTodo(db, { topic: "Dátum nélkül", claimant: PARENT_ROW_F1 });
      await insertTodo(db, { topic: "Másé", claimant: PARENT_ROW_F2 });
      await insertTodo(db, { topic: "Kész", claimant: PARENT_ROW_F1, status: "done" });
      const answer = await mine(PARENT_F1);
      assert.equal(answer.state, "success", JSON.stringify(answer));
      const rows = [
        ...(answer.this_week as Item[]),
        ...(answer.later as Item[]),
        ...(answer.no_date as Item[]),
      ];
      assert.deepEqual(
        rows.map((r) => [r.kind, r.title]).sort(),
        [
          ["duty", "Sütés"],
          ["todo", "Datált"],
          ["todo", "Dátum nélkül"],
        ].sort(),
      );
      assert.equal((answer.no_date as Item[])[0]!.title, "Dátum nélkül");
      assert.equal(answer.is_empty, false);
      const otherFamily = (await mine(PARENT_F2)).no_date as Item[];
      assert.deepEqual(
        otherFamily.map((r) => r.title),
        ["Másé"],
      );
    });

    it("my_tasks_get: a teacher, a caller without a family and a super admin without a family get the denied refusal; an empty page says so", async () => {
      for (const account of [TEACHER_G1, OUTSIDER, SUPER_ADMIN, DEACTIVATED, SIGNED_OUT]) {
        const answer = await mine(account);
        assert.equal(answer.state, "denied", account);
        assert.equal(answer.this_week, undefined);
      }
      await db.query("delete from contribution_notes");
      await db.query("delete from change_requests");
      await db.query("delete from assignments");
      const empty = await mine(PARENT_F1);
      assert.deepEqual([empty.state, empty.is_empty], ["success", true]);
    });

    it("my_tasks_get: the week runs Monday to Sunday in Budapest time, an overdue task sits in this week marked, and the two clock-change weeks are ordinary weeks", async () => {
      const week = async (day: string) =>
        (await db.query(`select ${schema}.my_tasks_week_end($1::date)::text as d`, [day])).rows[0]
          .d as string;
      const group = async (due: string | null, today: string) =>
        (await db.query(`select ${schema}.my_tasks_group($1::date, $2::date) as g`, [due, today]))
          .rows[0].g as string;
      // 2027-03-28 and 2026-10-25 are the Sundays the clocks change in Hungary.
      assert.equal(await week("2027-03-22"), "2027-03-28");
      assert.equal(await week("2027-03-28"), "2027-03-28");
      assert.equal(await week("2027-03-29"), "2027-04-04");
      assert.equal(await week("2026-10-19"), "2026-10-25");
      assert.equal(await week("2026-10-25"), "2026-10-25");
      assert.equal(await week("2026-10-26"), "2026-11-01");
      assert.equal(await group("2027-03-28", "2027-03-24"), "this_week");
      assert.equal(await group("2027-03-29", "2027-03-24"), "later");
      assert.equal(await group("2026-10-25", "2026-10-21"), "this_week");
      assert.equal(await group("2026-10-26", "2026-10-21"), "later");
      assert.equal(await group("2026-01-01", "2026-10-21"), "this_week");
      assert.equal(await group(null, "2026-10-21"), "no_date");
      // Live: yesterday is this week and overdue, the Sunday after is this week, the Monday after that is later.
      await insertTodo(db, {
        topic: "Tegnapi",
        claimant: PARENT_ROW_F1,
        deadline: await dayOffset(-1),
      });
      const sunday = (
        await db.query(
          "select to_char(school_today() + (7 - extract(isodow from school_today())::integer), 'YYYY-MM-DD') as d",
        )
      ).rows[0].d as string;
      const answer = await mine(PARENT_F1);
      const overdue = (answer.this_week as Item[]).find((r) => r.title === "Tegnapi")!;
      assert.equal(overdue.is_overdue, true);
      assert.equal(answer.week_end, sunday);
    });

    it("timings: with 600 tasks the list answers in under 2 seconds and the other reads in under 1 second", async () => {
      await db.query(
        `insert into todo_tasks (organization_id, owner_group_id, topic, priority, deadline, claimant_parent_id, claimed_at, status)
         select g.organization_id, g.id, 'Mérés ' || n, (n % 3) + 1, current_date + (n % 40),
                case when n % 5 = 0 then $2::uuid end, case when n % 5 = 0 then now() end,
                case when n % 5 = 0 then 'in_progress' else 'open' end
           from generate_series(1, 600) n cross join (select * from groups where id = $1) g`,
        [GROUP_1, PARENT_ROW_F1],
      );
      const timed = async <T>(run: () => Promise<T>) => {
        const start = performance.now();
        const result = await run();
        return [performance.now() - start, result] as const;
      };
      const [listMs, listed] = await timed(() => list(PARENT_F1));
      assert.equal(listed.state, "success");
      assert.ok(listMs < 2000, `todo_list took ${listMs} ms`);
      const id = (itemsOf(listed)[0] as Item).id as string;
      for (const [label, run] of [
        ["todo_get", () => get(PARENT_F1, id)],
        ["todo_list_for_group", () => forGroup(ADMIN_G1, GROUP_1)],
        ["my_tasks_get", () => mine(PARENT_F1)],
      ] as const) {
        const [ms, answer] = await timed(run);
        assert.equal(answer.state, "success", label);
        assert.ok(ms < 1000, `${label} took ${ms} ms`);
      }
    });
  });
}
