import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  DIRECTORY_SCHEMAS,
  nextKey,
  openDirectoryDatabase,
  PARENT_F1,
  PARENT_F2,
  SUPER_ADMIN,
} from "./directory-support.ts";
import { count } from "./identity-support.ts";
import { FAMILY_1, FAMILY_2, FAMILY_NO_GROUP, seedRotaWorld } from "./rota-full-support.ts";
import {
  pickCommand,
  pickInvariantProblems,
  publishedWeekend,
  slotOf,
  type WeekendWorld,
} from "./weekend-picks-support.ts";
import { openDatabase, useSchema } from "./stack-support.ts";

/**
 * The race tests of the weekend picks (BR63.7): two families on one slot, a pick against an assignment, a pick against
 * the other family's change, the time boundaries in a normal week and in the week the clocks change in spring, and a
 * right revoked between two requests. After each case the pick-and-place rule is checked with a query.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`weekend pick races in ${schema}`, () => {
    let db: pg.Client;
    let second: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      second = await openDatabase();
      await useSchema(second, schema);
    });
    after(async () => {
      await second.end();
      await db.end();
    });
    beforeEach(() => seedRotaWorld(db, schema));

    const world = (options?: Parameters<typeof publishedWeekend>[2]) =>
      publishedWeekend(db, schema, options);
    const slot = (w: WeekendWorld, name: string) => slotOf(db, w, name);
    const noProblems = async () => assert.deepEqual(await pickInvariantProblems(db), []);
    const viaSecond = (
      account: string,
      weekId: string,
      name: string,
      version: number,
      command: "weekend_pick_set" | "weekend_pick_assign" = "weekend_pick_set",
    ) => pickCommand(second, schema, account, weekId, name, version, nextKey("pick"), command);
    const viaFirst = (
      account: string,
      weekId: string,
      name: string,
      version: number,
      command: "weekend_pick_set" | "weekend_pick_assign" = "weekend_pick_set",
    ) => pickCommand(db, schema, account, weekId, name, version, nextKey("pick"), command);

    it("BR63.7 two families on one slot: one gets it, the other is told it is taken", async () => {
      const w = await world();
      const version = (await slot(w, "sunday_opening")).place_version;
      const [a, b] = await Promise.all([
        viaFirst(PARENT_F1, w.indoor.id, "sunday_opening", version),
        viaSecond(PARENT_F2, w.front.id, "sunday_opening", version),
      ]);
      assert.deepEqual([a.state, b.state].sort(), ["conflict", "success"], JSON.stringify([a, b]));
      assert.equal([a, b].find((r) => r.state === "conflict")?.code, "WEEKEND_SLOT_TAKEN");
      assert.equal(await count(db, "weekend_picks"), 1);
      const held = (await slot(w, "sunday_opening")).family_id;
      assert.equal(held, a.state === "success" ? FAMILY_1 : FAMILY_2);
      await noProblems();
    });

    it("BR63.7 the same family twice at once on two slots: one pick, the last writer wins, nothing is left over", async () => {
      const w = await world();
      const [x, y] = await Promise.all([
        viaFirst(
          PARENT_F1,
          w.indoor.id,
          "saturday_opening",
          (await slot(w, "saturday_opening")).place_version,
        ),
        viaSecond(
          PARENT_F1,
          w.indoor.id,
          "saturday_closing",
          (await slot(w, "saturday_closing")).place_version,
        ),
      ]);
      assert.equal(x.state === "success" || y.state === "success", true, JSON.stringify([x, y]));
      assert.equal(await count(db, "weekend_picks", `rota_week_id = '${w.indoor.id}'`), 1);
      const holders = [await slot(w, "saturday_opening"), await slot(w, "saturday_closing")].filter(
        (row) => row.family_id === FAMILY_1,
      );
      assert.equal(holders.length, 1);
      await noProblems();
    });

    it("BR63.7 a pick against an assignment of the same slot: one gets it, the other is told it is taken", async () => {
      const w = await world();
      const version = (await slot(w, "sunday_closing")).place_version;
      const [pick, assign] = await Promise.all([
        viaFirst(PARENT_F1, w.indoor.id, "sunday_closing", version),
        viaSecond(SUPER_ADMIN, w.front.id, "sunday_closing", version, "weekend_pick_assign"),
      ]);
      assert.deepEqual(
        [pick.state, assign.state].sort(),
        ["conflict", "success"],
        JSON.stringify([pick, assign]),
      );
      assert.equal(await count(db, "weekend_picks"), 1);
      await noProblems();
    });

    it("BR63.7 a pick against an assignment for the same family: both end in one pick", async () => {
      const w = await world();
      const [pick, assign] = await Promise.all([
        viaFirst(
          PARENT_F1,
          w.indoor.id,
          "saturday_opening",
          (await slot(w, "saturday_opening")).place_version,
        ),
        viaSecond(
          SUPER_ADMIN,
          w.indoor.id,
          "sunday_opening",
          (await slot(w, "sunday_opening")).place_version,
          "weekend_pick_assign",
        ),
      ]);
      assert.equal(
        pick.state === "success" || assign.state === "success",
        true,
        JSON.stringify([pick, assign]),
      );
      assert.equal(await count(db, "weekend_picks", `rota_week_id = '${w.indoor.id}'`), 1);
      await noProblems();
    });

    it("BR63.7 a pick against the other family's change: the slot is never held twice", async () => {
      const w = await world();
      assert.equal(
        (
          await viaFirst(
            PARENT_F2,
            w.front.id,
            "saturday_opening",
            (await slot(w, "saturday_opening")).place_version,
          )
        ).state,
        "success",
      );
      const target = (await slot(w, "sunday_opening")).place_version;
      const [change, pick] = await Promise.all([
        viaFirst(PARENT_F2, w.front.id, "sunday_opening", target),
        viaSecond(PARENT_F1, w.indoor.id, "sunday_opening", target),
      ]);
      assert.deepEqual(
        [change.state, pick.state].sort(),
        ["conflict", "success"],
        JSON.stringify([change, pick]),
      );
      const rows = await db.query(
        "select count(*)::int as n from assignments a join tasks t on t.id = a.task_id join weekend_slots s on s.id = t.origin_id where t.origin_kind = 'weekend_slot' and s.slot = 'sunday_opening' and s.weekend_week_id = $1 and a.status <> 'removed'",
        [w.weekend.id],
      );
      assert.equal(rows.rows[0].n, 1);
      await noProblems();
    });

    it("BR63.7 the loser can read the new state and pick again", async () => {
      const w = await world();
      const version = (await slot(w, "saturday_closing")).place_version;
      await viaFirst(PARENT_F1, w.indoor.id, "saturday_closing", version);
      const lost = await viaSecond(PARENT_F2, w.front.id, "saturday_closing", version);
      assert.equal(lost.code, "WEEKEND_SLOT_TAKEN");
      const next = (await slot(w, "sunday_opening")).place_version;
      assert.equal(
        (await viaSecond(PARENT_F2, w.front.id, "sunday_opening", next)).state,
        "success",
      );
      await noProblems();
    });

    it("BR63.7 a right revoked between two requests: the second is refused, the first pick stays", async () => {
      const w = await world();
      assert.equal(
        (
          await viaFirst(
            PARENT_F1,
            w.indoor.id,
            "saturday_opening",
            (await slot(w, "saturday_opening")).place_version,
          )
        ).state,
        "success",
      );
      await db.query("delete from app_role_grants where subject_id = $1 and role = 'parent'", [
        PARENT_F1,
      ]);
      const refused = await viaFirst(
        PARENT_F1,
        w.indoor.id,
        "sunday_opening",
        (await slot(w, "sunday_opening")).place_version,
      );
      assert.equal(refused.state, "denied", JSON.stringify(refused));
      assert.equal((await slot(w, "saturday_opening")).family_id, FAMILY_1);
      assert.equal(await count(db, "weekend_picks"), 1);
      await noProblems();
    });

    it("BR63.7 two clients with the same key at once: one pick, the same answer", async () => {
      const w = await world();
      const version = (await slot(w, "sunday_opening")).place_version;
      const key = nextKey("pick");
      const [a, b] = await Promise.all([
        pickCommand(db, schema, PARENT_F1, w.indoor.id, "sunday_opening", version, key),
        pickCommand(second, schema, PARENT_F1, w.indoor.id, "sunday_opening", version, key),
      ]);
      assert.equal(a.state, "success", JSON.stringify(a));
      assert.equal(b.state, "success", JSON.stringify(b));
      assert.equal(await count(db, "weekend_picks"), 1);
      await noProblems();
    });

    // ---- the time boundaries ----------------------------------------------------------------------------------

    const stepAt = async (w: WeekendWorld, name: string, source: string, moment: string) => {
      const version = (await slot(w, name)).place_version;
      try {
        const result = await db.query(
          "select weekend_pick_step($1, $2, $3, $4, $5::timestamptz) as r",
          [w.indoor.id, name, version, source, moment],
        );
        return result.rows[0].r as Record<string, unknown>;
      } catch (error) {
        return JSON.parse((error as { detail: string }).detail) as Record<string, unknown>;
      }
    };
    const epochOf = async (moment: string) =>
      Number(
        (await db.query("select extract(epoch from $1::timestamptz)::bigint as e", [moment]))
          .rows[0].e,
      );
    const stamp = async (epoch: number) =>
      String((await db.query("select to_timestamp($1)::text as t", [epoch])).rows[0].t);

    for (const week of ["2026-12-14", "2027-03-22"]) {
      it(`BR63.5 the boundaries of the week of ${week}${week === "2027-03-22" ? " (the clocks change that Sunday)" : ""}`, async () => {
        const w = await world({ week });
        const t = (
          await db.query(
            "select saturday::text as sat, friday_noon::text as fri from rota_week_times($1::date)",
            [week],
          )
        ).rows[0] as { sat: string; fri: string };
        const sat = await epochOf(t.sat);
        const fri = await epochOf(t.fri);
        // Friday noon and Saturday midnight in Budapest time, wherever the clocks stand.
        const local = (
          await db.query(
            "select to_char($1::timestamptz at time zone 'Europe/Budapest', 'Dy HH24:MI') as f, to_char($2::timestamptz at time zone 'Europe/Budapest', 'Dy HH24:MI') as s",
            [t.fri, t.sat],
          )
        ).rows[0];
        assert.deepEqual([local.f, local.s], ["Fri 12:00", "Sat 00:00"]);
        assert.equal(
          (await stepAt(w, "saturday_opening", "family", await stamp(fri - 1))).changed,
          true,
        );
        assert.equal(
          (await stepAt(w, "sunday_opening", "family", t.fri)).code,
          "WEEKEND_PICK_LOCKED",
        );
        assert.equal((await stepAt(w, "sunday_opening", "administrator", t.fri)).changed, true);
        assert.equal(
          (await stepAt(w, "saturday_closing", "administrator", await stamp(sat - 1))).changed,
          true,
        );
        assert.equal(
          (await stepAt(w, "sunday_closing", "administrator", t.sat)).code,
          "WEEKEND_PICK_CLOSED",
        );
        await noProblems();
      });
    }

    it("BR63.4 the front-garden family picks at the same moments as the indoor-cleaning family", async () => {
      const w = await world();
      const t = (
        await db.query("select saturday::text as sat from rota_week_times($1::date)", [w.week])
      ).rows[0] as { sat: string };
      const sat = await epochOf(t.sat);
      const version = (await slot(w, "saturday_closing")).place_version;
      const result = await db.query(
        "select weekend_pick_step($1, $2, $3, 'family', $4::timestamptz) as r",
        [w.front.id, "saturday_closing", version, await stamp(sat - 1)],
      );
      assert.equal((result.rows[0].r as { changed: boolean }).changed, true);
      assert.equal((await slot(w, "saturday_closing")).family_id, FAMILY_2);
      assert.notEqual(FAMILY_2, FAMILY_NO_GROUP);
      await noProblems();
    });
  });
}
