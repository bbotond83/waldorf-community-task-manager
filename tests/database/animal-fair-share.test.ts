import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  callFunction,
  DIRECTORY_SCHEMAS,
  FAMILY_2,
  openDirectoryDatabase,
  ORGANIZATION,
  OUTSIDER,
  YEAR_1,
} from "./directory-support.ts";
import { setChangeover, setStanding } from "./rota-full-support.ts";
import {
  FAMILY_1,
  PARENT_F1,
  PARENT_F2,
  seedAnimalWorld,
  slotAfter,
  TEACHER_G1,
} from "./animal-support.ts";

/**
 * The fair share (W4; BR83.1 to BR83.5), worked out when read: counted families, slots held, active weeks, the
 * average and each family's own share. Reads only, so "outdated screen", "repeated click" and "two people at once"
 * do not apply (nothing is written).
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`animal fair share in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(() => seedAnimalWorld(db, schema));

    const share = (account: string, year = YEAR_1) =>
      callFunction(db, schema, account, "animal_fair_share($1)", [year]);
    const hold = async (family: string, count: number) => {
      for (let i = 0; i < count; i += 1) {
        const slot = await slotAfter(
          db,
          3,
          i % 2 === 0 ? "morning" : "afternoon",
          Math.floor(i / 2),
        );
        await db.query(
          "insert into assignments (organization_id, task_id, family_id, source) values ($1, $2, $3, 'admin_assign')",
          [ORGANIZATION, slot.duty_id, family],
        );
      }
    };
    const activeFamilies = async () =>
      Number(
        (
          await db.query(
            "select count(*)::int as n from families where organization_id = $1 and status = 'active'",
            [ORGANIZATION],
          )
        ).rows[0].n,
      );

    type Row = {
      family_name: string;
      count: number;
      share: number;
      mine: boolean;
      active_weeks: number;
    };

    it("is zero for everyone when no slot is held, with the caller's family first", async () => {
      const result = await share(PARENT_F2);
      assert.equal(result.state, "success");
      const families = result.families as Row[];
      assert.equal(families.length, await activeFamilies());
      assert.ok(families.every((f) => f.count === 0 && f.share === 0));
      assert.equal(families[0]!.mine, true);
      assert.equal(result.average, 0);
    });

    it("shares the held slots evenly between families that are there all year", async () => {
      await hold(FAMILY_1, 6);
      const result = await share(PARENT_F2);
      const n = await activeFamilies();
      const expected = Math.round((6 / n) * 10) / 10;
      assert.equal(result.average, expected);
      const mine = result.mine as Row;
      assert.deepEqual([mine.count, mine.share], [0, expected]);
      const first = (result.families as Row[]).find((f) => f.count === 6)!;
      assert.equal(first.share, expected);
    });

    it("gives a leaving family a smaller share by its active weeks (BR83.3)", async () => {
      await hold(FAMILY_1, 8);
      await setChangeover(db, "2026-11-01");
      await setStanding(db, schema, FAMILY_2, "leaving");
      const result = await share(PARENT_F1);
      const families = result.families as Row[];
      const leaving = families.find(
        (f) => f.active_weeks < Math.max(...families.map((x) => x.active_weeks)),
      )!;
      const staying = families.find((f) => f.mine)!;
      assert.ok(leaving.share < staying.share, JSON.stringify(families));
    });

    it("lets every member of the community read it and nobody else (refused, out of reach)", async () => {
      assert.equal((await share(TEACHER_G1)).state, "success");
      assert.equal((await share(OUTSIDER)).state, "denied");
      assert.equal((await share("bbbbbbbb-0000-4000-8000-0000000000ff")).state, "denied");
      const foreign = await callFunction(db, schema, PARENT_F1, "animal_fair_share($1)", [
        "cccccccc-0000-4000-8000-000000000502",
      ]);
      assert.equal(foreign.state, "denied");
    });

    it("returns no contact detail", async () => {
      await hold(FAMILY_1, 2);
      const text = JSON.stringify(await share(PARENT_F1));
      assert.ok(!text.includes("@") && !/\+36/.test(text));
    });
  });
}
