import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, FAMILY_2, openDirectoryDatabase } from "./directory-support.ts";
import { PARENT_F2 } from "./identity-support.ts";
import {
  auditRows,
  caller,
  COMMUNITY_EVENT,
  FOOD_EVENT,
  GROUP_EVENT,
  seedEventWorld,
} from "./events-support.ts";
import { count } from "./identity-support.ts";
import { openDatabase } from "./stack-support.ts";
import { nextKey } from "./directory-support.ts";
import { PARENT_ROW_F1, PARENT_ROW_F2, FAMILY_1, SUPER_ADMIN } from "./working-groups-support.ts";

/**
 * The removal block of U10 (C16, BR124.1, BR124.2) on the fixed list: allowed (a parent and a family), refused and out
 * of reach (the functions are internal, checked in events-for-later-units.test.ts), repeated click (a second
 * application changes nothing more). Outdated screen does not exist for a step that takes no version (it answers nothing the screen could have shown stale); two at once is the last test below
 * and runs inside U14's transaction under the family lock; its own lock order is checked by the rows it touches.
 */
type Result = Awaited<ReturnType<ReturnType<typeof caller>>>;

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`event removal block in ${schema}`, () => {
    let db: pg.Client;
    let other: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      other = await openDatabase();
    });
    after(async () => {
      await other.end();
      await db.end();
    });
    beforeEach(async () => {
      await seedEventWorld(db, schema);
      await db.query("update parents set display_name = 'Fenyő Anna' where id = $1", [
        PARENT_ROW_F1,
      ]);
      await db.query(
        "insert into event_signups (organization_id, event_id, parent_id, family_id, note) values ((select organization_id from parents where id = $2), $1, $2, $3, 'jegyzet'), ((select organization_id from parents where id = $4), $1, $4, $5, 'másik')",
        [COMMUNITY_EVENT, PARENT_ROW_F1, FAMILY_1, PARENT_ROW_F2, FAMILY_2],
      );
      await db.query(
        "insert into food_offers (organization_id, event_id, parent_id, category, text) select organization_id, $1, $2, 'sweet', 'Pite' from parents where id = $2",
        [FOOD_EVENT, PARENT_ROW_F1],
      );
      await db.query(
        "insert into event_roles (organization_id, event_id, name, parent_id, is_organiser) select organization_id, $1, 'Szervező', $2, true from parents where id = $2",
        [GROUP_EVENT, PARENT_ROW_F1],
      );
      await db.query(
        "insert into event_roles (organization_id, event_id, name, person_name) select organization_id, $1, 'Zenész', 'Fenyő Anna' from events where id = $1",
        [COMMUNITY_EVENT],
      );
      await db.query(
        "insert into event_roles (organization_id, event_id, name, person_name) select organization_id, $1, 'Fotós', 'Más Valaki' from events where id = $1",
        [COMMUNITY_EVENT],
      );
    });

    const call = caller(() => db, schema);
    const apply = async (kind: string, id: string) =>
      (await db.query("select events_removal_apply($1, $2) as r", [kind, id])).rows[0].r as {
        to_clear: number;
        to_flag: number;
      };
    const preview = async (kind: string, id: string) =>
      (await db.query("select events_removal_preview($1, $2) as r", [kind, id])).rows[0].r as {
        to_clear: number;
        to_flag: number;
      };

    it("allowed: the preview counts what the step will clear and changes nothing", async () => {
      const before = await preview("parent", PARENT_ROW_F1);
      assert.deepEqual(before, { to_clear: 4, to_flag: 0 });
      assert.equal(await count(db, "event_signups", "parent_id is not null"), 2);
    });

    it("allowed: removing a parent anonymises their sign-up and offer, clears the organiser mark and an exact typed name, and keeps the rows", async () => {
      const result = await apply("parent", PARENT_ROW_F1);
      assert.equal(result.to_clear, 4);
      assert.equal(await count(db, "event_signups"), 2, "the rows stay");
      assert.equal(await count(db, "event_signups", `parent_id = '${PARENT_ROW_F1}'`), 0);
      assert.equal(
        await count(
          db,
          "event_signups",
          "note is null and parent_id is null and family_id is null",
        ),
        1,
        "U14 NFR1.3: the removed person's own note is emptied",
      );
      assert.equal(await count(db, "food_offers", "parent_id is null and text = '—'"), 1);
      assert.equal(
        await count(
          db,
          "event_roles",
          "parent_id is null and is_organiser = false and person_name is null",
        ),
        2,
      );
      assert.equal(
        await count(db, "event_roles", "person_name = 'Más Valaki'"),
        1,
        "a different typed name stays",
      );
      assert.equal(
        await count(db, "event_signups", `parent_id = '${PARENT_ROW_F2}'`),
        1,
        "another family's rows stay",
      );
      assert.equal((await auditRows(db, "event.removal_applied")).length, 1);
    });

    it("allowed: the removed parent's rows show korábbi tag through the page and no name remains", async () => {
      await apply("parent", PARENT_ROW_F1);
      const page = (await call(SUPER_ADMIN, "event_get($1)", [COMMUNITY_EVENT])) as Result & {
        signups: { parent_display_name: string }[];
        roles: { display_name: string }[];
      };
      assert.ok(page.signups.some((entry) => entry.parent_display_name === "korábbi tag"));
      assert.equal(JSON.stringify(page).includes("Fenyő Anna"), false);
    });

    it("allowed: removing a family clears its sign-ups by family and every parent's offers and roles", async () => {
      const result = await apply("family", FAMILY_1);
      assert.ok(result.to_clear >= 4);
      assert.equal(await count(db, "event_signups", `family_id = '${FAMILY_1}'`), 0);
      assert.equal(await count(db, "food_offers", "parent_id is not null"), 0);
    });

    it("repeated click: a second application changes nothing more and an unknown subject is a no-op", async () => {
      await apply("parent", PARENT_ROW_F1);
      assert.equal((await apply("parent", PARENT_ROW_F1)).to_clear, 0);
      assert.deepEqual(await apply("parent", "99999999-0000-4000-8000-00000000000b"), {
        to_clear: 0,
        to_flag: 0,
      });
      assert.deepEqual(await apply("child", PARENT_ROW_F1), { to_clear: 0, to_flag: 0 });
    });

    it("two at once: a sign-up made while a removal holds the event waits for it, then lands after it without a deadlock", async () => {
      await db.query("begin");
      let released = false;
      try {
        await apply("parent", PARENT_ROW_F1);
        const waiting = caller(() => other, schema)(
          PARENT_F2,
          "event_signup_add($1, $2, 'késői jelentkezés', null)",
          [nextKey("removal-race"), COMMUNITY_EVENT],
        );
        const early = await Promise.race([
          waiting.then((a) => `finished:${JSON.stringify(a)}`),
          new Promise((resolve) => setTimeout(() => resolve("waiting"), 400)),
        ]);
        assert.equal(early, "waiting", "the sign-up waits for the event lock the removal holds");
        await db.query("commit");
        released = true;
        const answer = await waiting;
        assert.ok(["success", "conflict", "denied"].includes(answer.state), answer.state);
      } finally {
        if (!released) await db.query("rollback");
      }
      assert.equal(await count(db, "event_signups", `parent_id = '${PARENT_ROW_F1}'`), 0);
    });
  });
}
