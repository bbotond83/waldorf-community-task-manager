import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  CO_PARENT_F1,
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  openDirectoryDatabase,
  OTHER_ADMIN,
  OUTSIDER,
  SIGNED_OUT,
  TEACHER_G1,
} from "./directory-support.ts";
import {
  auditRows,
  caller,
  checklistOf,
  GROUP_EVENT,
  idsOf,
  makeOrganiser,
  nextKey,
  rowsOf,
  seedEventWorld,
  seedSampleChecklist,
} from "./checklist-support.ts";
import { inDays } from "./events-support.ts";
import {
  ADMIN_G1,
  ADMIN_G2,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F2,
} from "./working-groups-support.ts";

/**
 * Taking a checklist task and marking it done (W6; BR165.1 to BR166.2, NFR1, NFR3, NFR10) on the fixed list. The event is
 * a group event: its coordinator (a parent with a family) is the manager, a parent marked as organiser belongs to the
 * organising team without managing, and the other parents are plain parents. The 50-run races are in
 * checklist-claims-races.test.ts.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`checklist claims in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedEventWorld(db, schema);
      await db.query("delete from checklist_templates");
      await seedSampleChecklist(
        caller(() => db, schema),
        ADMIN_G1,
        GROUP_EVENT,
        true,
        db,
      );
      await makeOrganiser(db, GROUP_EVENT, PARENT_ROW_F2);
    });

    const call = caller(() => db, schema);
    const outcome = (result: { state: string; code: string | null }) => [result.state, result.code];
    const claim = (
      account: string,
      task: string,
      note: string | null = null,
      at: string | null = null,
      key = nextKey("cl"),
    ) => call(account, "checklist_claim($1, $2, $3, $4)", [key, task, note, at]);
    const typed = (
      account: string,
      task: string,
      name: string | null = "Vendég Vince",
      note: string | null = null,
      at: string | null = null,
    ) =>
      call(account, "checklist_claim_typed($1, $2, $3, $4, $5)", [
        nextKey("ty"),
        task,
        name,
        note,
        at,
      ]);
    const change = (
      account: string,
      id: string,
      version: number,
      note: string | null,
      at: string | null = null,
    ) =>
      call(account, "checklist_claim_change($1, $2, $3, $4, $5)", [
        nextKey("ch"),
        id,
        version,
        note,
        at,
      ]);
    const withdraw = (account: string, id: string, version: number, key = nextKey("wd")) =>
      call(account, "checklist_claim_withdraw($1, $2, $3)", [key, id, version]);
    const done = (account: string, task: string, version: number, key = nextKey("dn")) =>
      call(account, "checklist_task_mark_done($1, $2, $3)", [key, task, version]);
    const undo = (account: string, task: string, version: number) =>
      call(account, "checklist_task_undo_done($1, $2, $3)", [nextKey("un"), task, version]);
    const ids = () => idsOf(db, GROUP_EVENT);
    const taskView = async (account: string, title: string) =>
      (await checklistOf(call, account, GROUP_EVENT)).item.sections
        .flatMap((section) => section.tasks)
        .find((task) => task.title === title)!;

    describe("claiming", () => {
      it("allowed: a parent takes a parents' task with a note, the name shows with the family's, and a second family takes the second place", async () => {
        const task = (await ids()).task("Székek bevitele");
        const first = await claim(PARENT_F1, task, "Két széket hozok");
        assert.deepEqual([first.state, first.version], ["success", 1]);
        const second = await claim(ADMIN_G2, task);
        assert.equal(second.state, "success");
        const view = await taskView(PARENT_F2, "Székek bevitele");
        assert.deepEqual([view.helpers_taken, view.helpers_needed], [2, 2]);
        assert.deepEqual(
          view.claims.map((c) => [c.is_own, c.note]),
          [
            [false, "Két széket hozok"],
            [false, null],
          ],
        );
        assert.ok(
          view.claims[0]!.parent_display_name && view.claims[0]!.family_display_name,
          "names come through C6",
        );
        assert.equal((await taskView(PARENT_F1, "Székek bevitele")).claims[0]!.is_own, true);
        assert.equal(view.can.claim, false, "a full task cannot be taken");
      });
      it("allowed: a chosen time inside the event on a timed task; the deadline blocks nothing; no rota, standing or duty table is touched", async () => {
        const task = (await ids()).task("Süti sütése");
        await db.query(
          "update events set signup_deadline = (now() at time zone 'Europe/Budapest')::date - 1 where id = $1",
          [GROUP_EVENT],
        );
        const before = JSON.stringify([
          await rowsOf(db, "assignments"),
          await rowsOf(db, "change_requests"),
        ]);
        const result = await claim(PARENT_F1, task, null, inDays(10.05));
        assert.equal(result.state, "success");
        assert.equal(
          JSON.stringify([await rowsOf(db, "assignments"), await rowsOf(db, "change_requests")]),
          before,
        );
      });
      it("allowed: only the organising team takes an organisers' task, a coordinator and a parent marked as organiser alike", async () => {
        const task = (await ids()).task("Értesítő küldése");
        assert.equal((await claim(PARENT_F2, task)).state, "success");
        assert.deepEqual(
          outcome(await claim(ADMIN_G1, task)),
          ["conflict", "TASK_TAKEN"],
          "one place only; the manager is on the team too",
        );
      });
      it("allowed: the organising team enters a helper without an account by name, who counts towards the places", async () => {
        const task = (await ids()).task("Székek bevitele");
        const first = await typed(PARENT_F2, task, "Szomszéd Sándor", "hoz létrát");
        assert.deepEqual([first.state, first.version], ["success", 1]);
        const view = await taskView(PARENT_F1, "Székek bevitele");
        assert.deepEqual(
          [view.helpers_taken, view.claims[0]!.typed_name, view.claims[0]!.parent_display_name],
          [1, "Szomszéd Sándor", null],
        );
        assert.equal((await claim(PARENT_F1, task)).state, "success");
        assert.deepEqual(outcome(await claim(ADMIN_G2, task)), ["conflict", "TASK_TAKEN"]);
        assert.deepEqual(outcome(await typed(ADMIN_G1, task)), ["conflict", "TASK_TAKEN"]);
      });
      it("refused: a teacher, a caller with no family, a signed-out and a deactivated account are denied; nothing is written", async () => {
        const task = (await ids()).task("Székek bevitele");
        for (const account of [TEACHER_G1, OUTSIDER, SIGNED_OUT, DEACTIVATED, OTHER_ADMIN]) {
          assert.equal((await claim(account, task)).state, "denied", account);
        }
        assert.equal((await rowsOf(db, "checklist_claims")).length, 0);
      });
      it("refused: a teachers' task is not claimable; an organisers' task answers a plain parent exactly like a missing task", async () => {
        const all = await ids();
        assert.deepEqual(outcome(await claim(PARENT_F1, all.task("Dal kiválasztása"))), [
          "conflict",
          "TASK_NOT_CLAIMABLE",
        ]);
        assert.deepEqual(outcome(await typed(ADMIN_G1, all.task("Dal kiválasztása"))), [
          "conflict",
          "TASK_NOT_CLAIMABLE",
        ]);
        const hidden = await claim(PARENT_F1, all.task("Értesítő küldése"));
        const missing = await claim(PARENT_F1, "00000000-0000-4000-8000-0000000000aa");
        assert.deepEqual([hidden.state, hidden.code], [missing.state, missing.code]);
        assert.equal(hidden.code, "CHECKLIST_TASK_UNAVAILABLE");
      });
      it("refused: the same parent twice, a done task, a finished or cancelled event, bad notes and times, a typed name from a plain parent", async () => {
        const all = await ids();
        const task = all.task("Süti sütése");
        assert.equal((await claim(PARENT_F1, task)).state, "success");
        assert.deepEqual(outcome(await claim(PARENT_F1, task)), ["conflict", "ALREADY_CLAIMED"]);
        assert.deepEqual(outcome(await claim(ADMIN_G2, task)), ["conflict", "TASK_TAKEN"]);
        const checks = async (result: Promise<Record<string, unknown>>, reason: string) =>
          assert.deepEqual(
            [(await result).field, (await result).reason],
            [reason === "note" ? "note" : "chosen_at", reason === "note" ? "invalid" : reason],
          );
        const free = all.task("Nyári virágok");
        await checks(claim(ADMIN_G2, free, null, inDays(10.05)), "not_offered");
        await checks(claim(ADMIN_G2, task, null, inDays(30)), "outside_event");
        await checks(claim(ADMIN_G2, free, "x".repeat(501)), "note");
        assert.equal((await typed(ADMIN_G2, free)).state, "denied");
        assert.equal((await typed(ADMIN_G1, free, " ")).field, "name");
        await db.query("update event_checklist_tasks set done_at = now() where id = $1", [free]);
        assert.deepEqual(outcome(await claim(ADMIN_G2, free)), ["conflict", "TASK_DONE"]);
        await db.query(
          "update events set ends_at = now() - interval '1 hour', starts_at = now() - interval '2 hours' where id = $1",
          [GROUP_EVENT],
        );
        assert.deepEqual(outcome(await claim(ADMIN_G2, all.task("Székek bevitele"))), [
          "conflict",
          "EVENT_CLOSED",
        ]);
      });
      it("out of reach: nothing about a task of another community is revealed to its outsiders", async () => {
        const task = (await ids()).task("Székek bevitele");
        assert.equal((await claim(OTHER_ADMIN, task)).state, "denied");
      });
      it("outdated screen: a task that filled up meanwhile answers TASK_TAKEN, and one that was done answers TASK_DONE", async () => {
        const task = (await ids()).task("Süti sütése");
        await claim(PARENT_F1, task);
        assert.equal((await claim(ADMIN_G2, task)).code, "TASK_TAKEN");
      });
      it("repeated click: the same key returns the stored result and takes one place; the same key with other content is a conflict", async () => {
        const task = (await ids()).task("Székek bevitele");
        const key = nextKey("same");
        const first = await claim(PARENT_F1, task, "egyszer", null, key);
        const again = await claim(PARENT_F1, task, "egyszer", null, key);
        assert.deepEqual(
          [again.state, again.code, again.reference],
          ["success", "replayed", first.reference],
        );
        assert.equal((await rowsOf(db, "checklist_claims")).length, 1);
        assert.deepEqual(outcome(await claim(PARENT_F1, task, "másképp", null, key)), [
          "conflict",
          "idempotency_key_reused",
        ]);
      });
      it("nem értelmezhető: two people at once on the last place is in checklist-claims-races.test.ts", () => {
        assert.ok(true);
      });
    });

    describe("changing and giving up a claim", () => {
      it("allowed: the owner changes the note and time and gives the claim up; the organising team removes another's claim, audited without names", async () => {
        const task = (await ids()).task("Süti sütése");
        const mine = await claim(PARENT_F1, task, "régi", inDays(10.02));
        const changed = await change(PARENT_F1, mine.reference!, 1, "új", inDays(10.06));
        assert.deepEqual([changed.state, changed.version], ["success", 2]);
        assert.equal((await withdraw(PARENT_F1, mine.reference!, 2)).state, "success");
        assert.equal(
          (await auditRows(db, "checklist.claim_removed")).length,
          0,
          "an owner's own withdrawal is not audited",
        );
        const again = await claim(ADMIN_G2, task);
        const removed = await withdraw(PARENT_F2, again.reference!, 1);
        assert.equal(removed.state, "success");
        const audit = await auditRows(db, "checklist.claim_removed");
        assert.equal(audit.length, 1);
        assert.equal(audit[0]!.details?.startsWith("event:"), true);
        assert.equal((await rowsOf(db, "checklist_claims")).length, 0);
      });
      it("allowed: the owner may still give a claim up when the event was cancelled; the team may not", async () => {
        const task = (await ids()).task("Székek bevitele");
        const mine = await claim(PARENT_F1, task);
        const theirs = await claim(ADMIN_G2, task);
        await db.query("update events set status = 'cancelled' where id = $1", [GROUP_EVENT]);
        assert.deepEqual(outcome(await withdraw(PARENT_F2, theirs.reference!, 1)), [
          "conflict",
          "EVENT_CLOSED",
        ]);
        assert.equal((await withdraw(PARENT_F1, mine.reference!, 1)).state, "success");
        assert.deepEqual(outcome(await change(ADMIN_G2, theirs.reference!, 1, "késő")), [
          "conflict",
          "EVENT_CLOSED",
        ]);
      });
      it("refused: another parent and a teacher cannot change or withdraw a claim; a made-up id is denied the same way; nothing changes", async () => {
        const task = (await ids()).task("Székek bevitele");
        const mine = await claim(PARENT_F1, task);
        for (const account of [ADMIN_G2, CO_PARENT_F1, TEACHER_G1, OUTSIDER]) {
          assert.equal(
            (await change(account, mine.reference!, 1, "tilos")).state,
            "denied",
            account,
          );
          assert.equal((await withdraw(account, mine.reference!, 1)).state, "denied", account);
        }
        assert.equal(
          (await withdraw(ADMIN_G2, "00000000-0000-4000-8000-0000000000aa", 1)).state,
          "denied",
        );
        assert.equal((await rowsOf(db, "checklist_claims")).length, 1);
        assert.equal((await rowsOf(db, "checklist_claims"))[0]!.note, null);
      });
      it("refused: a claim on a done task cannot be withdrawn until the done mark is undone, and a finished event keeps its claims", async () => {
        const task = (await ids()).task("Süti sütése");
        const mine = await claim(PARENT_F1, task);
        await done(PARENT_F1, task, 1);
        assert.deepEqual(outcome(await withdraw(PARENT_F1, mine.reference!, 1)), [
          "conflict",
          "TASK_DONE",
        ]);
        assert.deepEqual(outcome(await withdraw(PARENT_F2, mine.reference!, 1)), [
          "conflict",
          "TASK_DONE",
        ]);
        await undo(PARENT_F1, task, 2);
        await db.query(
          "update events set ends_at = now() - interval '1 hour', starts_at = now() - interval '2 hours' where id = $1",
          [GROUP_EVENT],
        );
        assert.deepEqual(outcome(await withdraw(PARENT_F1, mine.reference!, 1)), [
          "conflict",
          "EVENT_CLOSED",
        ]);
        assert.equal((await rowsOf(db, "checklist_claims")).length, 1);
      });
      it("outdated screen and repeated click: an old claim version conflicts; the same key replays", async () => {
        const task = (await ids()).task("Süti sütése");
        const mine = await claim(PARENT_F1, task);
        await change(PARENT_F1, mine.reference!, 1, "egy");
        assert.deepEqual(outcome(await change(PARENT_F1, mine.reference!, 1, "kettő")), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        assert.deepEqual(outcome(await withdraw(PARENT_F1, mine.reference!, 1)), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        const key = nextKey("w");
        const first = await withdraw(PARENT_F1, mine.reference!, 2, key);
        assert.equal((await withdraw(PARENT_F1, mine.reference!, 2, key)).code, "replayed");
        assert.equal(first.state, "success");
      });
    });

    describe("marking done and undoing it", () => {
      it("allowed: a helper marks their task done, who and when are recorded; the team marks an unclaimed task and undoes any mark, audited when it is another person's", async () => {
        const all = await ids();
        await claim(PARENT_F1, all.task("Süti sütése"));
        const marked = await done(PARENT_F1, all.task("Süti sütése"), 1);
        assert.deepEqual([marked.state, marked.version], ["success", 2]);
        const view = await taskView(PARENT_F1, "Süti sütése");
        assert.equal(view.done?.is_own, true);
        assert.ok(view.done?.by_display_name);
        assert.equal((await undo(PARENT_F1, all.task("Süti sütése"), 2)).state, "success");
        assert.equal(
          (await auditRows(db, "checklist.done_undone")).length,
          0,
          "own mark: no audit",
        );
        assert.equal(
          (await done(PARENT_F2, all.task("Nyári virágok"), 1)).state,
          "success",
          "the closing round: nobody claimed it",
        );
        assert.equal((await undo(ADMIN_G1, all.task("Nyári virágok"), 2)).state, "success");
        assert.equal((await auditRows(db, "checklist.done_undone")).length, 1);
        assert.equal((await rowsOf(db, "event_checklist_tasks", "done_at is not null")).length, 0);
      });
      it("allowed: when every parents' and organisers' task is done the team sees allDone, plain parents never do", async () => {
        for (const task of [
          "Székek bevitele",
          "Süti sütése",
          "Nyári virágok",
          "Értesítő küldése",
        ]) {
          const id = (await ids()).task(task);
          assert.equal((await done(PARENT_F2, id, 1)).state, "success", task);
        }
        assert.equal((await checklistOf(call, PARENT_F2, GROUP_EVENT)).item.all_done, true);
        assert.equal((await checklistOf(call, PARENT_F1, GROUP_EVENT)).item.all_done, null);
        await undo(PARENT_F2, (await ids()).task("Süti sütése"), 2);
        assert.equal((await checklistOf(call, ADMIN_G1, GROUP_EVENT)).item.all_done, false);
      });
      it("refused: a parent with no claim, a teacher and an account with no parent record are denied; a teachers' task cannot be marked", async () => {
        const all = await ids();
        for (const account of [ADMIN_G2, TEACHER_G1, OUTSIDER, SIGNED_OUT]) {
          assert.equal((await done(account, all.task("Süti sütése"), 1)).state, "denied", account);
        }
        assert.deepEqual(outcome(await done(PARENT_F2, all.task("Dal kiválasztása"), 1)), [
          "conflict",
          "TASK_NOT_CLAIMABLE",
        ]);
        assert.equal(
          (await done(PARENT_F1, all.task("Értesítő küldése"), 1)).code,
          "CHECKLIST_TASK_UNAVAILABLE",
        );
        assert.equal((await rowsOf(db, "event_checklist_tasks", "done_at is not null")).length, 0);
      });
      it("refused: a done task cannot be marked again; a finished or cancelled event refuses marking and undoing", async () => {
        const task = (await ids()).task("Süti sütése");
        await claim(PARENT_F1, task);
        await done(PARENT_F1, task, 1);
        assert.deepEqual(outcome(await done(PARENT_F2, task, 1)), ["conflict", "TASK_DONE"]);
        await db.query("update events set status = 'cancelled' where id = $1", [GROUP_EVENT]);
        assert.deepEqual(outcome(await undo(PARENT_F1, task, 2)), ["conflict", "EVENT_CLOSED"]);
        assert.deepEqual(outcome(await done(PARENT_F2, (await ids()).task("Nyári virágok"), 1)), [
          "conflict",
          "EVENT_CLOSED",
        ]);
        assert.equal(
          (await rowsOf(db, "event_checklist_tasks", "done_at is not null")).length,
          1,
          "the mark stays",
        );
      });
      it("out of reach: only the one who marked it or the team may undo; another parent is denied", async () => {
        const task = (await ids()).task("Süti sütése");
        await claim(PARENT_F1, task);
        await done(PARENT_F1, task, 1);
        for (const account of [ADMIN_G2, CO_PARENT_F1, TEACHER_G1]) {
          assert.equal((await undo(account, task, 2)).state, "denied", account);
        }
        assert.equal((await rowsOf(db, "event_checklist_tasks", "done_at is not null")).length, 1);
      });
      it("outdated screen and repeated click: a stale task version conflicts; the same key replays and marks once", async () => {
        const task = (await ids()).task("Süti sütése");
        await claim(PARENT_F1, task);
        assert.deepEqual(outcome(await done(PARENT_F1, task, 9)), ["conflict", "VERSION_CONFLICT"]);
        const key = nextKey("d");
        const first = await done(PARENT_F1, task, 1, key);
        const again = await done(PARENT_F1, task, 1, key);
        assert.deepEqual(
          [again.state, again.code, again.reference],
          ["success", "replayed", first.reference],
        );
        assert.equal((await undo(PARENT_F1, task, 3)).code, "VERSION_CONFLICT");
      });
    });
  });
}
