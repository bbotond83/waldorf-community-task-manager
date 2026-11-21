import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, nextKey, openDirectoryDatabase } from "./directory-support.ts";
import { caller, COMMUNITY_EVENT, FOOD_EVENT, seedEventWorld } from "./events-support.ts";
import { count } from "./identity-support.ts";
import { openDatabase } from "./stack-support.ts";
import { PARENT_F1, SUPER_ADMIN } from "./working-groups-support.ts";

/**
 * The races of U10 (NFR5.1 to NFR5.6): many callers at once against the limits and against a cancellation. Each run
 * uses its own connections, so the event lock (not a client-side queue) decides who passes.
 */
const RUNS = 10;

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`event races in ${schema}`, () => {
    let db: pg.Client;
    let pool: pg.Client[];
    before(async () => {
      db = await openDirectoryDatabase(schema);
      pool = await Promise.all(Array.from({ length: 4 }, () => openDatabase()));
    });
    after(async () => {
      await Promise.all(pool.map((connection) => connection.end()));
      await db.end();
    });
    beforeEach(() => seedEventWorld(db, schema));

    /** Runs `total` calls in waves with one call in flight per connection, the calls of a wave at the same time. */
    async function attempts(
      total: number,
      make: (index: number, connection: pg.Client) => Promise<{ state: string }>,
    ): Promise<{ state: string }[]> {
      const results: { state: string }[] = [];
      for (let start = 0; start < total; start += pool.length) {
        const wave = pool.slice(0, Math.min(pool.length, total - start));
        results.push(
          ...(await Promise.all(
            wave.map((connection, offset) => make(start + offset, connection)),
          )),
        );
      }
      return results;
    }

    it("never lets a parent pass ten sign-ups per event, whatever the order of arrival", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        await db.query("truncate event_signups");
        const answers = await attempts(14, (index, connection) =>
          caller(() => connection, schema)(PARENT_F1, "event_signup_add($1, $2, $3, null)", [
            nextKey(`race${run}`),
            COMMUNITY_EVENT,
            `Tétel ${index}`,
          ]),
        );
        assert.equal(
          answers.filter((answer) => answer.state === "success").length,
          10,
          `run ${run}`,
        );
        assert.equal(await count(db, "event_signups"), 10);
      }
    });

    it("never lets a parent pass twenty food offers per event", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        await db.query("truncate food_offers");
        const answers = await attempts(24, (index, connection) =>
          caller(() => connection, schema)(
            PARENT_F1,
            "food_offer_add($1, $2, 'other', $3, false, false, false)",
            [nextKey(`food${run}`), FOOD_EVENT, `Étel ${index}`],
          ),
        );
        assert.equal(
          answers.filter((answer) => answer.state === "success").length,
          20,
          `run ${run}`,
        );
      }
    });

    it("a sign-up and a cancellation at once end in one consistent state: a sign-up either landed before the cancel or was refused", async () => {
      for (let run = 0; run < RUNS; run += 1) {
        await db.query("truncate event_signups");
        await db.query("update events set status = 'planned' where id = $1", [COMMUNITY_EVENT]);
        const stored = (await db.query("select * from events where id = $1", [COMMUNITY_EVENT]))
          .rows[0];
        const cancel = caller(() => pool[0]!, schema)(SUPER_ADMIN, "event_save($1, $2::jsonb)", [
          nextKey("cancel"),
          JSON.stringify({
            id: COMMUNITY_EVENT,
            expected_version: stored.version,
            title: stored.title,
            starts_at: stored.starts_at.toISOString(),
            ends_at: stored.ends_at.toISOString(),
            status: "cancelled",
          }),
        ]);
        const signUp = caller(() => pool[1]!, schema)(
          PARENT_F1,
          "event_signup_add($1, $2, 'x', null)",
          [nextKey("su"), COMMUNITY_EVENT],
        );
        const [cancelled, signed] = await Promise.all([cancel, signUp]);
        assert.equal(cancelled.state, "success", `run ${run}`);
        assert.ok(["success", "conflict"].includes(signed.state), `run ${run}: ${signed.state}`);
        assert.equal(await count(db, "event_signups"), signed.state === "success" ? 1 : 0);
      }
    });
  });
}
