import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ASSIGNMENT_F2_T3,
  callFunction,
  DIRECTORY_SCHEMAS,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  OTHER_ADMIN,
  PARENT_F1,
  PARENT_F2,
  SUPER_ADMIN,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import { auditEvents, count } from "./identity-support.ts";
import { FAMILY_1, FAMILY_2, seedRotaWorld } from "./rota-full-support.ts";
import { makeDraft, publish, readFullPlan, schoolWeekStarts } from "./rota-support.ts";
import { failureOf, openDatabase, useSchema } from "./stack-support.ts";

/**
 * The fixed-list tests of the four-rota plan (BR61.1 to BR63.2): adjusting a draft, publishing all four rotas at once,
 * a failure in the middle of publishing, the one notice for each parent, and the protection of the weekend duties.
 */
const JOB_TITLES: Record<string, string> = {
  indoor_cleaning: "Belső takarítás",
  front_garden: "Előkert",
  water_carrying: "Vízhordás",
  weekend_animal_care: "Hétvégi állatgondozás",
};
const SLOTS = [
  "saturday_opening",
  "saturday_closing",
  "sunday_opening",
  "sunday_closing",
  "shelter_cleaning",
];

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`four-rota plan in ${schema}`, () => {
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

    const call = (account: string, sql: string, values: unknown[]) =>
      callFunction(db, schema, account, sql, values);
    const setWeek = (
      account: string,
      week: { id: string; version: number },
      family: string | null,
      key = nextKey("week"),
      version = week.version,
    ) => call(account, "rota_week_set($1, $2, $3, $4)", [key, week.id, family, version]);
    const items = async () => (await readFullPlan(db, schema)).items;
    const rowsOf = async (job: string) => (await items()).filter((w) => w.job === job);
    /** A week and the other rota of the pair held by the given family, for the same-week rule. */
    const partnerWeek = async (job: "indoor_cleaning" | "front_garden", family: string) => {
      const other = job === "indoor_cleaning" ? "front_garden" : "indoor_cleaning";
      const all = await items();
      const holder = all.find((w) => w.job === other && w.family_id === family);
      const here = all.find((w) => w.job === job && w.week_start === holder?.week_start);
      assert.ok(holder && here);
      return here;
    };
    const dateText = (week: string) => {
      const start = new Date(`${week}T00:00:00Z`);
      const end = new Date(start.getTime() + 6 * 86400000);
      const two = (n: number) => String(n).padStart(2, "0");
      return `${week.slice(0, 4)}. ${week.slice(5, 7)}. ${week.slice(8, 10)}. – ${two(end.getUTCMonth() + 1)}. ${two(end.getUTCDate())}.`;
    };

    // ---- the draft: adjusting a week ----------------------------------------------------------------------

    it("BR62.1 allowed: any rota's week can be given to a family that may hold it", async () => {
      await makeDraft(db, schema);
      for (const job of ["front_garden", "water_carrying", "weekend_animal_care"]) {
        const indoor = new Map(
          (await rowsOf("indoor_cleaning")).map((w) => [w.week_start, w.family_id]),
        );
        const week = (await rowsOf(job)).find(
          (w) => w.family_id !== FAMILY_2 && indoor.get(w.week_start) !== FAMILY_2,
        );
        assert.ok(week);
        const set = await setWeek(SUPER_ADMIN, week, FAMILY_2);
        assert.equal(set.state, "success", `${job} ${JSON.stringify(set)}`);
        const row = (await rowsOf(job)).find((w) => w.id === week.id);
        assert.deepEqual([row?.family_id, row?.changed_by_admin], [FAMILY_2, true]);
      }
    });

    it("BR62.1 refused: indoor cleaning and front garden of one week in one family", async () => {
      await makeDraft(db, schema);
      for (const job of ["indoor_cleaning", "front_garden"] as const) {
        const week = await partnerWeek(job, FAMILY_1);
        const refused = await setWeek(SUPER_ADMIN, week, FAMILY_1);
        assert.deepEqual(
          [refused.state, refused.code],
          ["validation", "ROTA_SAME_WEEK_CLASH"],
          job,
        );
      }
    });

    it("BR62.1 refused: the other pairs may share a family, with a warning", async () => {
      await makeDraft(db, schema);
      const all = await items();
      const garden = all.find((w) => w.job === "front_garden" && w.family_id !== null);
      const water = all.find(
        (w) => w.job === "water_carrying" && w.week_start === garden?.week_start,
      );
      assert.ok(garden && water);
      const set = await setWeek(SUPER_ADMIN, water, garden.family_id);
      assert.equal(set.state, "success", JSON.stringify(set));
      const view = await readFullPlan(db, schema);
      assert.ok(view.warnings.two_jobs.length >= 1);
      assert.equal(view.can_publish, true);
    });

    it("BR62.1 refused: a break week only for indoor cleaning and water carrying", async () => {
      const weeks = await schoolWeekStarts(db);
      const brk = weeks[10] as string;
      await db.query(
        "insert into break_weeks (organization_id, school_year_id, week_start) select $1, id, $2 from school_years where organization_id = $1 and starts_on <= $2 and ends_on >= $2 on conflict do nothing",
        [ORGANIZATION, brk],
      );
      await makeDraft(db, schema);
      const all = await items();
      for (const job of ["indoor_cleaning", "water_carrying"]) {
        const week = all.find((w) => w.job === job && w.week_start === brk);
        assert.ok(week);
        const refused = await setWeek(SUPER_ADMIN, week, FAMILY_2);
        assert.deepEqual([refused.state, refused.code], ["validation", "ROTA_BREAK_WEEK"], job);
      }
      for (const job of ["front_garden", "weekend_animal_care"]) {
        const week = all.find((w) => w.job === job && w.week_start === brk);
        assert.ok(week);
        assert.ok(week.family_id !== null, `${job} is drafted in a break week`);
      }
    });

    it("BR62.1 refused: an archived family and a published plan", async () => {
      const draft = await makeDraft(db, schema);
      const week = (await rowsOf("water_carrying"))[0];
      assert.ok(week);
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_2,
      ]);
      const archived = await setWeek(SUPER_ADMIN, week, FAMILY_2);
      assert.deepEqual([archived.state, archived.code], ["validation", "ROTA_FAMILY_INELIGIBLE"]);
      await db.query("update families set status = 'active', archived_at = null where id = $1", [
        FAMILY_2,
      ]);
      assert.equal((await publish(db, schema, draft)).state, "success");
      const late = (await rowsOf("water_carrying"))[0];
      assert.ok(late);
      const refused = await setWeek(SUPER_ADMIN, late, FAMILY_2);
      assert.deepEqual([refused.state, refused.code], ["conflict", "ROTA_PLAN_PUBLISHED"]);
    });

    it("BR62.1 out of reach: parents, teachers, admins of another community, and made-up weeks", async () => {
      await makeDraft(db, schema);
      const week = (await rowsOf("front_garden"))[0];
      assert.ok(week);
      for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G1, OTHER_ADMIN]) {
        const refused = await setWeek(account, week, FAMILY_2);
        assert.equal(refused.state, "denied", account);
      }
      const made = await setWeek(SUPER_ADMIN, { id: uuid(9990), version: 1 }, FAMILY_2);
      assert.equal(made.state, "denied");
    });

    it("BR62.1 outdated screen: a stale week version is a conflict", async () => {
      await makeDraft(db, schema);
      const week = (await rowsOf("weekend_animal_care"))[3];
      assert.ok(week);
      assert.equal((await setWeek(SUPER_ADMIN, week, FAMILY_2)).state, "success");
      const stale = await setWeek(SUPER_ADMIN, week, FAMILY_1);
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
    });

    it("BR62.1 repeated click: the same key gives the stored result", async () => {
      await makeDraft(db, schema);
      const week = (await rowsOf("water_carrying"))[2];
      assert.ok(week);
      const key = nextKey("week");
      const first = await setWeek(SUPER_ADMIN, week, FAMILY_2, key);
      const again = await setWeek(SUPER_ADMIN, week, FAMILY_2, key);
      assert.deepEqual([first.state, again.state, again.code], ["success", "success", "replayed"]);
    });

    it("BR62.1 two at once: the pair of one week cannot both go to one family", async () => {
      await makeDraft(db, schema);
      const all = await items();
      const indoor = all.find((w) => w.job === "indoor_cleaning" && w.family_id !== FAMILY_2);
      const garden = all.find(
        (w) => w.job === "front_garden" && w.week_start === indoor?.week_start,
      );
      assert.ok(indoor && garden);
      const [a, b] = await Promise.all([
        setWeek(SUPER_ADMIN, indoor, FAMILY_2),
        callFunction(second, schema, SUPER_ADMIN, "rota_week_set($1, $2, $3, $4)", [
          nextKey("week"),
          garden.id,
          FAMILY_2,
          garden.version,
        ]),
      ]);
      assert.deepEqual(
        [a.state, b.state].sort(),
        ["success", "validation"],
        JSON.stringify([a, b]),
      );
    });

    // ---- the plan read ------------------------------------------------------------------------------------

    it("BR62.2 the read holds every family's weeks per rota", async () => {
      await makeDraft(db, schema);
      const view = await readFullPlan(db, schema);
      assert.equal(view.items.length, (await schoolWeekStarts(db)).length * 4);
      for (const family of view.families) {
        for (const job of Object.keys(JOB_TITLES)) {
          const weeks = view.items.filter((w) => w.job === job && w.family_id === family.family_id);
          assert.equal(family.counts[job], weeks.length, `${family.family_id} ${job}`);
        }
      }
    });

    it("BR62.2 an uneven rota marks the family above the lowest", async () => {
      await makeDraft(db, schema);
      const weekend = (await rowsOf("weekend_animal_care")).filter((w) => w.family_id !== FAMILY_1);
      for (const week of weekend.slice(0, 4)) {
        assert.equal((await setWeek(SUPER_ADMIN, week, FAMILY_1)).state, "success");
      }
      const row = (await readFullPlan(db, schema)).families.find((f) => f.family_id === FAMILY_1);
      assert.ok(row?.above_lowest.includes("weekend_animal_care"));
    });

    it("BR62.3 an empty week blocks publishing, in any rota", async () => {
      const draft = await makeDraft(db, schema);
      for (const job of Object.keys(JOB_TITLES)) {
        const week = (await rowsOf(job))[1];
        assert.ok(week);
        assert.equal((await setWeek(SUPER_ADMIN, week, null)).state, "success");
        const view = await readFullPlan(db, schema);
        assert.equal(view.can_publish, false, job);
        const refused = await publish(db, schema, {
          id: draft.id,
          version: view.plan?.version ?? 0,
        });
        assert.deepEqual([refused.state, refused.code], ["validation", "ROTA_WEEKS_EMPTY"], job);
        const fresh = (await rowsOf(job)).find((w) => w.id === week.id);
        assert.ok(fresh);
        assert.equal((await setWeek(SUPER_ADMIN, fresh, week.family_id)).state, "success");
      }
      assert.equal((await readFullPlan(db, schema)).can_publish, true);
    });

    // ---- publishing ---------------------------------------------------------------------------------------

    it("BR62.4 publishing creates a duty for every week of three rotas and five for every weekend", async () => {
      const draft = await makeDraft(db, schema);
      const done = await publish(db, schema, draft);
      assert.equal(done.state, "success", JSON.stringify(done));
      const weeks = (await schoolWeekStarts(db)).length;
      for (const job of ["indoor_cleaning", "front_garden", "water_carrying"]) {
        assert.equal(await count(db, "tasks", `category = 'rota_${job}'`), weeks, job);
      }
      assert.equal(await count(db, "weekend_slots"), weeks * 5);
      assert.equal(await count(db, "tasks", "origin_kind = 'weekend_slot'"), weeks * 5);
      assert.equal(Number(done.duties), weeks * 8);
      const slots = await db.query(
        "select slot, count(*)::int as n from weekend_slots group by slot",
      );
      assert.deepEqual(slots.rows.map((r) => r.slot).sort(), [...SLOTS].sort());
      for (const row of slots.rows) assert.equal(row.n, weeks);
    });

    it("BR63.1 the weekend family holds all five places of its weekend", async () => {
      const draft = await makeDraft(db, schema);
      await publish(db, schema, draft);
      const rows = await db.query(
        "select rw.week_start, rw.family_id as weekend_family, count(a.id)::int as places, count(distinct a.family_id)::int as holders, min(a.family_id::text) as holder, min(a.source) as source, count(distinct t.id)::int as duties from weekend_slots s join rota_weeks rw on rw.id = s.weekend_week_id join tasks t on t.origin_kind = 'weekend_slot' and t.origin_id = s.id join assignments a on a.task_id = t.id and a.status = 'active' group by rw.id",
      );
      assert.ok(rows.rows.length > 0);
      for (const row of rows.rows) {
        assert.deepEqual(
          [row.places, row.holders, row.duties, row.holder, row.source],
          [5, 1, 5, row.weekend_family, "rota_publish"],
        );
      }
    });

    it("BR63.1 the weekend duties have their own titles, categories and times", async () => {
      const draft = await makeDraft(db, schema);
      await publish(db, schema, draft);
      const first = (
        await db.query(
          "select min(week_start)::text as d from rota_weeks where job = 'weekend_animal_care'",
        )
      ).rows[0].d as string;
      assert.equal(first, "2026-08-31");
      const rows = await db.query(
        "select t.title, t.category, t.capacity, t.group_id, to_char(t.starts_at at time zone 'Europe/Budapest', 'YYYY-MM-DD HH24:MI:SS') as s, to_char(t.ends_at at time zone 'Europe/Budapest', 'YYYY-MM-DD HH24:MI:SS') as e from tasks t join weekend_slots w on t.origin_id = w.id where t.origin_kind = 'weekend_slot' and w.weekend_week_id = (select id from rota_weeks where job = 'weekend_animal_care' and week_start = $1) order by t.starts_at, t.ends_at, t.title",
        [first],
      );
      const byTitle = new Map(rows.rows.map((r) => [r.title, r]));
      const expected: [string, string, string, string][] = [
        [
          "Szombat reggeli nyitás",
          "rota_weekend_opening",
          "2026-09-05 00:00:00",
          "2026-09-05 12:00:00",
        ],
        [
          "Szombat esti zárás",
          "rota_weekend_closing",
          "2026-09-05 12:00:00",
          "2026-09-05 23:59:59",
        ],
        [
          "Vasárnap reggeli nyitás",
          "rota_weekend_opening",
          "2026-09-06 00:00:00",
          "2026-09-06 12:00:00",
        ],
        [
          "Vasárnap esti zárás",
          "rota_weekend_closing",
          "2026-09-06 12:00:00",
          "2026-09-06 23:59:59",
        ],
        [
          "Hétvégi takarítás",
          "rota_shelter_cleaning",
          "2026-09-05 00:00:00",
          "2026-09-06 23:59:59",
        ],
      ];
      assert.equal(rows.rows.length, 5);
      for (const [title, category, from, to] of expected) {
        const row = byTitle.get(title);
        assert.deepEqual(
          [row?.category, row?.capacity, row?.group_id, row?.s, row?.e],
          [category, 1, null, from, to],
          title,
        );
      }
    });

    it("BR62.4 a second publish makes nothing new", async () => {
      const draft = await makeDraft(db, schema);
      await publish(db, schema, draft);
      const tasks = await count(db, "tasks", "origin_kind <> 'manual'");
      const again = await publish(db, schema, { id: draft.id, version: draft.version + 1 });
      assert.equal(again.code, "ROTA_PLAN_PUBLISHED");
      assert.equal(await count(db, "tasks", "origin_kind <> 'manual'"), tasks);
    });

    it("BR62.4 outdated screen: a stale plan version is refused", async () => {
      const draft = await makeDraft(db, schema);
      assert.equal(
        (await setWeek(SUPER_ADMIN, (await rowsOf("front_garden"))[0]!, FAMILY_2)).state,
        "success",
      );
      const stale = await publish(db, schema, draft);
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
    });

    it("BR62.4 out of reach: only a super admin publishes", async () => {
      const draft = await makeDraft(db, schema);
      for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G1, OTHER_ADMIN]) {
        assert.equal((await publish(db, schema, draft, account)).state, "denied", account);
      }
      assert.equal(await count(db, "tasks", "origin_kind <> 'manual'"), 0);
    });

    it("BR62.4 two at once: one publish wins and nothing is made twice", async () => {
      const draft = await makeDraft(db, schema);
      const [a, b] = await Promise.all([
        publish(db, schema, draft),
        callFunction(second, schema, SUPER_ADMIN, "rota_plan_publish($1, $2, $3)", [
          nextKey("publish"),
          draft.id,
          draft.version,
        ]),
      ]);
      assert.deepEqual([a.state, b.state].sort(), ["conflict", "success"]);
      const weeks = (await schoolWeekStarts(db)).length;
      assert.equal(await count(db, "tasks", "origin_kind <> 'manual'"), weeks * 8);
      assert.equal(await count(db, "weekend_slots"), weeks * 5);
    });

    it("BR62.4 a failure in the middle of publishing leaves nothing behind", async () => {
      const draft = await makeDraft(db, schema);
      await db.query(
        `create function "${schema}".forced_slot() returns trigger language plpgsql as $$ begin if new.slot = 'sunday_closing' then raise exception 'forced failure'; end if; return new; end $$`,
      );
      await db.query(
        `create trigger forced_slot before insert on "${schema}".weekend_slots for each row execute function "${schema}".forced_slot()`,
      );
      try {
        assert.ok(await failureOf(() => publish(db, schema, draft)), "the publish must fail");
      } finally {
        await db.query(`drop trigger forced_slot on "${schema}".weekend_slots`);
        await db.query(`drop function "${schema}".forced_slot()`);
      }
      assert.equal(
        (await db.query("select status from rota_plans where id = $1", [draft.id])).rows[0].status,
        "draft",
      );
      assert.equal(await count(db, "tasks", "origin_kind <> 'manual'"), 0);
      assert.equal(await count(db, "weekend_slots"), 0);
      assert.equal(await count(db, "assignments", "source = 'rota_publish'"), 0);
      assert.equal(await count(db, "notifications", "kind = 'rota_published'"), 0);
      assert.equal((await auditEvents(db)).filter((e) => e.action === "rota.publish").length, 0);
      assert.equal((await publish(db, schema, draft)).state, "success");
    });

    it("BR62.5 one notice for each parent lists only that family's weeks of every rota", async () => {
      const draft = await makeDraft(db, schema);
      await publish(db, schema, draft);
      const all = await items();
      const list = (await call(PARENT_F1, "notification_list()", [])) as unknown as {
        items: { title: string; text: string | null; link: string }[];
      };
      const notices = list.items.filter((n) => n.title === "Közzétették a beosztást");
      assert.equal(notices.length, 1);
      const text = notices[0]?.text ?? "";
      assert.equal(notices[0]?.link, "/szulo/beosztas");
      const mine = all.filter((w) => w.family_id === FAMILY_1);
      for (const job of Object.keys(JOB_TITLES)) {
        const weeks = mine.filter((w) => w.job === job).map((w) => dateText(w.week_start));
        if (weeks.length) {
          assert.ok(
            text.includes(`${JOB_TITLES[job]}, a ti heteitek: ${weeks.join("; ")}`),
            `${job} in ${text}`,
          );
        }
      }
      const others = all.filter((w) => w.family_id !== null && w.family_id !== FAMILY_1);
      const mineDates = new Set(mine.map((w) => w.week_start));
      const foreign = others.find((w) => !mineDates.has(w.week_start));
      assert.ok(foreign);
      assert.equal(text.includes(dateText(foreign.week_start).split(" – ")[0] ?? "?"), false);
      if (mine.some((w) => w.job === "indoor_cleaning" || w.job === "front_garden")) {
        assert.ok(text.includes("hétvégi feladatot"), text);
      }
    });

    it("BR62.5 a repeated publish with the same key sends no second notice", async () => {
      const draft = await makeDraft(db, schema);
      const key = nextKey("publish");
      await publish(db, schema, draft, SUPER_ADMIN, key);
      const before = await count(db, "notifications", "kind = 'rota_published'");
      assert.ok(before > 0);
      await publish(db, schema, draft, SUPER_ADMIN, key);
      assert.equal(await count(db, "notifications", "kind = 'rota_published'"), before);
    });

    it("BR62.5 one audit event for the whole publish", async () => {
      const draft = await makeDraft(db, schema);
      await publish(db, schema, draft);
      assert.equal((await auditEvents(db)).filter((e) => e.action === "rota.publish").length, 1);
    });

    // ---- the weekend duties are protected like the other rota duties (BR63.4) -------------------------------

    it("BR63.4 each change function refuses a weekend duty", async () => {
      const draft = await makeDraft(db, schema);
      await publish(db, schema, draft);
      const duty = (
        await db.query(
          "select t.id as task_id, t.version as task_version, a.id as place_id, a.version as place_version, a.family_id from tasks t join assignments a on a.task_id = t.id where t.origin_kind = 'weekend_slot' and a.family_id = $1 order by t.starts_at limit 1",
          [FAMILY_1],
        )
      ).rows[0] as
        | { task_id: string; task_version: number; place_id: string; place_version: number }
        | undefined;
      assert.ok(duty, "the first family holds a weekend duty");
      const refused = async (
        account: string,
        sql: string,
        values: unknown[],
        code = "DUTY_ROTA_MANAGED",
      ) => {
        const result = await call(account, sql, values);
        assert.deepEqual([result.state, result.code], ["conflict", code], sql);
      };
      await refused(PARENT_F2, "duty_sign_up($1, $2, $3)", [
        nextKey("a"),
        duty.task_id,
        duty.task_version,
      ]);
      await refused(SUPER_ADMIN, "assignment_assign($1, $2, $3, $4)", [
        nextKey("a"),
        duty.task_id,
        FAMILY_2,
        duty.task_version,
      ]);
      await refused(SUPER_ADMIN, "assignment_remove($1, $2, $3)", [
        nextKey("a"),
        duty.place_id,
        duty.place_version,
      ]);
      // U7: a weekend slot duty follows its week, so a swap of it has its own refusal.
      await refused(
        PARENT_F1,
        "swap_request($1, $2, $3, $4, $5, null)",
        [nextKey("a"), duty.place_id, duty.place_version, ASSIGNMENT_F2_T3, 1],
        "SWAP_SLOT_FOLLOWS_WEEK",
      );
      // U7: cancelling a rota duty is a request now; this one is refused for its own reason.
      await refused(
        PARENT_F1,
        "cancellation_request($1, $2, $3, null)",
        [nextKey("a"), duty.place_id, duty.place_version],
        "SWAP_SLOT_FOLLOWS_WEEK",
      );
      await refused(SUPER_ADMIN, "task_save($1, $2::jsonb)", [
        nextKey("a"),
        JSON.stringify({ id: duty.task_id, expected_version: duty.task_version, title: "Más" }),
      ]);
      assert.equal(await count(db, "tasks", "title = 'Más'"), 0);
    });

    it("BR63.4 weekend duties stay out of the parents' duty list", async () => {
      const draft = await makeDraft(db, schema);
      await publish(db, schema, draft);
      const list = (await call(PARENT_F1, "duty_list()", [])) as unknown as {
        items: { title: string }[];
      };
      for (const title of Object.values(JOB_TITLES)) {
        assert.equal(
          list.items.some((i) => i.title === title),
          false,
          title,
        );
      }
      assert.equal(
        list.items.some((i) => i.title.startsWith("Szombat") || i.title.startsWith("Vasárnap")),
        false,
      );
    });
  });
}
