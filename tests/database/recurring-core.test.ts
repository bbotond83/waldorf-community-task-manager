import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { FRESH_SCHEMA_SETTINGS } from "../../scripts/db/migrate.ts";
import { applyMigrations, readMigrationFiles, TRACKING_SCHEMA } from "../../scripts/db/runner.ts";
import {
  ADMIN_G1,
  CO_PARENT_F1,
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  GROUP_1,
  GROUP_2,
  GROUP_OTHER,
  ORGANIZATION,
  OTHER_ADMIN,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  SIGNED_OUT,
  SUPER_ADMIN,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import { asActor, authenticated, count, failureOf } from "./identity-support.ts";
import {
  dayOffset,
  FAMILY_GONE,
  insertOccurrence,
  insertSchedule,
  OCC,
  PARENT_ROW_GONE,
  recurringCalls,
  SCHEDULE_F1,
  SCHEDULE_G1,
  SCHEDULE_G2,
  seedRecurringWorld,
} from "./recurring-support.ts";
import { PARENT_NG } from "./rota-full-support.ts";
import { openDatabase, root } from "./stack-support.ts";
import { PARENT_ROW_F1, PARENT_ROW_F2 } from "./working-groups-support.ts";

/**
 * The tables, the registrations and the reads of U9 (W2, W3, W8; BR141 to BR143, BR146, BR150; NFR1, NFR3.4, NFR3.5,
 * NFR7.3, NFR7.9, NFR9.4). The reads have no stale screen, no repeated click and no race to lose, so those cases of the
 * fixed list do not exist here; the commands have them in the next files.
 */
type Item = {
  id: string;
  schedule_id: string;
  title: string;
  category: string;
  owner_kind: string;
  due_date: string;
  status: string;
  is_overdue: boolean;
  version: number;
  done_by_display_name: string | null;
  skipped_reason: string | null;
  skipped_by_display_name: string | null;
  can_mark_done: boolean;
  can_undo: boolean;
  can_skip: boolean;
  group_name?: string;
};
type Listing = {
  state: string;
  code: string | null;
  group: { id: string; name: string; status: string };
  schedules: {
    id: string;
    title: string;
    status: string;
    interval_count: number;
    version: number;
  }[];
  items: Item[];
  history: Item[];
  caller: { can_manage: boolean; can_mark: boolean };
};

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`recurring tables, registrations and reads in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      const { openDirectoryDatabase } = await import("./directory-support.ts");
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedRecurringWorld(db, schema);
    });

    const calls = recurringCalls(() => db, schema);
    const list = async (account: string, group: string = GROUP_1) =>
      (await calls.fn(account, "recurring_list_for_group($1)", [group])) as unknown as Listing;

    describe("the tables refuse what the rules forbid, attacked as the database owner (NFR7.3)", () => {
      const refused = async (sql: string, values: unknown[], code: string) => {
        const error = await failureOf(() => db.query(sql, values));
        assert.ok(error, `expected a refusal for: ${sql}`);
        assert.equal(error.code, code, error.message);
      };
      const scheduleInsert = (columns: string, marks: string, values: unknown[]) =>
        refused(
          `insert into recurring_schedules (organization_id, interval_count, start_date, ${columns}) values ($1, 1, '2026-09-07', ${marks})`,
          [ORGANIZATION, ...values],
          "23514",
        );

      it("refused: no owner, two owners, an owner of the wrong kind", async () => {
        await scheduleInsert("title, owner_kind", "'T', 'group'", []);
        await scheduleInsert(
          "title, owner_kind, working_group_id, family_id",
          "'T', 'group', $2, $3",
          [GROUP_1, FAMILY_1],
        );
        await scheduleInsert("title, owner_kind, working_group_id", "'T', 'family', $2", [GROUP_1]);
        await scheduleInsert(
          "title, owner_kind, family_id, rota_job",
          "'T', 'rota_week', $2, 'water_carrying'",
          [FAMILY_1],
        );
        await scheduleInsert(
          "title, owner_kind, working_group_id, rota_job",
          "'T', 'group', $2, 'water_carrying'",
          [GROUP_1],
        );
        await scheduleInsert("title, owner_kind", "'T', 'person'", []);
      });

      it("refused: published rota weeks on a group, a season with one month or backwards, a bad interval", async () => {
        await scheduleInsert(
          "title, owner_kind, working_group_id, interval_kind",
          "'T', 'group', $2, 'rota_weeks'",
          [GROUP_1],
        );
        await scheduleInsert(
          "title, owner_kind, working_group_id, season_from_month",
          "'T', 'group', $2, 4",
          [GROUP_1],
        );
        await scheduleInsert(
          "title, owner_kind, working_group_id, season_from_month, season_to_month",
          "'T', 'group', $2, 10, 4",
          [GROUP_1],
        );
        await scheduleInsert(
          "title, owner_kind, working_group_id, season_from_month, season_to_month",
          "'T', 'group', $2, 0, 4",
          [GROUP_1],
        );
        await refused(
          "insert into recurring_schedules (organization_id, title, owner_kind, working_group_id, interval_count, start_date) values ($1, 'T', 'group', $2, 0, '2026-09-07')",
          [ORGANIZATION, GROUP_1],
          "23514",
        );
        await refused(
          "insert into recurring_schedules (organization_id, title, owner_kind, working_group_id, interval_count, start_date) values ($1, 'T', 'group', $2, 53, '2026-09-07')",
          [ORGANIZATION, GROUP_1],
          "23514",
        );
      });

      it("refused: an empty or too long title and category; allowed: the limits themselves", async () => {
        await scheduleInsert("title, owner_kind, working_group_id", "'', 'group', $2", [GROUP_1]);
        await scheduleInsert("title, owner_kind, working_group_id", "$2, 'group', $3", [
          "x".repeat(201),
          GROUP_1,
        ]);
        await scheduleInsert(
          "title, category, owner_kind, working_group_id",
          "'T', '', 'group', $2",
          [GROUP_1],
        );
        await scheduleInsert(
          "title, category, owner_kind, working_group_id",
          "'T', $2, 'group', $3",
          ["x".repeat(101), GROUP_1],
        );
        await insertSchedule(db, {
          id: uuid(99700),
          group: GROUP_1,
          title: "x".repeat(200),
          category: "y".repeat(100),
        });
      });

      it("refused: a second occurrence of one schedule and due date", async () => {
        await insertSchedule(db, { id: SCHEDULE_G1, group: GROUP_1 });
        await insertOccurrence(db, { id: OCC(1), schedule: SCHEDULE_G1, due: "2027-01-11" });
        await refused(
          "insert into recurring_occurrences (organization_id, schedule_id, due_date) values ($1, $2, '2027-01-11')",
          [ORGANIZATION, SCHEDULE_G1],
          "23505",
        );
      });

      it("refused: states that do not fit, on both sides of the removed marker (D-REL-3)", async () => {
        await insertSchedule(db, { id: SCHEDULE_G1, group: GROUP_1 });
        // Open with a done mark or a skip reason.
        await refused(
          "insert into recurring_occurrences (organization_id, schedule_id, due_date, status, done_at) values ($1, $2, '2027-01-12', 'open', now())",
          [ORGANIZATION, SCHEDULE_G1],
          "23514",
        );
        await refused(
          "insert into recurring_occurrences (organization_id, schedule_id, due_date, skipped_reason) values ($1, $2, '2027-01-12', 'ok')",
          [ORGANIZATION, SCHEDULE_G1],
          "23514",
        );
        await refused(
          "insert into recurring_occurrences (organization_id, schedule_id, due_date, done_by_removed) values ($1, $2, '2027-01-12', true)",
          [ORGANIZATION, SCHEDULE_G1],
          "23514",
        );
        // Done with no person and no removed marker, with both, or with no time.
        await refused(
          "insert into recurring_occurrences (organization_id, schedule_id, due_date, status, done_at) values ($1, $2, '2027-01-12', 'done', now())",
          [ORGANIZATION, SCHEDULE_G1],
          "23514",
        );
        await refused(
          "insert into recurring_occurrences (organization_id, schedule_id, due_date, status, done_at, done_by_parent_id, done_by_removed) values ($1, $2, '2027-01-12', 'done', now(), $3, true)",
          [ORGANIZATION, SCHEDULE_G1, PARENT_ROW_F1],
          "23514",
        );
        await refused(
          "insert into recurring_occurrences (organization_id, schedule_id, due_date, status, done_by_parent_id) values ($1, $2, '2027-01-12', 'done', $3)",
          [ORGANIZATION, SCHEDULE_G1, PARENT_ROW_F1],
          "23514",
        );
        // A removed parent's done row is valid: no person, the marker, the time.
        await insertOccurrence(db, {
          id: OCC(2),
          schedule: SCHEDULE_G1,
          due: "2027-01-13",
          status: "done",
          doneByRemoved: true,
        });
        // Skipped with no reason, no time, no account, or a person and the removed marker together.
        await refused(
          "insert into recurring_occurrences (organization_id, schedule_id, due_date, status, skipped_at, skipped_by_account_id) values ($1, $2, '2027-01-12', 'skipped', now(), $3)",
          [ORGANIZATION, SCHEDULE_G1, SUPER_ADMIN],
          "23514",
        );
        await refused(
          "insert into recurring_occurrences (organization_id, schedule_id, due_date, status, skipped_reason, skipped_by_account_id) values ($1, $2, '2027-01-12', 'skipped', 'ok', $3)",
          [ORGANIZATION, SCHEDULE_G1, SUPER_ADMIN],
          "23514",
        );
        await refused(
          "insert into recurring_occurrences (organization_id, schedule_id, due_date, status, skipped_reason, skipped_at) values ($1, $2, '2027-01-12', 'skipped', 'ok', now())",
          [ORGANIZATION, SCHEDULE_G1],
          "23514",
        );
        await refused(
          "insert into recurring_occurrences (organization_id, schedule_id, due_date, status, skipped_reason, skipped_at, skipped_by_account_id, skipped_by_removed, skipped_by_parent_id) values ($1, $2, '2027-01-12', 'skipped', 'ok', now(), $3, true, $4)",
          [ORGANIZATION, SCHEDULE_G1, SUPER_ADMIN, PARENT_ROW_F1],
          "23514",
        );
        await refused(
          "insert into recurring_occurrences (organization_id, schedule_id, due_date, status, skipped_reason, skipped_at, skipped_by_account_id) values ($1, $2, '2027-01-12', 'skipped', $3, now(), $4)",
          [ORGANIZATION, SCHEDULE_G1, "x".repeat(201), SUPER_ADMIN],
          "23514",
        );
        // A done and a skipped state together.
        await refused(
          "insert into recurring_occurrences (organization_id, schedule_id, due_date, status, done_at, done_by_parent_id, skipped_reason, skipped_at, skipped_by_account_id) values ($1, $2, '2027-01-12', 'done', now(), $3, 'ok', now(), $4)",
          [ORGANIZATION, SCHEDULE_G1, PARENT_ROW_F1, SUPER_ADMIN],
          "23514",
        );
      });
    });

    describe("no signed-in role reads or writes the tables (NFR1.2)", () => {
      for (const role of ["authenticated", "anon", "service_role"] as const) {
        it(`refused: ${role} holds no right on either table`, async () => {
          for (const table of ["recurring_schedules", "recurring_occurrences"]) {
            for (const sql of [
              `select count(*) from ${table}`,
              `delete from ${table}`,
              `update ${table} set version = 99`,
            ]) {
              const error = await failureOf(() =>
                asActor(
                  db,
                  schema,
                  role === "authenticated" ? authenticated(PARENT_F1) : { role },
                  () => db.query(sql),
                ),
              );
              assert.ok(error, `${role}: ${sql}`);
              assert.equal(error.code, "42501", `${role}: ${sql}: ${error.message}`);
            }
          }
        });
      }
    });

    describe("recurring_list_for_group", () => {
      beforeEach(async () => {
        await insertSchedule(db, {
          id: SCHEDULE_G1,
          group: GROUP_1,
          title: "Nyúl etetés",
          category: "nyúl",
          interval: 2,
        });
        await insertSchedule(db, {
          id: SCHEDULE_G2,
          group: GROUP_2,
          title: "Másik csoport munkája",
        });
      });

      it("allowed: returns the group, its schedules and the occurrences with the exact fields", async () => {
        await insertOccurrence(db, {
          id: OCC(1),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, 3),
        });
        await insertOccurrence(db, {
          id: OCC(2),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, -2),
        });
        await insertOccurrence(db, {
          id: OCC(3),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, -5),
          status: "done",
          doneBy: PARENT_ROW_F1,
        });
        await insertOccurrence(db, {
          id: OCC(4),
          schedule: SCHEDULE_G2,
          due: await dayOffset(db, 1),
        });
        const result = await list(PARENT_F1);
        assert.equal(result.state, "success");
        assert.deepEqual(result.group, { id: GROUP_1, name: "Boróka", status: "active" });
        assert.deepEqual(
          result.schedules.map((s) => [s.id, s.title, s.status, s.interval_count]),
          [[SCHEDULE_G1, "Nyúl etetés", "active", 2]],
        );
        assert.deepEqual(
          result.items.map((i) => [i.id, i.status, i.is_overdue]),
          [
            [OCC(3), "done", false],
            [OCC(2), "open", true],
            [OCC(1), "open", false],
          ],
        );
        const done = result.items[0]!;
        assert.deepEqual(Object.keys(done).sort(), [
          "can_mark_done",
          "can_skip",
          "can_undo",
          "category",
          "done_at",
          "done_by_display_name",
          "due_date",
          "id",
          "is_overdue",
          "owner_kind",
          "schedule_id",
          "skipped_by_display_name",
          "skipped_reason",
          "status",
          "title",
          "version",
          "working_group_id",
        ]);
        assert.equal(done.done_by_display_name, "Fenyő Anna");
        assert.equal(done.title, "Nyúl etetés");
        assert.equal(done.category, "nyúl");
        assert.deepEqual(result.caller, { can_manage: false, can_mark: true });
        assert.deepEqual(result.history, []);
      });

      it("shows what the caller may do: a member marks, a coordinator manages, a teacher and a super admin do not mark", async () => {
        await insertOccurrence(db, {
          id: OCC(1),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, 1),
        });
        const flags = async (account: string) => {
          const result = await list(account);
          assert.equal(result.state, "success", account);
          const item = result.items[0]!;
          return [
            item.can_mark_done,
            item.can_skip,
            result.caller.can_manage,
            result.caller.can_mark,
          ];
        };
        assert.deepEqual(await flags(PARENT_F1), [true, false, false, true]);
        assert.deepEqual(await flags(ADMIN_G1), [true, true, true, true]);
        assert.deepEqual(await flags(TEACHER_G1), [false, false, false, false]);
        // A super admin who is not a member can skip and manage but not mark done (D-SEC-1).
        assert.deepEqual(await flags(SUPER_ADMIN), [false, true, true, false]);
        // A parent of the other group reads the page and sees no control (a parent who is not a member).
        assert.deepEqual(await flags(PARENT_F2), [false, false, false, false]);
      });

      it("keeps open occurrences up to 60 days overdue in the current list and moves older ones to the history (BR146.3)", async () => {
        await insertOccurrence(db, {
          id: OCC(1),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, -60),
        });
        await insertOccurrence(db, {
          id: OCC(2),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, -61),
        });
        await insertOccurrence(db, {
          id: OCC(3),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, -14),
          status: "done",
          doneBy: PARENT_ROW_F1,
        });
        await insertOccurrence(db, {
          id: OCC(4),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, -15),
          status: "done",
          doneBy: PARENT_ROW_F1,
        });
        await insertOccurrence(db, {
          id: OCC(5),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, 14),
        });
        const result = await list(PARENT_F1);
        assert.deepEqual(
          result.items.map((i) => i.id),
          [OCC(1), OCC(3), OCC(5)],
        );
        assert.deepEqual(
          result.history.map((i) => i.id),
          [OCC(4), OCC(2)],
        );
      });

      it("shows a removed person as korábbi tag, by the family and by the marker (D-REL-3)", async () => {
        await insertOccurrence(db, {
          id: OCC(1),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, -1),
          status: "done",
          doneBy: PARENT_ROW_GONE,
        });
        await insertOccurrence(db, {
          id: OCC(2),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, -2),
          status: "done",
          doneByRemoved: true,
        });
        await insertOccurrence(db, {
          id: OCC(3),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, -3),
          status: "skipped",
          skippedByRemoved: true,
        });
        await insertOccurrence(db, {
          id: OCC(4),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, -4),
          status: "skipped",
          skippedBy: PARENT_ROW_F2,
        });
        await insertOccurrence(db, {
          id: OCC(5),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, -5),
          status: "skipped",
        });
        const byId = new Map((await list(PARENT_F1)).items.map((i) => [i.id, i]));
        assert.equal(byId.get(OCC(1))!.done_by_display_name, "korábbi tag");
        assert.equal(byId.get(OCC(2))!.done_by_display_name, "korábbi tag");
        assert.equal(byId.get(OCC(3))!.skipped_by_display_name, "korábbi tag");
        assert.equal(byId.get(OCC(4))!.skipped_by_display_name, "Napraforgó Csilla");
        assert.equal(byId.get(OCC(5))!.skipped_by_display_name, "adminisztrátor");
        assert.equal(byId.get(OCC(5))!.skipped_reason, "Kihagyva a próbához.");
      });

      it("allowed: an empty list is a success only after the reach check passed", async () => {
        const empty = await list(PARENT_F1, GROUP_2);
        assert.equal(empty.state, "success");
        assert.deepEqual(empty.items, []);
        assert.equal((await list(PARENT_F1, GROUP_OTHER)).state, "denied");
      });

      it("refused: no session, no grant, a deactivated account, an admin of another community", async () => {
        for (const account of [SIGNED_OUT, OUTSIDER, DEACTIVATED, OTHER_ADMIN]) {
          const result = await list(account);
          assert.equal(result.state, "denied", account);
          assert.ok(!("items" in result), account);
        }
      });

      it("out of reach: an unknown group and a group of another community are the same denied refusal", async () => {
        const unknown = await list(PARENT_F1, uuid(99999));
        const other = await list(PARENT_F1, GROUP_OTHER);
        assert.deepEqual([unknown.state, unknown.code], ["denied", "authorization_denied"]);
        assert.deepEqual([other.state, other.code], ["denied", "authorization_denied"]);
      });

      it("shows the schedules of an archived group and the switched-off ones", async () => {
        await insertSchedule(db, {
          id: uuid(99701),
          group: GROUP_1,
          title: "Kikapcsolt",
          active: false,
        });
        const result = await list(PARENT_F1);
        assert.deepEqual(result.schedules.map((s) => [s.title, s.status]).sort(), [
          ["Kikapcsolt", "switched_off"],
          ["Nyúl etetés", "active"],
        ]);
      });
    });

    describe("recurring_occurrence_get", () => {
      beforeEach(async () => {
        await insertSchedule(db, { id: SCHEDULE_G1, group: GROUP_1 });
        await insertSchedule(db, {
          id: SCHEDULE_F1,
          kind: "family",
          family: FAMILY_1,
          title: "Családi feladat",
        });
        await insertOccurrence(db, {
          id: OCC(1),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, 2),
        });
        await insertOccurrence(db, {
          id: OCC(2),
          schedule: SCHEDULE_F1,
          due: await dayOffset(db, 2),
        });
      });
      const get = (account: string, id: string) =>
        calls.fn(account, "recurring_occurrence_get($1)", [id]) as unknown as Promise<
          Record<string, unknown> & { item: Item; schedule: { id: string } }
        >;

      it("allowed: a group duty is read by every signed-in reader, a family duty by its family and super admins", async () => {
        for (const account of [PARENT_F1, PARENT_F2, TEACHER_G1, ADMIN_G1, SUPER_ADMIN]) {
          const result = await get(account, OCC(1));
          assert.equal(result.state, "success", account);
          assert.equal(result.item.id, OCC(1));
          assert.equal(result.schedule.id, SCHEDULE_G1);
        }
        for (const account of [PARENT_F1, CO_PARENT_F1, SUPER_ADMIN]) {
          const result = await get(account, OCC(2));
          assert.equal(result.state, "success", account);
          assert.equal(result.item.can_mark_done, account !== SUPER_ADMIN);
        }
      });

      it("refused: a family duty answers a parent of another family, a coordinator and a teacher as denied", async () => {
        for (const account of [PARENT_F2, ADMIN_G1, TEACHER_G1, PARENT_NG]) {
          const result = await get(account, OCC(2));
          assert.deepEqual(
            [result.state, result.code],
            ["denied", "authorization_denied"],
            account,
          );
        }
      });

      it("out of reach: a made-up id and a real id out of reach give the same refusal, and nothing else about the duty", async () => {
        const real = await get(PARENT_F2, OCC(2));
        const fake = await get(PARENT_F2, uuid(99998));
        assert.deepEqual(real, fake);
        assert.deepEqual(
          [
            (await get(SIGNED_OUT, OCC(1))).state,
            (await get(OUTSIDER, OCC(1))).state,
            (await get(OTHER_ADMIN, OCC(1))).state,
          ],
          ["denied", "denied", "denied"],
        );
      });
    });

    describe("recurring_my_occurrences", () => {
      it("allowed: the family's duties and the duties of the caller's groups, with nothing of other families", async () => {
        await insertSchedule(db, { id: SCHEDULE_G1, group: GROUP_1, title: "Csoport feladat" });
        await insertSchedule(db, { id: SCHEDULE_G2, group: GROUP_2, title: "Másik csoport" });
        await insertSchedule(db, {
          id: SCHEDULE_F1,
          kind: "family",
          family: FAMILY_1,
          title: "Családi",
        });
        await insertSchedule(db, {
          id: uuid(99006),
          kind: "family",
          family: FAMILY_GONE,
          title: "Más család",
        });
        const due = await dayOffset(db, 2);
        await insertOccurrence(db, { id: OCC(1), schedule: SCHEDULE_G1, due });
        await insertOccurrence(db, { id: OCC(2), schedule: SCHEDULE_G2, due });
        await insertOccurrence(db, { id: OCC(3), schedule: SCHEDULE_F1, due });
        await insertOccurrence(db, { id: uuid(99107), schedule: uuid(99006), due });
        const result = (await calls.fn(PARENT_F1, "recurring_my_occurrences()")) as unknown as {
          state: string;
          items: Item[];
        };
        assert.equal(result.state, "success");
        assert.deepEqual(result.items.map((i) => i.title).sort(), ["Családi", "Csoport feladat"]);
        assert.equal(result.items.find((i) => i.title === "Csoport feladat")!.group_name, "Boróka");
        assert.ok(result.items.every((i) => i.can_mark_done));
        const coordinator = (await calls.fn(ADMIN_G1, "recurring_my_occurrences()")) as unknown as {
          items: Item[];
        };
        assert.deepEqual(
          coordinator.items.map((i) => [i.title, i.can_skip]),
          [["Csoport feladat", true]],
        );
      });

      it("refused: a teacher, a super admin with no parent record, no session and no grant are denied, not given an empty list", async () => {
        for (const account of [TEACHER_G1, SUPER_ADMIN, SIGNED_OUT, OUTSIDER, DEACTIVATED]) {
          const result = await calls.fn(account, "recurring_my_occurrences()");
          assert.equal(result.state, "denied", account);
          assert.ok(!("items" in result), account);
        }
      });
    });

    describe("recurring_schedule_get and recurring_list_admin", () => {
      it("allowed and refused: a group schedule for every reader, a family schedule for super admins only; the admin list for super admins", async () => {
        await insertSchedule(db, { id: SCHEDULE_G1, group: GROUP_1 });
        await insertSchedule(db, {
          id: SCHEDULE_F1,
          kind: "family",
          family: FAMILY_1,
          title: "Családi",
        });
        await insertSchedule(db, {
          id: uuid(99008),
          kind: "rota_week",
          job: "water_carrying",
          interval: 4,
          title: "Palackok tisztítása",
        });
        const get = (account: string, id: string) =>
          calls.fn(account, "recurring_schedule_get($1)", [id]) as unknown as Promise<
            Record<string, unknown> & {
              schedule: { id: string; owner_kind: string };
              caller: { can_manage: boolean };
            }
          >;
        const group = await get(TEACHER_G1, SCHEDULE_G1);
        assert.equal(group.state, "success");
        assert.equal(group.caller.can_manage, false);
        assert.equal((await get(ADMIN_G1, SCHEDULE_G1)).caller.can_manage, true);
        assert.equal((await get(SUPER_ADMIN, SCHEDULE_F1)).state, "success");
        for (const account of [PARENT_F1, ADMIN_G1, TEACHER_G1, OTHER_ADMIN]) {
          const result = await get(account, SCHEDULE_F1);
          assert.deepEqual(
            [result.state, result.code],
            ["denied", "authorization_denied"],
            account,
          );
        }
        assert.equal((await get(PARENT_F1, uuid(99996))).state, "denied");
        const all = (await calls.fn(SUPER_ADMIN, "recurring_list_admin()")) as unknown as {
          state: string;
          items: { title: string; owner_kind: string; family_display_name: string | null }[];
        };
        assert.equal(all.state, "success");
        assert.deepEqual(all.items.map((i) => [i.title, i.owner_kind]).sort(), [
          ["Családi", "family"],
          ["Palackok tisztítása", "rota_week"],
        ]);
        assert.equal(
          all.items.find((i) => i.owner_kind === "family")!.family_display_name,
          "Fenyő család",
        );
        for (const account of [PARENT_F1, ADMIN_G1, TEACHER_G1, SIGNED_OUT]) {
          assert.equal(
            (await calls.fn(account, "recurring_list_admin()")).state,
            "denied",
            account,
          );
        }
        // The super admin of the other community reads only that community's schedules: none.
        const other = (await calls.fn(OTHER_ADMIN, "recurring_list_admin()")) as unknown as {
          state: string;
          items: unknown[];
        };
        assert.deepEqual([other.state, other.items], ["success", []]);
      });
    });

    describe("the registrations (C8, C9)", () => {
      it("registers the two notice kinds, the target type and the daily check as the last daily check, active", async () => {
        const kinds = await db.query(
          "select kind, target_type, title_prefix from notice_kinds where kind like 'recurring%' order by kind",
        );
        assert.deepEqual(kinds.rows, [
          { kind: "recurring_due", target_type: "recurring_duty", title_prefix: "Esedékes:" },
          { kind: "recurring_overdue", target_type: "recurring_duty", title_prefix: "Lejárt:" },
        ]);
        const target = await db.query(
          "select facts_function from notice_targets where target_type = 'recurring_duty'",
        );
        assert.equal(target.rows[0].facts_function, "recurring_notice_facts");
        const row = (
          await db.query("select * from timed_check_registry where check_name = 'recurring_duties'")
        ).rows[0];
        assert.deepEqual(
          [row.function_name, row.run_kind, row.is_active, row.lock_step],
          ["recurring_due_check", "daily", true, 4],
        );
      });

      it("accepts the six audit actions of the unit and every earlier one", async () => {
        const definition = (
          await db.query(
            "select pg_get_constraintdef(oid) as d from pg_constraint where conname = 'audit_events_action_check'",
          )
        ).rows[0].d as string;
        for (const action of [
          "recurring_schedule_saved",
          "recurring_schedule_set_active",
          "recurring_occurrence_done",
          "recurring_occurrence_undone",
          "recurring_occurrence_skipped",
          "recurring_removal_applied",
          "library_removal_applied",
          "swap.reversed",
          "role.grant",
        ]) {
          assert.ok(definition.includes(`'${action}'`), action);
        }
      });

      it("gives a notice about an occurrence only the title, the due date and a path (BR149.2, NFR10.1)", async () => {
        await insertSchedule(db, { id: SCHEDULE_G1, group: GROUP_1, title: "Nyúl etetés" });
        await insertOccurrence(db, {
          id: OCC(1),
          schedule: SCHEDULE_G1,
          due: "2027-03-01",
          status: "done",
          doneBy: PARENT_ROW_F1,
        });
        const facts = (
          await db.query("select * from recurring_notice_facts($1, $2, 'recurring_due')", [
            OCC(1),
            PARENT_ROW_F1,
          ])
        ).rows[0];
        assert.deepEqual(Object.keys(facts), [
          "item_name",
          "item_date",
          "path",
          "full_title",
          "detail",
        ]);
        assert.equal(facts.item_name, "Nyúl etetés");
        assert.equal(facts.path, `/szulo/munkacsoportok/${GROUP_1}/ismetlodo`);
        assert.ok(!JSON.stringify(facts).includes("Fenyő"), "no name of the person who marked it");
        assert.equal(facts.detail, "Esedékes: 2027. 03. 01.");
        const family = await insertSchedule(db, {
          id: SCHEDULE_F1,
          kind: "family",
          family: FAMILY_1,
        });
        await insertOccurrence(db, { id: OCC(2), schedule: family, due: "2027-03-01" });
        assert.equal(
          (
            await db.query("select path from recurring_notice_facts($1, $2, 'recurring_overdue')", [
              OCC(2),
              PARENT_ROW_F1,
            ])
          ).rows[0].path,
          "/szulo/ismetlodo",
        );
        assert.equal(
          (
            await db.query("select * from recurring_notice_facts($1, $2, 'recurring_due')", [
              uuid(99997),
              PARENT_ROW_F1,
            ])
          ).rowCount,
          0,
        );
      });

      it("leaves the tables empty on a fresh world", async () => {
        assert.equal(await count(db, "recurring_schedules"), 0);
        assert.equal(await count(db, "recurring_occurrences"), 0);
      });
    });
  });
}

/**
 * The migration over seeded data (NFR7.9): a private schema is built up to the file before this one and filled with
 * rows of the tables the unit leaves alone. The change keeps every existing row, adds two empty tables, the registry rows
 * and the audit values, and a forced failure leaves the old shape. All names are invented.
 */
describe("recurring migration over seeded data", () => {
  const schema = "u9_recurring_migration";
  const CHANGE = "20261064_recurring_duties.sql";
  const all = readMigrationFiles(`${root}supabase/migrations`);
  const change = all.find((file) => file.name === CHANGE)!;
  const earlier = all.filter((file) => file.name < CHANGE);
  let db: pg.Client;

  const apply = (files: typeof all) =>
    applyMigrations({
      client: db as never,
      schema,
      files,
      log: () => {},
      now: () => Date.now(),
      freshSchemaSettings: FRESH_SCHEMA_SETTINGS,
    });
  const dropSchema = async () => {
    await db.query("reset search_path");
    await db.query(`drop schema if exists ${schema} cascade`);
    await db.query(`delete from ${TRACKING_SCHEMA}.applied_migrations where schema_name = $1`, [
      schema,
    ]);
  };
  const tableCounts = async (): Promise<Record<string, number>> => {
    const tables = (
      await db.query(
        "select table_name from information_schema.tables where table_schema = $1 and table_type = 'BASE TABLE'",
        [schema],
      )
    ).rows.map((row) => row.table_name as string);
    const counts: Record<string, number> = {};
    for (const table of tables) {
      counts[table] = Number(
        (await db.query(`select count(*) as n from "${schema}"."${table}"`)).rows[0].n,
      );
    }
    return counts;
  };

  before(async () => {
    db = await openDatabase();
    await dropSchema();
    await db.query(`create schema ${schema}`);
  });
  after(async () => {
    await dropSchema();
    await db.end();
  });

  it("a forced failure leaves the old shape and every seeded row", async () => {
    await apply(earlier);
    await db.query(`set search_path to ${schema}, pg_catalog`);
    await db.query("insert into organizations (id, name) values ($1, 'Régi iskola')", [
      ORGANIZATION,
    ]);
    await db.query(
      "insert into families (id, organization_id, display_name) values ($1, $2, 'Régi család')",
      [uuid(80001), ORGANIZATION],
    );
    await db.query(
      "insert into parents (id, organization_id, family_id, display_name) values ($1, $2, $3, 'Régi Szülő')",
      [uuid(80002), ORGANIZATION, uuid(80001)],
    );
    await db.query(
      "insert into events (id, organization_id, title, starts_at, ends_at) values ($1, $2, 'Régi ünnep', '2027-01-10T10:00:00Z', '2027-01-10T12:00:00Z')",
      [uuid(80003), ORGANIZATION],
    );
    await assert.rejects(
      apply([{ ...change, sql: change.sql.replace(/commit;\s*$/, "select 1 / 0;\ncommit;\n") }]),
    );
    await db.query("rollback").catch(() => undefined);
    await db.query(`set search_path to ${schema}, pg_catalog`);
    const tables = await db.query(
      "select table_name from information_schema.tables where table_schema = $1 and table_name in ('recurring_schedules', 'recurring_occurrences')",
      [schema],
    );
    assert.equal(tables.rowCount, 0);
    assert.equal(await count(db, "events"), 1);
    assert.equal(await count(db, "notice_kinds", "kind like 'recurring%'"), 0);
    const column = await db.query(
      "select 1 from information_schema.columns where table_schema = $1 and table_name = 'timed_check_runs' and column_name = 'detail'",
      [schema],
    );
    assert.equal(column.rowCount, 0);
    await db.query(
      `delete from ${TRACKING_SCHEMA}.applied_migrations where schema_name = $1 and filename = $2`,
      [schema, CHANGE],
    );
  });

  it("keeps every existing business row, adds the registry rows and two empty tables (NFR7.9)", async () => {
    await db.query(`set search_path to ${schema}, pg_catalog`);
    const before = await tableCounts();
    const result = await apply([...earlier, change]);
    assert.deepEqual(result.applied, [CHANGE]);
    await db.query(`set search_path to ${schema}, pg_catalog`);
    const after = await tableCounts();
    // The registry additions are asserted on their own; every other table that existed keeps its rows.
    const registry: Record<string, number> = {
      notice_targets: 1,
      notice_kinds: 2,
      timed_check_registry: 1,
    };
    const business = Object.keys(before).filter((table) => !(table in registry));
    for (const table of business) {
      assert.equal(after[table], before[table], table);
    }
    for (const [table, added] of Object.entries(registry)) {
      assert.equal(after[table], before[table]! + added, table);
    }
    for (const table of ["recurring_schedules", "recurring_occurrences"]) {
      assert.equal(after[table], 0, table);
    }
    for (const table of ["events", "parents", "families", "organizations"]) {
      assert.equal(after[table], 1, table);
    }
  });

  it("adds the optional detail column to the check record and keeps the run function granted to the service role only", async () => {
    await db.query(`set search_path to ${schema}, pg_catalog`);
    const column = await db.query(
      "select 1 from information_schema.columns where table_schema = $1 and table_name = 'timed_check_runs' and column_name = 'detail' and is_nullable = 'YES'",
      [schema],
    );
    assert.equal(column.rowCount, 1);
    const grants = await db.query(
      `select r.rolname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        cross join pg_roles r
       where n.nspname = $1 and p.proname = 'timed_checks_run_system'
         and has_function_privilege(r.oid, p.oid, 'execute') and r.rolname in ('anon', 'authenticated', 'service_role')
       order by 1`,
      [schema],
    );
    assert.deepEqual(
      grants.rows.map((row) => row.rolname),
      ["service_role"],
    );
  });

  it("is applied once: a second run applies nothing", async () => {
    const again = await apply([...earlier, change]);
    assert.deepEqual(again.applied, []);
  });
});
