import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  callFunction,
  DIRECTORY_SCHEMAS,
  nextKey,
  openDirectoryDatabase,
  OTHER_ADMIN,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  SIGNED_OUT,
  SUPER_ADMIN,
  TEACHER_G1,
} from "./directory-support.ts";
import { auditEvents, count } from "./identity-support.ts";
import {
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  PARENT_NG,
  seedRotaWorld,
  setChangeover,
  setStanding,
} from "./rota-full-support.ts";
import {
  futureWeek,
  pickCommand,
  pickInvariantProblems,
  publishedWeekend,
  slotOf,
  type WeekendWorld,
} from "./weekend-picks-support.ts";

/**
 * The fixed-list tests of the weekend picks (BR63.1 to BR63.9, BR65.1 to BR65.4): picking, changing and assigning, every
 * refusal code, the time boundaries, who sees the weekend state and the exact fields of each answer. After each case
 * the pick-and-place rule is checked with a query.
 */
const OVERVIEW_ITEM_FIELDS = [
  "duty_id",
  "family_display_name",
  "family_id",
  "is_break",
  "is_own",
  "job",
  "week_start",
];
const WEEKEND_ITEM_FIELDS = [
  "duty_id",
  "family_display_name",
  "family_id",
  "is_own",
  "slot",
  "week_start",
];
const WEEKEND_STATE_FIELDS = [
  "change_until",
  "pickers",
  "picks_close_at",
  "slots",
  "week_start",
  "weekend_family_display_name",
];
const OWN_PICK_FIELDS = [
  "can_pick",
  "change_until",
  "free_slots",
  "picks_close_at",
  "rota_week_id",
  "slot",
  "state",
];
const UNPICKED_FIELDS = [
  "change_until",
  "family_display_name",
  "free_slots",
  "job",
  "picks_close_at",
  "rota_week_id",
  "week_start",
  "weekend_family_display_name",
];

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`weekend picks in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(() => seedRotaWorld(db, schema));

    const call = (account: string, sql: string, values: unknown[]) =>
      callFunction(db, schema, account, sql, values);
    const world = (options?: Parameters<typeof publishedWeekend>[2]) =>
      publishedWeekend(db, schema, options);
    const slot = (w: WeekendWorld, name: string) => slotOf(db, w, name);
    const pick = async (
      account: string,
      w: WeekendWorld,
      name: string,
      who: "indoor" | "front" = "indoor",
      key = nextKey("pick"),
    ) =>
      pickCommand(db, schema, account, w[who].id, name, (await slot(w, name)).place_version, key);
    const assign = async (
      account: string,
      w: WeekendWorld,
      name: string,
      who: "indoor" | "front" = "indoor",
    ) =>
      pickCommand(
        db,
        schema,
        account,
        w[who].id,
        name,
        (await slot(w, name)).place_version,
        nextKey("assign"),
        "weekend_pick_assign",
      );
    /** Runs the internal step at a chosen moment; a refusal comes back as the stored result. */
    const step = async (
      w: WeekendWorld,
      name: string,
      source: "family" | "administrator",
      at: string,
      who: "indoor" | "front" = "indoor",
    ) => {
      const version = (await slot(w, name)).place_version;
      try {
        const result = await db.query(
          "select weekend_pick_step($1, $2, $3, $4, $5::timestamptz) as r",
          [w[who].id, name, version, source, at],
        );
        return result.rows[0].r as Record<string, unknown>;
      } catch (error) {
        const detail = (error as { detail?: string }).detail;
        assert.ok(detail, String(error));
        return JSON.parse(detail) as Record<string, unknown>;
      }
    };
    const times = async (week: string) =>
      (
        await db.query(
          "select saturday::text as saturday, friday_noon::text as friday_noon, wednesday::text as wednesday, extract(epoch from saturday)::bigint as sat_epoch from rota_week_times($1::date)",
          [week],
        )
      ).rows[0] as { saturday: string; friday_noon: string; wednesday: string; sat_epoch: string };
    const iso = (seconds: number) => `to_timestamp(${seconds})`;
    const at = async (epoch: number) =>
      String((await db.query(`select ${iso(epoch)}::text as t`)).rows[0].t);
    const holder = async (w: WeekendWorld, name: string) => (await slot(w, name)).family_id;
    const noProblems = async () => assert.deepEqual(await pickInvariantProblems(db), []);

    // ---- publishing leaves the weekend with its family (BR63.1, BR63.2) -----------------------------------

    it("BR63.2 before any pick the weekend family holds every duty of the weekend", async () => {
      const w = await world();
      for (const name of [
        "saturday_opening",
        "saturday_closing",
        "sunday_opening",
        "sunday_closing",
        "shelter_cleaning",
      ]) {
        const row = await slot(w, name);
        assert.deepEqual([row.family_id, row.source], [FAMILY_NO_GROUP, "rota_publish"], name);
      }
      assert.equal(await count(db, "weekend_picks"), 0);
      await noProblems();
    });

    // ---- picking (BR63.4) -----------------------------------------------------------------------------------

    it("BR63.4 allowed: a parent of the indoor-cleaning family picks a free opening", async () => {
      const w = await world();
      const result = await pick(PARENT_F1, w, "saturday_opening");
      assert.equal(result.state, "success", JSON.stringify(result));
      const row = await slot(w, "saturday_opening");
      assert.deepEqual([row.family_id, row.source], [FAMILY_1, "weekend_pick"]);
      assert.equal(
        await count(db, "weekend_picks", `source = 'family' and rota_week_id = '${w.indoor.id}'`),
        1,
      );
      assert.equal(await holder(w, "shelter_cleaning"), FAMILY_NO_GROUP);
      await noProblems();
    });

    it("BR63.2 both picks made: the weekend family keeps the shelter cleaning and the other two", async () => {
      const w = await world();
      assert.equal((await pick(PARENT_F1, w, "saturday_opening")).state, "success");
      assert.equal((await pick(PARENT_F2, w, "sunday_closing", "front")).state, "success");
      const held = [];
      for (const name of ["saturday_closing", "sunday_opening", "shelter_cleaning"])
        held.push(await holder(w, name));
      assert.deepEqual(held, [FAMILY_NO_GROUP, FAMILY_NO_GROUP, FAMILY_NO_GROUP]);
      assert.equal(await holder(w, "sunday_closing"), FAMILY_2);
      await noProblems();
    });

    it("BR63.5 change before Friday noon: the old slot goes back, the new one is taken", async () => {
      const w = await world();
      await pick(PARENT_F1, w, "saturday_opening");
      const changed = await pick(PARENT_F1, w, "sunday_closing");
      assert.equal(changed.state, "success", JSON.stringify(changed));
      assert.deepEqual(
        [await holder(w, "saturday_opening"), (await slot(w, "saturday_opening")).source],
        [FAMILY_NO_GROUP, "rota_publish"],
      );
      assert.equal(await holder(w, "sunday_closing"), FAMILY_1);
      assert.equal(await count(db, "weekend_picks"), 1);
      await noProblems();
    });

    it("BR63.5 picking the same slot again changes nothing", async () => {
      const w = await world();
      await pick(PARENT_F1, w, "saturday_closing");
      const before = await slot(w, "saturday_closing");
      const again = await pickCommand(
        db,
        schema,
        PARENT_F1,
        w.indoor.id,
        "saturday_closing",
        before.place_version,
      );
      assert.equal(again.state, "success", JSON.stringify(again));
      assert.equal((await slot(w, "saturday_closing")).place_version, before.place_version);
      await noProblems();
    });

    it("BR63.4 refused: the shelter cleaning, an unknown slot, a taken slot, an outdated screen", async () => {
      const w = await world();
      const shelter = await pick(PARENT_F1, w, "shelter_cleaning");
      assert.deepEqual([shelter.state, shelter.code], ["validation", "WEEKEND_SLOT_NOT_PICKABLE"]);
      const unknown = await pickCommand(db, schema, PARENT_F1, w.indoor.id, "monday_noon", 1);
      assert.deepEqual([unknown.state, unknown.code], ["validation", "request_invalid"]);
      const stale = await pickCommand(db, schema, PARENT_F1, w.indoor.id, "sunday_opening", 99);
      assert.deepEqual([stale.state, stale.code], ["conflict", "WEEKEND_SLOT_TAKEN"]);
      await pick(PARENT_F2, w, "saturday_opening", "front");
      const taken = await pickCommand(
        db,
        schema,
        PARENT_F1,
        w.indoor.id,
        "saturday_opening",
        (await slot(w, "saturday_opening")).place_version,
      );
      assert.deepEqual([taken.state, taken.code], ["conflict", "WEEKEND_SLOT_TAKEN"]);
      assert.equal(await count(db, "weekend_picks", `rota_week_id = '${w.indoor.id}'`), 0);
      await noProblems();
    });

    it("BR63.3 refused: the weekend family has nothing to pick, a week with no family owes nothing", async () => {
      const own = await world({ indoor: FAMILY_NO_GROUP });
      const refused = await pick(PARENT_NG, own, "saturday_opening");
      assert.deepEqual([refused.state, refused.code], ["validation", "WEEKEND_PICK_NOT_NEEDED"]);
      assert.equal(await count(db, "weekend_picks"), 0);
      await noProblems();
    });

    it("BR63.3 a break week: only the front-garden family picks", async () => {
      const week = await futureWeek(db, 21, 3);
      await db.query(
        "insert into break_weeks (organization_id, school_year_id, week_start) select organization_id, id, $1 from school_years where starts_on <= $1 and ends_on >= $1 limit 1",
        [week],
      );
      const w = await world({ week, indoor: null });
      const indoor = await db.query(
        "select id, family_id from rota_weeks where job = 'indoor_cleaning' and week_start = $1",
        [week],
      );
      assert.equal(indoor.rows[0].family_id, null);
      const none = await callFunction(db, schema, PARENT_F1, "weekend_pick_set($1, $2, $3, $4)", [
        nextKey("pick"),
        indoor.rows[0].id,
        "saturday_opening",
        1,
      ]);
      assert.equal(none.state, "denied");
      assert.equal((await pick(PARENT_F2, w, "sunday_opening", "front")).state, "success");
      await noProblems();
    });

    it("BR63.4 out of reach: other parents, teachers, administrators, other communities, signed out", async () => {
      const w = await world();
      const version = (await slot(w, "sunday_opening")).place_version;
      for (const account of [
        PARENT_F2,
        TEACHER_G1,
        ADMIN_G1,
        SUPER_ADMIN,
        OTHER_ADMIN,
        OUTSIDER,
        SIGNED_OUT,
      ]) {
        const refused = await pickCommand(
          db,
          schema,
          account,
          w.indoor.id,
          "sunday_opening",
          version,
        );
        assert.equal(refused.state, "denied", account);
      }
      assert.equal(await count(db, "weekend_picks"), 0);
      await noProblems();
    });

    it("BR63.4 repeated click: the same key returns the stored result and picks once", async () => {
      const w = await world();
      const key = nextKey("pick");
      const version = (await slot(w, "saturday_opening")).place_version;
      const first = await pickCommand(
        db,
        schema,
        PARENT_F1,
        w.indoor.id,
        "saturday_opening",
        version,
        key,
      );
      const again = await pickCommand(
        db,
        schema,
        PARENT_F1,
        w.indoor.id,
        "saturday_opening",
        version,
        key,
      );
      assert.deepEqual([first.state, again.state, again.code], ["success", "success", "replayed"]);
      assert.equal(await count(db, "weekend_picks"), 1);
      await noProblems();
    });

    it("BR60.4 a picker no longer allowed is refused with the reason, an archived one is denied", async () => {
      const w = await world();
      await setChangeover(db, w.week);
      await setStanding(db, schema, FAMILY_1, "leaving");
      // Such a week owes no pick (20261054) but the refusal stays DUTY_INELIGIBLE with the reason (20261055).
      const refused = await pick(PARENT_F1, w, "saturday_opening");
      assert.deepEqual(
        [refused.state, refused.code, refused.reason],
        ["validation", "DUTY_INELIGIBLE", "leaving_after_changeover"],
      );
      await setStanding(db, schema, FAMILY_1, "staying");
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_1,
      ]);
      const gone = await pick(PARENT_F1, w, "saturday_opening");
      assert.equal(
        gone.state === "denied" || gone.state === "validation",
        true,
        JSON.stringify(gone),
      );
      assert.equal(await count(db, "weekend_picks"), 0);
      await noProblems();
    });

    // ---- time boundaries (BR63.4, BR63.5, BR63.6) -------------------------------------------------------------

    it("BR63.4 BR63.5 the boundaries: first pick until Saturday, change until Friday noon", async () => {
      const w = await world();
      const t = await times(w.week);
      const sat = Number(t.sat_epoch);
      // A first pick one second before Saturday begins still works; at Saturday it is closed.
      const late = await step(w, "sunday_opening", "family", await at(sat - 1));
      assert.equal(late.changed, true, JSON.stringify(late));
      const closed = await step(w, "saturday_closing", "family", t.saturday);
      assert.deepEqual([closed.state, closed.code], ["conflict", "WEEKEND_PICK_CLOSED"]);
      // With a pick made, a change is possible until Friday noon and locked from it.
      const locked = await step(w, "saturday_opening", "family", t.friday_noon);
      assert.deepEqual([locked.state, locked.code], ["conflict", "WEEKEND_PICK_LOCKED"]);
      const noon = Number(
        (await db.query("select extract(epoch from $1::timestamptz)::bigint as e", [t.friday_noon]))
          .rows[0].e,
      );
      const before = await step(w, "saturday_opening", "family", await at(noon - 1));
      assert.equal(before.changed, true, JSON.stringify(before));
      // The same slot again at or after Friday noon changes nothing and is not refused.
      const same = await step(w, "saturday_opening", "family", t.friday_noon);
      assert.equal(same.changed, false, JSON.stringify(same));
      await noProblems();
    });

    it("BR63.6 an administrator may assign and change until Saturday, Friday noon included", async () => {
      const w = await world();
      const t = await times(w.week);
      const sat = Number(t.sat_epoch);
      const first = await step(w, "saturday_opening", "administrator", t.friday_noon);
      assert.equal(first.changed, true, JSON.stringify(first));
      const change = await step(w, "sunday_closing", "administrator", await at(sat - 1));
      assert.equal(change.changed, true, JSON.stringify(change));
      const closed = await step(w, "sunday_opening", "administrator", t.saturday);
      assert.deepEqual([closed.state, closed.code], ["conflict", "WEEKEND_PICK_CLOSED"]);
      assert.equal(await holder(w, "sunday_closing"), FAMILY_1);
      await noProblems();
    });

    it("BR63.4 a past weekend is closed: the command refuses, nothing moves", async () => {
      const week = await (async () => {
        const row = await db.query(
          "select to_char(min(week_start), 'YYYY-MM-DD') as d from school_weeks((select id from school_years order by starts_on limit 1))",
        );
        return String(row.rows[0].d);
      })();
      const w = await world({ week });
      // As if the plan had been published long before this weekend.
      await db.query(
        "update rota_plans set published_at = '2000-01-01' where id = (select plan_id from rota_weeks where id = $1)",
        [w.indoor.id],
      );
      const refused = await pick(PARENT_F1, w, "saturday_opening");
      assert.deepEqual([refused.state, refused.code], ["conflict", "WEEKEND_PICK_CLOSED"]);
      await noProblems();
    });

    it("BR60.3 the week's times in Budapest time, also in the weeks the clocks change", async () => {
      const rows = await db.query(
        "select to_char(m, 'YYYY-MM-DD') as monday, to_char(t.wednesday at time zone 'Europe/Budapest', 'YYYY-MM-DD HH24:MI') as wed, to_char(t.friday_noon at time zone 'Europe/Budapest', 'YYYY-MM-DD HH24:MI') as fri, to_char(t.saturday at time zone 'Europe/Budapest', 'YYYY-MM-DD HH24:MI') as sat, extract(epoch from t.ends_at - t.starts_at)::integer / 3600 as hours from (values ('2026-10-26'::date), ('2026-10-19'::date), ('2027-03-29'::date), ('2027-03-22'::date), ('2026-12-14'::date)) v(m), lateral rota_week_times(v.m) t order by m",
      );
      const expected: Record<string, [string, string, string, number]> = {
        "2026-10-19": ["2026-10-21 00:00", "2026-10-23 12:00", "2026-10-24 00:00", 169],
        "2026-10-26": ["2026-10-28 00:00", "2026-10-30 12:00", "2026-10-31 00:00", 168],
        "2026-12-14": ["2026-12-16 00:00", "2026-12-18 12:00", "2026-12-19 00:00", 168],
        "2027-03-22": ["2027-03-24 00:00", "2027-03-26 12:00", "2027-03-27 00:00", 167],
        "2027-03-29": ["2027-03-31 00:00", "2027-04-02 12:00", "2027-04-03 00:00", 168],
      };
      for (const row of rows.rows) {
        assert.deepEqual([row.wed, row.fri, row.sat, row.hours], expected[row.monday], row.monday);
      }
    });

    // ---- assigning (BR63.6) -------------------------------------------------------------------------------------

    it("BR63.6 a super admin assigns a pick: place moved, audited without a name, family notified", async () => {
      const w = await world();
      const result = await assign(SUPER_ADMIN, w, "sunday_opening");
      assert.equal(result.state, "success", JSON.stringify(result));
      const row = await slot(w, "sunday_opening");
      assert.deepEqual([row.family_id, row.source], [FAMILY_1, "weekend_pick"]);
      assert.equal(await count(db, "weekend_picks", "source = 'administrator'"), 1);
      const events = (await auditEvents(db)).filter((e) => e.action === "weekend_pick.assign");
      assert.equal(events.length, 1);
      assert.deepEqual(
        [events[0]?.target_type, events[0]?.details, events[0]?.outcome],
        ["rota_week", "slot:sunday_opening", "success"],
      );
      assert.equal(JSON.stringify(events[0]).includes("család"), false);
      assert.ok((await count(db, "notifications", "kind = 'weekend_pick_assigned'")) >= 1);
      await noProblems();
    });

    it("BR63.6 an administrator's assignment may replace a family's own pick", async () => {
      const w = await world();
      await pick(PARENT_F1, w, "saturday_opening");
      const result = await assign(SUPER_ADMIN, w, "sunday_closing");
      assert.equal(result.state, "success", JSON.stringify(result));
      assert.equal(await holder(w, "saturday_opening"), FAMILY_NO_GROUP);
      assert.equal(await holder(w, "sunday_closing"), FAMILY_1);
      assert.equal(await count(db, "weekend_picks", "source = 'administrator'"), 1);
      await noProblems();
    });

    it("BR63.6 refused: every other role, the shelter cleaning, a taken slot", async () => {
      const w = await world();
      for (const account of [PARENT_F1, PARENT_F2, TEACHER_G1, ADMIN_G1, OTHER_ADMIN, SIGNED_OUT]) {
        assert.equal((await assign(account, w, "saturday_opening")).state, "denied", account);
      }
      const shelter = await assign(SUPER_ADMIN, w, "shelter_cleaning");
      assert.equal(shelter.code, "WEEKEND_SLOT_NOT_PICKABLE");
      await pick(PARENT_F2, w, "saturday_closing", "front");
      const taken = await assign(SUPER_ADMIN, w, "saturday_closing");
      assert.equal(taken.code, "WEEKEND_SLOT_TAKEN");
      assert.equal(await count(db, "weekend_picks", `rota_week_id = '${w.indoor.id}'`), 0);
      assert.equal(
        (await auditEvents(db)).filter((e) => e.action === "weekend_pick.assign").length,
        0,
      );
      await noProblems();
    });

    it("BR63.6 repeated click: stored result, one notice, one audit event", async () => {
      const w = await world();
      const key = nextKey("assign");
      const version = (await slot(w, "saturday_opening")).place_version;
      const first = await pickCommand(
        db,
        schema,
        SUPER_ADMIN,
        w.indoor.id,
        "saturday_opening",
        version,
        key,
        "weekend_pick_assign",
      );
      const notices = await count(db, "notifications", "kind = 'weekend_pick_assigned'");
      const again = await pickCommand(
        db,
        schema,
        SUPER_ADMIN,
        w.indoor.id,
        "saturday_opening",
        version,
        key,
        "weekend_pick_assign",
      );
      assert.deepEqual([first.state, again.state, again.code], ["success", "success", "replayed"]);
      assert.equal(await count(db, "notifications", "kind = 'weekend_pick_assigned'"), notices);
      assert.equal(
        (await auditEvents(db)).filter((e) => e.action === "weekend_pick.assign").length,
        1,
      );
    });

    // ---- what people see (BR65.1 to BR65.4) ---------------------------------------------------------------------

    it("BR65.3 the weekend state goes to the holders and super admins, and to nobody else", async () => {
      const w = await world();
      await pick(PARENT_F1, w, "saturday_opening");
      const indoorDuty = (
        await db.query("select id from tasks where origin_kind = 'rota_week' and origin_id = $1", [
          w.indoor.id,
        ])
      ).rows[0].id as string;
      const shelter = await slot(w, "shelter_cleaning");
      const cardOf = async (account: string, duty: string) =>
        (await call(account, "rota_duty_card($1)", [duty])) as unknown as {
          state: string;
          code: string | null;
          item: Record<string, unknown> & {
            weekend: Record<string, unknown> | null;
            own_pick: Record<string, unknown> | null;
          };
        };
      const own = await cardOf(PARENT_F1, indoorDuty);
      assert.equal(own.state, "success", JSON.stringify(own));
      assert.deepEqual(Object.keys(own.item.weekend ?? {}).sort(), WEEKEND_STATE_FIELDS);
      assert.deepEqual(Object.keys(own.item.own_pick ?? {}).sort(), OWN_PICK_FIELDS);
      assert.equal(own.item.own_pick?.state, "picked");
      assert.equal(own.item.own_pick?.slot, "saturday_opening");
      const admin = await cardOf(SUPER_ADMIN, indoorDuty);
      assert.equal(admin.state, "success");
      assert.ok(admin.item.weekend);
      assert.equal(admin.item.own_pick, null);
      const weekendFamily = await cardOf(PARENT_NG, shelter.duty_id);
      assert.equal(weekendFamily.state, "success");
      assert.ok(weekendFamily.item.weekend);
      assert.equal(weekendFamily.item.day, "weekend");
      assert.equal(weekendFamily.item.part_of_day, "all_day");
      assert.equal(weekendFamily.item.own_pick, null);
      for (const account of [PARENT_F2, TEACHER_G1, ADMIN_G1, OTHER_ADMIN]) {
        const refused = await cardOf(account, indoorDuty);
        assert.deepEqual(
          [refused.state, refused.code],
          ["denied", "authorization_denied"],
          account,
        );
      }
      const state = own.item.weekend as unknown as {
        slots: Record<string, unknown>[];
        pickers: { job: string; state: string; slot: string | null }[];
      };
      assert.equal(state.slots.length, 5);
      assert.deepEqual(
        state.pickers.map((p) => [p.job, p.state, p.slot]),
        [
          ["indoor_cleaning", "picked", "saturday_opening"],
          ["front_garden", "open", null],
        ],
      );
      await noProblems();
    });

    it("BR65.2 the card says what belongs to the job in that week", async () => {
      const w = await world();
      const cardFor = async (account: string, job: string, family: string) => {
        const duty = (
          await db.query(
            "select t.id from tasks t join rota_weeks r on t.origin_kind = 'rota_week' and r.id = t.origin_id where r.job = $1 and r.family_id = $2 order by r.week_start limit 1",
            [job, family],
          )
        ).rows[0]?.id as string | undefined;
        assert.ok(duty, job);
        return (
          (await call(account, "rota_duty_card($1)", [duty])) as unknown as {
            item: Record<string, unknown>;
          }
        ).item;
      };
      const garden = await cardFor(PARENT_F2, "front_garden", w.front.family);
      const week = new Date(`${garden.week_start}T00:00:00Z`).getUTCMonth() + 1;
      assert.equal(garden.includes_watering, week >= 3 && week <= 10);
      assert.equal(garden.bottles_at_week_end, false);
      assert.equal(garden.no_fixed_day, true);
      const water = (
        await db.query(
          "select t.id, r.family_id from tasks t join rota_weeks r on t.origin_kind = 'rota_week' and r.id = t.origin_id where r.job = 'water_carrying' limit 1",
        )
      ).rows[0] as { id: string };
      const card = (
        (await call(SUPER_ADMIN, "rota_duty_card($1)", [water.id])) as unknown as {
          item: Record<string, unknown>;
        }
      ).item;
      assert.deepEqual(
        [card.bottles_at_week_end, card.includes_watering, card.weekend, card.own_pick],
        [true, false, null, null],
      );
      const opening = await slot(w, "saturday_opening");
      const slotCard = (
        (await call(SUPER_ADMIN, "rota_duty_card($1)", [opening.duty_id])) as unknown as {
          item: Record<string, unknown>;
        }
      ).item;
      assert.deepEqual(
        [slotCard.slot, slotCard.day, slotCard.part_of_day, slotCard.no_fixed_day, slotCard.job],
        ["saturday_opening", "saturday", "morning", false, "weekend_animal_care"],
      );
      const closing = await slot(w, "sunday_closing");
      const closeCard = (
        (await call(SUPER_ADMIN, "rota_duty_card($1)", [closing.duty_id])) as unknown as {
          item: Record<string, unknown>;
        }
      ).item;
      assert.deepEqual([closeCard.day, closeCard.part_of_day], ["sunday", "evening"]);
    });

    for (const [week, watering] of [
      ["2027-02-22", false],
      ["2027-03-01", true],
      ["2026-12-14", false],
    ] as const) {
      it(`BR65.2 the front-garden card of the week of ${week} ${watering ? "includes" : "leaves out"} watering`, async () => {
        const w = await world({ week });
        const duty = (
          await db.query(
            "select t.id from tasks t where t.origin_kind = 'rota_week' and t.origin_id = (select id from rota_weeks where job = 'front_garden' and week_start = $1 and family_id = $2)",
            [week, w.front.family],
          )
        ).rows[0].id as string;
        const card = (
          (await call(PARENT_F2, "rota_duty_card($1)", [duty])) as unknown as {
            item: Record<string, unknown>;
          }
        ).item;
        assert.equal(card.includes_watering, watering);
      });
    }

    it("BR65.1 the overview lists four rotas and the five weekend duties with the exact fields", async () => {
      const w = await world();
      await pick(PARENT_F1, w, "saturday_opening");
      const weeks = (
        await db.query(
          "select count(*)::int as n from school_weeks((select id from school_years order by starts_on limit 1))",
        )
      ).rows[0].n as number;
      for (const account of [PARENT_F1, PARENT_F2, TEACHER_G1, ADMIN_G1, SUPER_ADMIN]) {
        const view = (await call(account, "rota_overview()", [])) as unknown as {
          state: string;
          items: Record<string, unknown>[];
          weekend_items: Record<string, unknown>[];
        };
        assert.equal(view.state, "success", account);
        assert.equal(view.items.length, weeks * 4);
        assert.equal(view.weekend_items.length, weeks * 5);
        assert.deepEqual(Object.keys(view.items[0] ?? {}).sort(), OVERVIEW_ITEM_FIELDS);
        assert.deepEqual(Object.keys(view.weekend_items[0] ?? {}).sort(), WEEKEND_ITEM_FIELDS);
        const text = JSON.stringify(view);
        for (const word of ["@", "phone", "child", "telefon"])
          assert.equal(text.includes(word), false, word);
      }
      const mine = (await call(PARENT_F1, "rota_overview()", [])) as unknown as {
        weekend_items: {
          week_start: string;
          slot: string;
          is_own: boolean;
          family_display_name: string;
        }[];
      };
      const opening = mine.weekend_items.find(
        (i) => i.week_start === w.week && i.slot === "saturday_opening",
      );
      assert.equal(opening?.is_own, true);
      const shelter = mine.weekend_items.find(
        (i) => i.week_start === w.week && i.slot === "shelter_cleaning",
      );
      assert.equal(shelter?.is_own, false);
      assert.equal(shelter?.family_display_name, "Csoport nélküli család");
    });

    it("BR65.4 the unpicked list: only super admins, never an empty list instead of a refusal", async () => {
      const w = await world();
      for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G1, SIGNED_OUT]) {
        const refused = await call(account, "weekend_unpicked_list()", []);
        assert.equal(refused.state, "denied", account);
      }
      // A super admin of another community reads that community, and sees none of this one.
      const other = (await call(OTHER_ADMIN, "weekend_unpicked_list()", [])) as unknown as {
        items: unknown[];
        missed: unknown[];
      };
      assert.deepEqual([other.items, other.missed], [[], []]);
      const view = (await call(SUPER_ADMIN, "weekend_unpicked_list()", [])) as unknown as {
        state: string;
        items: {
          rota_week_id: string;
          job: string;
          week_start: string;
          free_slots: { slot: string }[];
        }[];
        missed: unknown[];
      };
      assert.equal(view.state, "success", JSON.stringify(view));
      const mine = view.items.filter((i) => i.week_start === w.week);
      assert.deepEqual(
        mine.map((i) => i.job),
        ["indoor_cleaning", "front_garden"],
      );
      assert.deepEqual(Object.keys(mine[0] ?? {}).sort(), UNPICKED_FIELDS);
      assert.deepEqual(
        mine[0]?.free_slots.map((s) => s.slot),
        ["saturday_opening", "saturday_closing", "sunday_opening", "sunday_closing"],
      );
      await pick(PARENT_F1, w, "saturday_opening");
      const after = (await call(SUPER_ADMIN, "weekend_unpicked_list()", [])) as unknown as {
        items: { week_start: string; job: string; free_slots: unknown[] }[];
      };
      const left = after.items.filter((i) => i.week_start === w.week);
      assert.deepEqual(
        left.map((i) => i.job),
        ["front_garden"],
      );
      assert.equal(left[0]?.free_slots.length, 3);
    });

    it("BR63.8 a pick nobody made by Saturday shows as missed for the rest of the year", async () => {
      const week = await (async () => {
        const row = await db.query(
          "select to_char(min(week_start), 'YYYY-MM-DD') as d from school_weeks((select id from school_years order by starts_on limit 1))",
        );
        return String(row.rows[0].d);
      })();
      const w = await world({ week });
      await db.query(
        "update rota_plans set published_at = '2000-01-01' where id = (select plan_id from rota_weeks where id = $1)",
        [w.indoor.id],
      );
      const view = (await call(SUPER_ADMIN, "weekend_unpicked_list()", [])) as unknown as {
        items: { week_start: string }[];
        missed: { week_start: string; job: string; family_display_name: string }[];
      };
      assert.ok(view.missed.some((m) => m.week_start === week && m.job === "indoor_cleaning"));
      assert.ok(view.missed.some((m) => m.week_start === week && m.job === "front_garden"));
      assert.equal(
        view.items.some((i) => i.week_start === week),
        false,
      );
      assert.equal(await holder(w, "saturday_opening"), FAMILY_NO_GROUP);
    });

    it("BR63.9 a pick that does not fit its week or slot is refused by the table itself", async () => {
      const w = await world();
      const slotId = (
        await db.query(
          "select id from weekend_slots where weekend_week_id = $1 and slot = 'shelter_cleaning'",
          [w.weekend.id],
        )
      ).rows[0].id as string;
      await assert.rejects(
        db.query(
          "insert into weekend_picks (organization_id, rota_week_id, weekend_slot_id, source) select organization_id, $1, $2, 'family' from rota_weeks where id = $1",
          [w.indoor.id, slotId],
        ),
      );
      const waterRow = (
        await db.query("select id from rota_weeks where job = 'water_carrying' limit 1")
      ).rows[0].id as string;
      const openId = (
        await db.query(
          "select id from weekend_slots where weekend_week_id = $1 and slot = 'saturday_opening'",
          [w.weekend.id],
        )
      ).rows[0].id as string;
      await assert.rejects(
        db.query(
          "insert into weekend_picks (organization_id, rota_week_id, weekend_slot_id, source) select organization_id, $1, $2, 'family' from rota_weeks where id = $1",
          [waterRow, openId],
        ),
      );
      assert.equal(await count(db, "weekend_picks"), 0);
    });

    it("BR67.2 application roles hold no right on the new tables or the internal functions", async () => {
      await world();
      for (const sql of [
        "select * from weekend_picks",
        "select * from weekend_slots",
        "select * from family_year_standings",
        "select weekend_pick_owed(gen_random_uuid())",
        "select weekend_picking_state(gen_random_uuid())",
        "select weekend_pick_step(gen_random_uuid(), 'saturday_opening', 1, 'family', now())",
      ]) {
        await db.query("begin");
        try {
          await db.query("set local role authenticated");
          await assert.rejects(db.query(sql), sql);
        } finally {
          await db.query("rollback");
        }
      }
    });
  });
}
