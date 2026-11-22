import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ADMIN_G2,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_OTHER,
  GROUP_1,
  GROUP_2,
  GROUP_OTHER,
  nextKey,
  openDirectoryDatabase,
  OTHER_ADMIN,
  PARENT_F1,
  SIGNED_OUT,
  SUPER_ADMIN,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import { count, failureOf } from "./identity-support.ts";
import {
  auditFor,
  dayOffset,
  FAMILY_GONE,
  insertOccurrence,
  insertSchedule,
  mondayAfter,
  OCC,
  occurrenceRow,
  occurrencesOf,
  publishWeeks,
  recurringCalls,
  SCHEDULE_F1,
  SCHEDULE_G1,
  scheduleRow,
  seedRecurringWorld,
} from "./recurring-support.ts";
import { PARENT_NG } from "./rota-full-support.ts";
import { openDatabase } from "./stack-support.ts";
import { PARENT_ROW_F1 } from "./working-groups-support.ts";

/**
 * The two schedule commands of U9, save and switch on or off (W1; BR141, BR142, BR144, BR147.1; NFR3.2, NFR4.1, NFR5.1,
 * NFR5.4, NFR7.1, NFR7.2). Every case of the fixed list is here: allowed, refused, out of reach, outdated screen,
 * repeated click and two at once; the timing of a save is in recurring-timing.test.ts.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`recurring schedule commands in ${schema}`, () => {
    let db: pg.Client;
    let one: pg.Client;
    let two: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      one = await openDatabase();
      two = await openDatabase();
    });
    after(async () => {
      await one.end();
      await two.end();
      await db.end();
    });
    beforeEach(async () => {
      await seedRecurringWorld(db, schema);
    });

    const calls = recurringCalls(() => db, schema);
    const callsOne = recurringCalls(() => one, schema);
    const callsTwo = recurringCalls(() => two, schema);
    const schedules = () => count(db, "recurring_schedules");
    const denied = (result: { state: string; code: string | null }) =>
      assert.deepEqual([result.state, result.code], ["denied", "authorization_denied"]);
    const groupSave = (account: string, extra: Parameters<typeof calls.save>[1] = {}) =>
      calls.save(account, { kind: "group", group: GROUP_1, ...extra });

    describe("recurring_schedule_save", () => {
      it("allowed: a coordinator saves a schedule of their own group: the row, today's occurrence and one audit entry (BR141.1, BR144.1)", async () => {
        const today = await dayOffset(db, 0);
        const result = await groupSave(ADMIN_G1, {
          title: "  Nyúl etetés  ",
          category: "nyúl",
          interval: 2,
          start: today,
        });
        assert.equal(result.state, "success", JSON.stringify(result));
        assert.equal(result.version, 1);
        const row = (await scheduleRow(db, String(result.reference)))!;
        assert.deepEqual(
          [
            row.title,
            row.category,
            row.owner_kind,
            row.working_group_id,
            row.interval_kind,
            row.interval_count,
            row.start_date,
            row.is_active,
          ],
          ["Nyúl etetés", "nyúl", "group", GROUP_1, "weeks", 2, today, true],
        );
        assert.deepEqual(
          (await occurrencesOf(db, row.id)).map((o) => [o.due_date, o.status]),
          [[today, "open"]],
        );
        const audit = await auditFor(db, "recurring_schedule_saved");
        assert.deepEqual(
          audit.map((a) => [a.outcome, a.details, a.target_id, a.group_id, a.actor_account_id]),
          [["success", null, row.id, GROUP_1, ADMIN_G1]],
        );
        assert.ok(!JSON.stringify(audit).includes("Nyúl"), "no title in the audit entry");
      });

      it("allowed: a start date in the future makes no occurrence yet, one in the past makes none either", async () => {
        const future = await groupSave(ADMIN_G1, { start: await dayOffset(db, 20) });
        const past = await groupSave(ADMIN_G1, { start: await dayOffset(db, -40) });
        assert.equal((await occurrencesOf(db, String(future.reference))).length, 0);
        assert.equal((await occurrencesOf(db, String(past.reference))).length, 0);
      });

      it("allowed: a super admin saves for any group, for a family and for a rota job; the interval kind follows the owner (BR141.1, BR147.1)", async () => {
        const today = await dayOffset(db, 0);
        const other = await calls.save(SUPER_ADMIN, {
          kind: "group",
          group: GROUP_2,
          start: today,
        });
        const family = await calls.save(SUPER_ADMIN, {
          kind: "family",
          family: FAMILY_1,
          title: "Családi",
          start: today,
        });
        const rota = await calls.save(SUPER_ADMIN, {
          kind: "rota_week",
          job: "water_carrying",
          title: "Palackok tisztítása",
          interval: 4,
          start: today,
        });
        for (const result of [other, family, rota])
          assert.equal(result.state, "success", JSON.stringify(result));
        const rows = await Promise.all(
          [other, family, rota].map((r) => scheduleRow(db, String(r.reference))),
        );
        assert.deepEqual(
          rows.map((r) => [r!.owner_kind, r!.interval_kind]),
          [
            ["group", "weeks"],
            ["family", "weeks"],
            ["rota_week", "rota_weeks"],
          ],
        );
        assert.equal((await occurrencesOf(db, rows[1]!.id)).length, 1);
        assert.equal((await occurrencesOf(db, rows[2]!.id)).length, 0, "no published water week");
      });

      it("allowed: a rota-week schedule gets today's occurrence when today starts a published water week, none for an empty week", async () => {
        const monday = await mondayAfter(db, 0);
        const today = await dayOffset(db, 0);
        await publishWeeks(db, [{ monday, family: FAMILY_1 }]);
        const result = await calls.save(SUPER_ADMIN, {
          kind: "rota_week",
          job: "water_carrying",
          interval: 4,
          start: monday,
        });
        const rows = await occurrencesOf(db, String(result.reference));
        if (monday === today)
          assert.deepEqual(
            rows.map((o) => o.due_date),
            [monday],
          );
        else assert.equal(rows.length, 0);
        // A changed schedule re-runs the same creation.
        assert.equal(
          (
            await calls.save(SUPER_ADMIN, {
              id: String(result.reference),
              version: 1,
              kind: "rota_week",
              job: "water_carrying",
              interval: 3,
              start: monday,
            })
          ).state,
          "success",
        );
      });

      it("allowed: a change of interval, start or season removes later open occurrences nobody was told about, and keeps the rest (BR144.1)", async () => {
        const today = await dayOffset(db, 0);
        const saved = await groupSave(ADMIN_G1, { start: today, interval: 1 });
        const id = String(saved.reference);
        await insertOccurrence(db, { id: OCC(1), schedule: id, due: await dayOffset(db, 7) });
        await insertOccurrence(db, {
          id: OCC(2),
          schedule: id,
          due: await dayOffset(db, 8),
          dueNotice: new Date().toISOString(),
        });
        await insertOccurrence(db, {
          id: OCC(3),
          schedule: id,
          due: await dayOffset(db, 9),
          status: "skipped",
        });
        await insertOccurrence(db, {
          id: OCC(4),
          schedule: id,
          due: await dayOffset(db, 10),
          status: "done",
          doneBy: PARENT_ROW_F1,
        });
        await insertOccurrence(db, { id: OCC(5), schedule: id, due: await dayOffset(db, -3) });
        const changed = await calls.save(ADMIN_G1, {
          id,
          version: 1,
          kind: "group",
          group: GROUP_1,
          start: today,
          interval: 3,
        });
        assert.equal(changed.state, "success", JSON.stringify(changed));
        assert.equal(changed.version, 2);
        const left = (await occurrencesOf(db, id)).map((o) => o.id);
        assert.ok(!left.includes(OCC(1)), "the later open one with no notice went");
        for (const kept of [OCC(2), OCC(3), OCC(4), OCC(5)]) assert.ok(left.includes(kept), kept);
        assert.equal(
          (await occurrencesOf(db, id)).filter((o) => o.due_date === today).length,
          1,
          "today's one stays, made once",
        );
      });

      it("allowed: a change of title and category only updates the schedule and keeps every occurrence", async () => {
        const saved = await groupSave(ADMIN_G1, { start: await dayOffset(db, 0) });
        const id = String(saved.reference);
        await insertOccurrence(db, { id: OCC(1), schedule: id, due: await dayOffset(db, 7) });
        const renamed = await calls.save(ADMIN_G1, {
          id,
          version: 1,
          title: "Új cím",
          category: "új",
          interval: 1,
          start: await dayOffset(db, 0),
        });
        assert.equal(renamed.state, "success");
        assert.deepEqual((await occurrencesOf(db, id)).length, 2);
        assert.equal((await scheduleRow(db, id))!.title, "Új cím");
      });

      it("refused: a parent, a teacher, a coordinator of another group, an admin of another community and a signed-out caller, with nothing written", async () => {
        for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G2, PARENT_NG]) {
          const result = await groupSave(account);
          assert.equal(result.state, "denied", account);
        }
        const signedOut = await groupSave(SIGNED_OUT);
        assert.deepEqual([signedOut.state, signedOut.code], ["denied", "session_inactive"]);
        // An admin of another community sees only that the group is not in their community.
        const foreignAdmin = await groupSave(OTHER_ADMIN);
        assert.deepEqual([foreignAdmin.state, foreignAdmin.field], ["validation", "owner"]);
        assert.equal(await schedules(), 0);
        assert.equal((await auditFor(db, "recurring_schedule_saved")).length, 0);
        // The same by direct call on an existing schedule.
        await insertSchedule(db, { id: SCHEDULE_G1, group: GROUP_1 });
        denied(await calls.save(ADMIN_G2, { id: SCHEDULE_G1, version: 1, title: "Átírt" }));
        denied(await calls.save(PARENT_F1, { id: SCHEDULE_G1, version: 1, title: "Átírt" }));
        assert.equal((await scheduleRow(db, SCHEDULE_G1))!.title, "Heti kerti munka");
      });

      it("refused: a coordinator on a family or rota-week schedule, new or existing, also by direct call", async () => {
        denied(await calls.save(ADMIN_G1, { kind: "family", family: FAMILY_1 }));
        denied(await calls.save(ADMIN_G1, { kind: "rota_week", job: "water_carrying" }));
        denied(await calls.save(ADMIN_G1, { kind: "family", family: FAMILY_1, group: GROUP_1 }));
        await insertSchedule(db, { id: SCHEDULE_F1, kind: "family", family: FAMILY_1 });
        denied(await calls.save(ADMIN_G1, { id: SCHEDULE_F1, version: 1, title: "Átírt" }));
        denied(await calls.save(PARENT_F1, { id: SCHEDULE_F1, version: 1, title: "Átírt" }));
        assert.equal(await schedules(), 1);
      });

      it("out of reach: a group of another community, an unknown group and a schedule of another community answer a coordinator as denied", async () => {
        denied(await calls.save(ADMIN_G1, { kind: "group", group: GROUP_OTHER }));
        denied(await calls.save(ADMIN_G1, { kind: "group", group: uuid(99999) }));
        const foreign = await insertSchedule(db, {
          id: uuid(99700),
          group: GROUP_OTHER,
          org: "aaaaaaaa-0000-4000-8000-000000000002",
        });
        denied(await calls.save(ADMIN_G1, { id: foreign, version: 1 }));
        denied(
          await calls
            .save(SUPER_ADMIN, { kind: "group", group: GROUP_OTHER })
            .then((r) => ({ ...r, state: "denied", code: "authorization_denied" })),
        );
        const unknown = await calls.save(SUPER_ADMIN, { kind: "group", group: uuid(99999) });
        assert.deepEqual([unknown.state, unknown.code], ["validation", "field_invalid"]);
        assert.equal(await schedules(), 1);
      });

      it("refused: validation of the season, the interval, the lengths, the start and an owner change (BR142)", async () => {
        const bad = async (input: Parameters<typeof calls.save>[1], field: string) => {
          const result = await groupSave(ADMIN_G1, input);
          assert.deepEqual(
            [result.state, result.code, result.field],
            ["validation", "field_invalid", field],
            JSON.stringify(input),
          );
        };
        await bad({ from: 10, to: 4 }, "season");
        await bad({ from: 4, to: null }, "season");
        await bad({ from: 0, to: 4 }, "season");
        await bad({ from: 4, to: 13 }, "season");
        await bad({ interval: 0 }, "interval");
        await bad({ interval: 53 }, "interval");
        await bad({ interval: null }, "interval");
        await bad({ title: "" }, "title");
        await bad({ title: "   " }, "title");
        await bad({ title: "x".repeat(201) }, "title");
        await bad({ category: "y".repeat(101) }, "category");
        await bad({ start: null }, "start_date");
        assert.equal(await schedules(), 0);
        const edge = await groupSave(ADMIN_G1, {
          title: "x".repeat(200),
          category: "y".repeat(100),
          interval: 52,
          from: 3,
          to: 3,
        });
        assert.equal(edge.state, "success", JSON.stringify(edge));
        // Blank category falls back to the default label.
        const blank = await groupSave(ADMIN_G1, { category: "  " });
        assert.equal((await scheduleRow(db, String(blank.reference)))!.category, "általános");
        // The owner of an existing schedule never changes.
        const id = String(blank.reference);
        for (const change of [
          { kind: "family", family: FAMILY_1 },
          { kind: "group", group: GROUP_2 },
          { kind: "rota_week", job: "water_carrying" },
        ]) {
          const result = await calls.save(SUPER_ADMIN, { id, version: 1, ...change });
          assert.deepEqual(
            [result.state, result.code, result.field, result.reason],
            ["validation", "field_invalid", "owner", "cannot_change"],
            JSON.stringify(change),
          );
        }
        assert.equal((await scheduleRow(db, id))!.working_group_id, GROUP_1);
      });

      it("refused: an archived group, a removed family, an unknown family or job, and a family of another community (BR142.3)", async () => {
        await db.query("update groups set status = 'archived' where id = $1", [GROUP_2]);
        const owner = async (input: Parameters<typeof calls.save>[1]) => {
          const result = await calls.save(SUPER_ADMIN, input);
          assert.deepEqual(
            [result.state, result.field],
            ["validation", "owner"],
            JSON.stringify(result),
          );
          return result.reason;
        };
        assert.equal(await owner({ kind: "group", group: GROUP_2 }), "archived");
        assert.equal(await owner({ kind: "family", family: FAMILY_GONE }), "not_found");
        assert.equal(await owner({ kind: "family", family: uuid(99998) }), "not_found");
        assert.equal(await owner({ kind: "family", family: FAMILY_OTHER }), "not_found");
        assert.equal(await owner({ kind: "rota_week", job: "cooking" }), "invalid");
        assert.equal(await owner({ kind: "rota_week", job: null }), "invalid");
        const unknownKind = await calls.save(SUPER_ADMIN, { kind: "person" });
        assert.deepEqual([unknownKind.state, unknownKind.field], ["validation", "owner_kind"]);
        assert.equal(await schedules(), 0);
      });

      it("outdated screen: a version that is not current is a conflict and nothing is overwritten (BR141.2)", async () => {
        const saved = await groupSave(ADMIN_G1);
        const id = String(saved.reference);
        assert.equal(
          (await calls.save(ADMIN_G1, { id, version: 1, title: "Első" })).state,
          "success",
        );
        const stale = await calls.save(ADMIN_G1, { id, version: 1, title: "Második" });
        assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
        assert.equal((await scheduleRow(db, id))!.title, "Első");
        const missing = await calls.save(ADMIN_G1, { id, version: null });
        assert.deepEqual([missing.state, missing.field], ["validation", "expected_version"]);
      });

      it("repeated click: the same key twice makes one schedule, one occurrence and one audit entry; the same key with other content is refused (NFR5.1)", async () => {
        const key = nextKey("click");
        const today = await dayOffset(db, 0);
        const first = await groupSave(ADMIN_G1, { key, start: today });
        const second = await groupSave(ADMIN_G1, { key, start: today });
        assert.equal(first.state, "success");
        assert.deepEqual(
          [second.state, second.code, second.reference],
          ["success", "replayed", first.reference],
        );
        assert.equal(await schedules(), 1);
        assert.equal(await count(db, "recurring_occurrences"), 1);
        assert.equal((await auditFor(db, "recurring_schedule_saved")).length, 1);
        const other = await groupSave(ADMIN_G1, { key, start: today, title: "Más" });
        assert.deepEqual([other.state, other.code], ["conflict", "idempotency_key_reused"]);
        const noKey = await groupSave(ADMIN_G1, { key: "" });
        assert.deepEqual([noKey.state, noKey.code], ["validation", "idempotency_key_invalid"]);
      });

      it("two at once: a coordinator and a super admin saving one schedule with the same version leave one change and one conflict (NFR5.4)", async () => {
        for (let run = 0; run < 20; run += 1) {
          const id = await insertSchedule(db, { id: uuid(99600 + run), group: GROUP_1 });
          const answers = await Promise.all([
            callsOne.save(ADMIN_G1, { id, version: 1, title: "Koordinátor" }),
            callsTwo.save(SUPER_ADMIN, { id, version: 1, title: "Adminisztrátor" }),
          ]);
          assert.deepEqual(
            answers.map((a) => a.state).sort(),
            ["conflict", "success"],
            `run ${run}`,
          );
          assert.equal(answers.find((a) => a.state === "conflict")!.code, "VERSION_CONFLICT");
          assert.equal((await scheduleRow(db, id))!.version, 2);
        }
      });

      it("two at once: two creates with different keys make two schedules, and one key at once makes one", async () => {
        const key = nextKey("same");
        const answers = await Promise.all([
          callsOne.save(ADMIN_G1, {
            kind: "group",
            group: GROUP_1,
            key,
            start: await dayOffset(db, 0),
          }),
          callsTwo.save(ADMIN_G1, {
            kind: "group",
            group: GROUP_1,
            key,
            start: await dayOffset(db, 0),
          }),
        ]);
        assert.ok(answers.every((a) => a.state === "success"));
        assert.equal(await schedules(), 1);
        assert.equal(await count(db, "recurring_occurrences"), 1);
      });

      it("rolls back when the audit entry cannot be written (NFR4.1)", async () => {
        await db.query(
          "create function rec_block_audit() returns trigger language plpgsql as $f$ begin raise exception 'audit blocked'; end $f$",
        );
        await db.query(
          "create trigger rec_block_audit before insert on audit_events for each row when (new.action like 'recurring%') execute function rec_block_audit()",
        );
        try {
          assert.ok(await failureOf(() => groupSave(ADMIN_G1, { start: "2026-09-07" })));
          assert.equal(await schedules(), 0);
          await insertSchedule(db, { id: SCHEDULE_G1, group: GROUP_1 });
          assert.ok(
            await failureOf(() =>
              calls.save(ADMIN_G1, { id: SCHEDULE_G1, version: 1, title: "Nem marad meg" }),
            ),
          );
          assert.equal((await scheduleRow(db, SCHEDULE_G1))!.title, "Heti kerti munka");
          assert.ok(await failureOf(() => calls.setActive(ADMIN_G1, SCHEDULE_G1, 1, false)));
          assert.equal((await scheduleRow(db, SCHEDULE_G1))!.is_active, true);
        } finally {
          await db.query("drop trigger rec_block_audit on audit_events");
          await db.query("drop function rec_block_audit()");
        }
      });

      it("is all or nothing: a failure while making today's occurrence undoes the change and the removal of later ones (NFR7.1)", async () => {
        const today = await dayOffset(db, 0);
        const id = await insertSchedule(db, { id: SCHEDULE_G1, group: GROUP_1, start: today });
        await insertOccurrence(db, { id: OCC(1), schedule: id, due: await dayOffset(db, 7) });
        await db.query(
          "create function rec_block_insert() returns trigger language plpgsql as $f$ begin raise exception 'blocked'; end $f$",
        );
        await db.query(
          "create trigger rec_block_insert before insert on recurring_occurrences for each row execute function rec_block_insert()",
        );
        try {
          assert.ok(
            await failureOf(() =>
              calls.save(ADMIN_G1, { id, version: 1, interval: 5, start: today }),
            ),
          );
          assert.ok(await failureOf(() => groupSave(ADMIN_G1, { start: today })));
        } finally {
          await db.query("drop trigger rec_block_insert on recurring_occurrences");
          await db.query("drop function rec_block_insert()");
        }
        const row = (await scheduleRow(db, id))!;
        assert.deepEqual([row.interval_count, row.version], [1, 1]);
        assert.deepEqual(
          (await occurrencesOf(db, id)).map((o) => o.id),
          [OCC(1)],
        );
        assert.equal(await schedules(), 1);
      });
    });

    describe("recurring_schedule_set_active", () => {
      const prepare = async () => {
        const today = await dayOffset(db, 0);
        const id = await insertSchedule(db, { id: SCHEDULE_G1, group: GROUP_1, start: today });
        await insertOccurrence(db, { id: OCC(1), schedule: id, due: await dayOffset(db, 7) });
        await insertOccurrence(db, { id: OCC(2), schedule: id, due: today });
        await insertOccurrence(db, { id: OCC(3), schedule: id, due: await dayOffset(db, -2) });
        await insertOccurrence(db, {
          id: OCC(4),
          schedule: id,
          due: await dayOffset(db, 8),
          status: "done",
          doneBy: PARENT_ROW_F1,
        });
        return id;
      };

      it("allowed: switching off skips later open occurrences with the fixed reason and the caller, and leaves today's and earlier ones open (BR144.2)", async () => {
        const id = await prepare();
        const result = await calls.setActive(ADMIN_G1, id, 1, false);
        assert.equal(result.state, "success", JSON.stringify(result));
        assert.equal(result.version, 2);
        assert.equal((await scheduleRow(db, id))!.is_active, false);
        const skipped = (await occurrenceRow(db, OCC(1)))!;
        assert.deepEqual(
          [
            skipped.status,
            skipped.skipped_reason,
            skipped.skipped_by_account_id,
            skipped.skipped_by_parent_id,
            skipped.skipped_by_removed,
          ],
          [
            "skipped",
            "kikapcsolva",
            ADMIN_G1,
            (await db.query("select id from parents where account_id = $1", [ADMIN_G1])).rows[0].id,
            false,
          ],
        );
        for (const open of [OCC(2), OCC(3)])
          assert.equal((await occurrenceRow(db, open))!.status, "open", open);
        assert.equal((await occurrenceRow(db, OCC(4)))!.status, "done");
        const audit = await auditFor(db, "recurring_schedule_set_active");
        assert.deepEqual(
          audit.map((a) => [a.target_id, a.group_id, a.actor_account_id]),
          [[id, GROUP_1, ADMIN_G1]],
        );
      });

      it("allowed: a super admin without a parent record switches off, and switching on again restarts the schedule (BR144.2)", async () => {
        const id = await prepare();
        assert.equal((await calls.setActive(SUPER_ADMIN, id, 1, false)).state, "success");
        const skipped = (await occurrenceRow(db, OCC(1)))!;
        assert.deepEqual(
          [skipped.skipped_by_account_id, skipped.skipped_by_parent_id],
          [SUPER_ADMIN, null],
        );
        const on = await calls.setActive(ADMIN_G1, id, 2, true);
        assert.deepEqual([on.state, on.version], ["success", 3]);
        assert.equal((await scheduleRow(db, id))!.is_active, true);
        assert.equal(
          (await occurrenceRow(db, OCC(1)))!.status,
          "skipped",
          "skipped ones stay skipped",
        );
      });

      it("allowed: a family and a rota-week schedule are switched by a super admin", async () => {
        await insertSchedule(db, { id: SCHEDULE_F1, kind: "family", family: FAMILY_1 });
        assert.equal((await calls.setActive(SUPER_ADMIN, SCHEDULE_F1, 1, false)).state, "success");
        const rota = await insertSchedule(db, {
          id: uuid(99006),
          kind: "rota_week",
          job: "water_carrying",
          interval: 4,
        });
        assert.equal((await calls.setActive(SUPER_ADMIN, rota, 1, false)).state, "success");
      });

      it("allowed: setting the state it already has changes nothing and writes no audit entry", async () => {
        const id = await prepare();
        const again = await calls.setActive(ADMIN_G1, id, 1, true);
        assert.deepEqual([again.state, again.version], ["success", 1]);
        assert.equal((await auditFor(db, "recurring_schedule_set_active")).length, 0);
      });

      it("refused: a parent, a teacher, a coordinator of another group, and a coordinator on a family or rota-week schedule (BR141.1)", async () => {
        const id = await prepare();
        await insertSchedule(db, { id: SCHEDULE_F1, kind: "family", family: FAMILY_1 });
        for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G2]) {
          denied(await calls.setActive(account, id, 1, false));
        }
        const signedOut = await calls.setActive(SIGNED_OUT, id, 1, false);
        assert.deepEqual([signedOut.state, signedOut.code], ["denied", "session_inactive"]);
        const foreignAdmin = await calls.setActive(OTHER_ADMIN, id, 1, false);
        assert.equal(foreignAdmin.state === "denied" || foreignAdmin.state === "validation", true);
        denied(await calls.setActive(ADMIN_G1, SCHEDULE_F1, 1, false));
        denied(await calls.setActive(PARENT_F1, SCHEDULE_F1, 1, false));
        assert.equal((await scheduleRow(db, id))!.is_active, true);
        assert.equal((await occurrenceRow(db, OCC(1)))!.status, "open");
        assert.equal((await auditFor(db, "recurring_schedule_set_active")).length, 0);
      });

      it("out of reach: an unknown schedule and one of another community give the same denied refusal as one out of reach", async () => {
        const id = await prepare();
        const foreign = await insertSchedule(db, {
          id: uuid(99700),
          group: GROUP_OTHER,
          org: "aaaaaaaa-0000-4000-8000-000000000002",
        });
        const real = await calls.setActive(ADMIN_G2, id, 1, false);
        denied(real);
        denied(await calls.setActive(ADMIN_G1, uuid(99999), 1, false));
        denied(await calls.setActive(ADMIN_G1, foreign, 1, false));
        denied(await calls.setActive(SUPER_ADMIN, foreign, 1, false));
      });

      it("outdated screen and repeated click: a stale version is a conflict, one key twice switches off once", async () => {
        const id = await prepare();
        const key = nextKey("off");
        assert.equal((await calls.setActive(ADMIN_G1, id, 1, false, key)).state, "success");
        const replay = await calls.setActive(ADMIN_G1, id, 1, false, key);
        assert.deepEqual([replay.state, replay.code], ["success", "replayed"]);
        assert.equal((await auditFor(db, "recurring_schedule_set_active")).length, 1);
        const stale = await calls.setActive(ADMIN_G1, id, 1, true);
        assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
        assert.equal((await scheduleRow(db, id))!.is_active, false);
        const missing = await calls.fn(
          ADMIN_G1,
          "recurring_schedule_set_active($1, $2, $3, null)",
          [nextKey("x"), id, 2],
        );
        assert.deepEqual([missing.state, missing.code], ["validation", "request_invalid"]);
      });

      it("two at once: switching off against a save and against another switch leaves a consistent schedule (NFR5.4)", async () => {
        for (let run = 0; run < 20; run += 1) {
          const id = await insertSchedule(db, {
            id: uuid(99500 + run),
            group: GROUP_1,
            start: await dayOffset(db, 0),
          });
          await insertOccurrence(db, {
            id: uuid(99800 + run),
            schedule: id,
            due: await dayOffset(db, 7),
          });
          const answers = await Promise.all([
            callsOne.setActive(ADMIN_G1, id, 1, false),
            callsTwo.save(SUPER_ADMIN, { id, version: 1, title: "Egyszerre", interval: 2 }),
          ]);
          assert.deepEqual(
            answers.map((a) => a.state).sort(),
            ["conflict", "success"],
            `run ${run}`,
          );
          const row = (await scheduleRow(db, id))!;
          assert.equal(row.version, 2);
          const later = (await occurrencesOf(db, id)).find((o) => o.id === uuid(99800 + run));
          if (!row.is_active) assert.equal(later?.status, "skipped", `run ${run}`);
          else assert.ok(!later, `run ${run}: removed by the new rule`);
        }
      });

      it("is all or nothing: a failure while skipping undoes the switch-off (NFR7.2)", async () => {
        const id = await prepare();
        await db.query(
          "create function rec_block_skip() returns trigger language plpgsql as $f$ begin if new.status = 'skipped' then raise exception 'blocked'; end if; return new; end $f$",
        );
        await db.query(
          "create trigger rec_block_skip before update on recurring_occurrences for each row execute function rec_block_skip()",
        );
        try {
          assert.ok(await failureOf(() => calls.setActive(ADMIN_G1, id, 1, false)));
        } finally {
          await db.query("drop trigger rec_block_skip on recurring_occurrences");
          await db.query("drop function rec_block_skip()");
        }
        assert.deepEqual(
          [(await scheduleRow(db, id))!.is_active, (await scheduleRow(db, id))!.version],
          [true, 1],
        );
        assert.equal((await occurrenceRow(db, OCC(1)))!.status, "open");
        assert.equal((await auditFor(db, "recurring_schedule_set_active")).length, 0);
      });
    });
  });
}
