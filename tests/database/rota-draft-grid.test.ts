import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  DIRECTORY_SCHEMAS,
  openDirectoryDatabase,
  ORGANIZATION,
  uuid,
  YEAR_1,
} from "./directory-support.ts";
import { seedRotaWorld, setChangeover } from "./rota-full-support.ts";

/**
 * The grid tests of the four-rota draft (NFR6.4, BR61.1 to BR61.6): the draft function is run for many family counts,
 * break patterns and mixes of leaving and new families, each inside a transaction that is rolled back, and the
 * properties of the result are asserted with the rows it returns. All families here are invented.
 */
const JOBS = ["indoor_cleaning", "front_garden", "water_carrying", "weekend_animal_care"] as const;
type Row = { job: string; week: string; family: string | null; reason: string | null };

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`draft grid in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(() => seedRotaWorld(db, schema));

    const weekStarts = async () =>
      (
        await db.query(
          "select to_char(week_start, 'YYYY-MM-DD') as d, is_break from school_weeks($1) order by week_start",
          [YEAR_1],
        )
      ).rows.map((row) => ({ week: String(row.d), isBreak: Boolean(row.is_break) }));

    const compute = async (): Promise<Row[]> =>
      (
        await db.query(
          "select o_job as job, to_char(o_week_start, 'YYYY-MM-DD') as week, o_family_id as family, o_empty_reason as reason from rota_draft_compute($1, $2) order by o_week_start, o_job",
          [ORGANIZATION, YEAR_1],
        )
      ).rows.map((row) => ({
        job: String(row.job),
        week: String(row.week),
        family: (row.family as string | null) ?? null,
        reason: (row.reason as string | null) ?? null,
      }));

    /**
     * Runs `body` inside a transaction that is rolled back: the existing families are archived, `count` invented
     * families named "Teszt család 01" and so on are added, and `prepare` may add break weeks and standings.
     */
    const withGrid = async (
      count: number,
      prepare: ((families: string[]) => Promise<void>) | null,
      body: (families: string[], rows: Row[]) => Promise<void>,
    ) => {
      await db.query("begin");
      try {
        await db.query(
          "update families set status = 'archived', archived_at = now() where organization_id = $1",
          [ORGANIZATION],
        );
        const families: string[] = [];
        for (let index = 1; index <= count; index++) {
          const id = uuid(9800 + index);
          await db.query(
            "insert into families (id, organization_id, display_name) values ($1, $2, $3)",
            [id, ORGANIZATION, `Teszt család ${String(index).padStart(2, "0")}`],
          );
          families.push(id);
        }
        if (prepare) await prepare(families);
        await body(families, await compute());
      } finally {
        await db.query("rollback");
      }
    };

    const standing = (family: string, value: "leaving" | "new") =>
      db.query(
        "insert into family_year_standings (organization_id, family_id, school_year_id, standing) values ($1, $2, $3, $4)",
        [ORGANIZATION, family, YEAR_1, value],
      );

    const countsOf = (rows: Row[], job: string, families: string[]) =>
      families.map((id) => rows.filter((r) => r.job === job && r.family === id).length);

    // ---- BR61.1: four rows for every school week -------------------------------------------------------

    for (const size of [1, 2, 3, 20, 30]) {
      it(`BR61.1 ${size} families: four rows per week, no break week for indoor cleaning and water carrying`, async () => {
        const weeks = await weekStarts();
        await withGrid(size, null, async (_families, rows) => {
          assert.equal(rows.length, weeks.length * 4);
          for (const job of JOBS) {
            assert.deepEqual(
              rows.filter((r) => r.job === job).map((r) => r.week),
              weeks.map((w) => w.week),
              job,
            );
          }
        });
      });
    }

    it("BR61.1 break weeks: no indoor-cleaning or water-carrying family, a front-garden and weekend family", async () => {
      const weeks = await weekStarts();
      const breaks = [weeks[3]?.week, weeks[4]?.week, weeks[20]?.week].filter(Boolean) as string[];
      await withGrid(
        6,
        async () => {
          for (const week of breaks)
            await db.query(
              "insert into break_weeks (organization_id, school_year_id, week_start) values ($1, $2, $3)",
              [ORGANIZATION, YEAR_1, week],
            );
        },
        async (_families, rows) => {
          for (const week of breaks) {
            for (const job of ["indoor_cleaning", "water_carrying"]) {
              const row = rows.find((r) => r.job === job && r.week === week);
              assert.deepEqual([row?.family, row?.reason], [null, null], `${job} ${week}`);
            }
            for (const job of ["front_garden", "weekend_animal_care"]) {
              assert.ok(
                rows.find((r) => r.job === job && r.week === week)?.family,
                `${job} ${week}`,
              );
            }
          }
          const free = rows.filter((r) => r.job === "indoor_cleaning" && !breaks.includes(r.week));
          assert.ok(free.every((r) => r.family !== null));
        },
      );
    });

    // ---- BR61.2: the same-week rule --------------------------------------------------------------------

    for (const size of [2, 3, 6, 20]) {
      it(`BR61.2 ${size} families: front garden never takes the indoor-cleaning family of the week`, async () => {
        await withGrid(size, null, async (_families, rows) => {
          const indoor = new Map(
            rows.filter((r) => r.job === "indoor_cleaning").map((r) => [r.week, r.family]),
          );
          for (const garden of rows.filter((r) => r.job === "front_garden" && r.family !== null)) {
            assert.notEqual(garden.family, indoor.get(garden.week), garden.week);
          }
        });
      });
    }

    it("BR61.6 one family: front garden is empty with rule_clash wherever it holds indoor cleaning", async () => {
      await withGrid(1, null, async ([only], rows) => {
        const gardens = rows.filter((r) => r.job === "front_garden");
        const indoor = new Map(
          rows.filter((r) => r.job === "indoor_cleaning").map((r) => [r.week, r.family]),
        );
        for (const garden of gardens) {
          if (indoor.get(garden.week) === only) {
            assert.deepEqual([garden.family, garden.reason], [null, "rule_clash"], garden.week);
          } else {
            assert.equal(garden.family, only);
          }
        }
        assert.ok(gardens.some((g) => g.reason === "rule_clash"));
      });
    });

    it("BR61.6 no active family: every row empty with no_family, except the break weeks", async () => {
      await withGrid(0, null, async (_families, rows) => {
        const weeks = await weekStarts();
        const breaks = new Set(weeks.filter((w) => w.isBreak).map((w) => w.week));
        for (const row of rows) {
          assert.equal(row.family, null);
          const skipped =
            breaks.has(row.week) && ["indoor_cleaning", "water_carrying"].includes(row.job);
          assert.equal(row.reason, skipped ? null : "no_family", `${row.job} ${row.week}`);
        }
      });
    });

    // ---- BR61.3, BR61.5: even spread and the same result every time -----------------------------------

    for (const size of [2, 3, 6, 20, 30]) {
      it(`BR61.5 ${size} families: every rota is spread within one week`, async () => {
        await withGrid(size, null, async (families, rows) => {
          for (const job of JOBS) {
            const counts = countsOf(rows, job, families);
            assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `${job} ${counts.join(",")}`);
          }
        });
      });
    }

    it("BR61.3 the same input gives the same rows", async () => {
      await withGrid(20, null, async (_families, first) => {
        assert.deepEqual(await compute(), first);
        assert.deepEqual(await compute(), first);
      });
    });

    it("BR61.3 the first week goes to the family at (year of the start) modulo the number of families", async () => {
      await withGrid(6, null, async (families, rows) => {
        const first = rows.find((r) => r.job === "indoor_cleaning");
        assert.equal(first?.family, families[2026 % 6]);
      });
    });

    // ---- BR61.4: families that leave or join part-way ----------------------------------------------------

    it("BR60.2 BR61.4 mix of leaving and new: nobody holds a week on the wrong side of the changeover", async () => {
      const weeks = await weekStarts();
      const changeover = weeks[Math.floor(weeks.length / 2)]?.week ?? "";
      await withGrid(
        8,
        async (families) => {
          await setChangeover(db, changeover);
          await standing(families[0] as string, "leaving");
          await standing(families[1] as string, "leaving");
          await standing(families[6] as string, "new");
          await standing(families[7] as string, "new");
        },
        async (families, rows) => {
          for (const row of rows.filter((r) => r.family !== null)) {
            if (row.family === families[0] || row.family === families[1]) {
              assert.ok(
                row.week < changeover,
                `${row.family} holds ${row.week} after the changeover`,
              );
            }
            if (row.family === families[6] || row.family === families[7]) {
              assert.ok(
                row.week >= changeover,
                `${row.family} holds ${row.week} before the changeover`,
              );
            }
          }
          // They are not left out: a part-year family holds weeks in its own half, in every rota that has room.
          for (const id of [families[0], families[1], families[6], families[7]]) {
            assert.ok(
              rows.some((r) => r.family === id && r.job === "indoor_cleaning"),
              String(id),
            );
          }
          // The full-year families stay within one week of each other in every rota (BR61.5).
          const full = families.slice(2, 6);
          for (const job of JOBS) {
            const counts = countsOf(rows, job, full);
            assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `${job} ${counts.join(",")}`);
          }
        },
      );
    });

    it("BR61.4 a family that joins part-way starts level with the others, not far behind", async () => {
      const weeks = await weekStarts();
      const changeover = weeks[Math.floor(weeks.length / 2)]?.week ?? "";
      await withGrid(
        5,
        async (families) => {
          await setChangeover(db, changeover);
          await standing(families[4] as string, "new");
        },
        async (families, rows) => {
          const late = rows.filter((r) => r.job === "indoor_cleaning" && r.week >= changeover);
          const fresh = late.filter((r) => r.family === families[4]).length;
          const others = families
            .slice(0, 4)
            .map((id) => late.filter((r) => r.family === id).length);
          assert.ok(fresh >= Math.min(...others) - 1, `${fresh} against ${others.join(",")}`);
        },
      );
    });

    it("BR61.6 every family leaving in the second half: those weeks stay empty with no_family", async () => {
      const weeks = await weekStarts();
      const changeover = weeks[Math.floor(weeks.length / 2)]?.week ?? "";
      await withGrid(
        3,
        async (families) => {
          await setChangeover(db, changeover);
          for (const id of families) await standing(id, "leaving");
        },
        async (_families, rows) => {
          const late = rows.filter((r) => r.week >= changeover);
          for (const row of late) assert.equal(row.family, null, `${row.job} ${row.week}`);
          assert.ok(late.some((r) => r.reason === "no_family"));
        },
      );
    });

    // ---- BR61.3: other years, other starts of the cycle ----------------------------------------------------

    it("BR61.3 a school year starting in another calendar year starts the cycle elsewhere", async () => {
      await withGrid(
        6,
        async () => {
          await db.query(
            "update school_years set starts_on = (starts_on + interval '1 year')::date, ends_on = (ends_on + interval '1 year')::date, changeover_date = (changeover_date + interval '1 year')::date where id = $1",
            [YEAR_1],
          );
        },
        async (families, rows) => {
          const first = rows.find((r) => r.job === "indoor_cleaning");
          assert.equal(first?.family, families[2027 % 6]);
        },
      );
    });
  });
}
