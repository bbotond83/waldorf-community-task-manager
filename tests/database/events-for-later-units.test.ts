import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  DIRECTORY_SCHEMAS,
  openDirectoryDatabase,
  TASK_1,
  TEACHER_G1,
  EVENT_1,
} from "./directory-support.ts";
import { caller, COMMUNITY_EVENT, GROUP_EVENT, seedEventWorld } from "./events-support.ts";
import { asActor, failureOf } from "./identity-support.ts";
import {
  GROUP_1,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_ADMIN_G1,
  PARENT_ROW_F1,
  SUPER_ADMIN,
} from "./working-groups-support.ts";

/**
 * The facts U10 gives later units (C13, C8, C14) and the two functions it redefined for them: the summer flag, the
 * deadline, the organisers, the notice facts, the teacher schedule's coordination name and the duty detail's notices.
 * Reads and internal facts: no stale screen, no repeated click, no race to lose.
 */
type Result = Awaited<ReturnType<ReturnType<typeof caller>>>;

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`event facts for later units in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(() => seedEventWorld(db, schema));

    const call = caller(() => db, schema);
    const one = async (sql: string, values: unknown[] = []) =>
      (await db.query(sql, values)).rows[0] as Record<string, unknown>;

    it("allowed: the summer flag and the deadline come back as stored; an unknown event gives null", async () => {
      await db.query(
        "update events set is_summer = true, signup_deadline = (starts_at at time zone 'Europe/Budapest')::date where id = $1",
        [COMMUNITY_EVENT],
      );
      const row = await one(
        "select event_is_summer($1) as summer, event_deadline($1)::text as deadline, event_is_summer($2) as unknown_summer",
        [COMMUNITY_EVENT, "99999999-0000-4000-8000-000000000008"],
      );
      assert.equal(row.summer, true);
      assert.match(String(row.deadline), /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(row.unknown_summer, null);
    });

    it("allowed: the organisers of a group event are its coordinators plus parents marked on a role, without duplicates; empty for an unknown event", async () => {
      await db.query(
        "insert into event_roles (organization_id, event_id, name, parent_id, is_organiser) select organization_id, $1, 'Szervező', $2, true from events where id = $1",
        [GROUP_EVENT, PARENT_ROW_F1],
      );
      await db.query(
        "insert into event_roles (organization_id, event_id, name, parent_id, is_organiser) select organization_id, $1, 'Koordinátor is', $2, true from events where id = $1",
        [GROUP_EVENT, PARENT_ROW_ADMIN_G1],
      );
      const organisers = (await one("select event_organisers($1) as ids", [GROUP_EVENT]))
        .ids as string[];
      assert.deepEqual([...organisers].sort(), [PARENT_ROW_ADMIN_G1, PARENT_ROW_F1].sort());
      assert.deepEqual(
        (await one("select event_organisers($1) as ids", ["99999999-0000-4000-8000-000000000009"]))
          .ids,
        [],
      );
    });

    it("allowed: an unmarked role makes nobody an organiser", async () => {
      await db.query(
        "insert into event_roles (organization_id, event_id, name, parent_id, is_organiser) select organization_id, $1, 'Segítő', $2, false from events where id = $1",
        [COMMUNITY_EVENT, PARENT_ROW_F1],
      );
      const organisers = (await one("select event_organisers($1) as ids", [COMMUNITY_EVENT]))
        .ids as string[];
      assert.equal(organisers.includes(PARENT_ROW_F1), false);
    });

    it("the notice facts name the event, its dates and place and the path of its page, and never a person", async () => {
      await db.query(
        "insert into event_signups (organization_id, event_id, parent_id, family_id, note) select organization_id, $1, $2, family_id, 'titkos jegyzet' from parents where id = $2",
        [COMMUNITY_EVENT, PARENT_ROW_F1],
      );
      const facts = await one("select * from notice_facts_event($1, $2, 'event_new')", [
        COMMUNITY_EVENT,
        PARENT_ROW_F1,
      ]);
      assert.equal(facts.item_name, "Közös ünnep");
      assert.equal(facts.path, `/szulo/esemenyek/${COMMUNITY_EVENT}`);
      assert.equal(JSON.stringify(facts).includes("titkos"), false);
      const none = await db.query("select * from notice_facts_event($1, $2, 'event_new')", [
        "99999999-0000-4000-8000-00000000000a",
        PARENT_ROW_F1,
      ]);
      assert.equal(none.rowCount, 0);
    });

    it("the registries hold the event target and the three kinds", async () => {
      const kinds = (
        await db.query("select kind from notice_kinds where target_type = 'event' order by kind")
      ).rows.map((row) => row.kind);
      assert.deepEqual(kinds, ["event_cancelled", "event_changed", "event_new"]);
      assert.equal(
        (await db.query("select 1 from notice_targets where target_type = 'event'")).rowCount,
        1,
      );
    });

    it("the teacher schedule shows the event's oldest role as the coordination name; without a role it shows none", async () => {
      const schedule = async () =>
        (await call(TEACHER_G1, "schedule_get('group', $1, null, null)", [GROUP_1])) as Result & {
          items: { id: string; coordination_display_name: string | null }[];
        };
      const before = (await schedule()).items.find((item) => item.id === TASK_1);
      assert.equal(before?.coordination_display_name ?? null, null);
      await db.query(
        "insert into event_roles (organization_id, event_id, name, person_name) select organization_id, id, 'Első szerep', 'Vendég' from events where id = $1",
        [EVENT_1],
      );
      await db.query(
        "insert into event_roles (organization_id, event_id, name, person_name) select organization_id, id, 'Második szerep', 'Másik' from events where id = $1",
        [EVENT_1],
      );
      const after = (await schedule()).items.find((item) => item.id === TASK_1);
      assert.equal(after?.coordination_display_name, "Első szerep");
    });

    it("the duty detail shows the event notices to the family with a place and to a manager, to nobody else", async () => {
      await db.query(
        "insert into event_notices (organization_id, event_id, position, text) select organization_id, id, 1, 'Hozz kesztyűt' from events where id = $1",
        [EVENT_1],
      );
      const own = (await call(PARENT_F1, "duty_get($1)", [TASK_1])) as Result & {
        item: { event_notices?: string[] | null };
      };
      assert.deepEqual(own.item.event_notices, ["Hozz kesztyűt"]);
      const stranger = (await call(PARENT_F2, "duty_get($1)", [TASK_1])) as typeof own;
      assert.equal(stranger.item.event_notices ?? null, null);
      assert.equal(JSON.stringify(stranger).includes("kesztyű"), false);
    });

    it("out of reach: no signed-in role can execute the facts functions, the helpers or the removal pair", async () => {
      const internal = [
        "event_is_summer($1)",
        "event_deadline($1)",
        "event_organisers($1)",
        "events_removal_preview('parent', $1)",
        "events_removal_apply('parent', $1)",
        "event_lock_managed($1, $1)",
        "event_lock_for_parent($1, $1)",
        "notice_facts_event($1, $1, 'event_new')",
      ];
      for (const role of ["authenticated", "anon", "service_role"] as const) {
        for (const sql of internal) {
          const error = await failureOf(() =>
            asActor(db, schema, { role, account: role === "anon" ? undefined : SUPER_ADMIN }, () =>
              db.query(`select ${sql}`, [COMMUNITY_EVENT]),
            ),
          );
          assert.ok(
            error?.code === "42501" || error?.code === "42883",
            `${role} ${sql}: ${error?.code ?? "allowed"}`,
          );
        }
      }
    });
  });
}
