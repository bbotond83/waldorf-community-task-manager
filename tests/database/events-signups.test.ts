import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  countAs,
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  nextKey,
  openDirectoryDatabase,
  OTHER_ADMIN,
  OUTSIDER,
  SIGNED_OUT,
  TEACHER_G1,
} from "./directory-support.ts";
import {
  auditRows,
  CANCELLED_EVENT,
  caller,
  COMMUNITY_EVENT,
  FOOD_EVENT,
  inDays,
  PAST_EVENT,
  seedEventWorld,
} from "./events-support.ts";
import { count, failureOf } from "./identity-support.ts";
import { openDatabase } from "./stack-support.ts";
import { ADMIN_G1, PARENT_F1, PARENT_F2, SUPER_ADMIN } from "./working-groups-support.ts";

/**
 * The sign-up and food-offer rules of U10 (W4, W7; BR108.1 to BR116.1, NFR1.3) on the fixed list. The reads (event_get
 * with the sign-ups and the offers) have no stale screen and no repeated click. The 50-run races are in
 * events-signups-races.test.ts.
 */
type Result = Awaited<ReturnType<ReturnType<typeof caller>>>;
type Page = Result & {
  signups: {
    id: string;
    note: string | null;
    is_own: boolean;
    parent_display_name: string;
    version: number;
  }[];
  food: {
    on: boolean;
    categories: { category: string; offers: { id: string; text: string; is_own: boolean }[] }[];
  };
};

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`event sign-ups and food offers in ${schema}`, () => {
    let db: pg.Client;
    let second: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      second = await openDatabase();
    });
    after(async () => {
      await second.end();
      await db.end();
    });
    beforeEach(() => seedEventWorld(db, schema));

    const call = caller(() => db, schema);
    const callSecond = caller(() => second, schema);
    const outcome = (result: Result) => [result.state, result.code];
    const signUp = (
      account: string,
      event: string,
      note: string | null = "Hozok sütit",
      at: string | null = null,
      key = nextKey("s"),
    ) => call(account, "event_signup_add($1, $2, $3, $4)", [key, event, note, at]);
    const change = (
      account: string,
      id: string,
      version: number,
      note: string | null,
      at: string | null = null,
    ) =>
      call(account, "event_signup_change($1, $2, $3, $4, $5)", [
        nextKey("c"),
        id,
        version,
        note,
        at,
      ]);
    const withdraw = (account: string, id: string, version: number, key = nextKey("w")) =>
      call(account, "event_signup_withdraw($1, $2, $3)", [key, id, version]);
    const offer = (
      account: string,
      event: string,
      category = "sweet",
      text = "Pite",
      milk = false,
      egg = false,
      garlic = false,
      key = nextKey("o"),
    ) =>
      call(account, "food_offer_add($1, $2, $3, $4, $5, $6, $7)", [
        key,
        event,
        category,
        text,
        milk,
        egg,
        garlic,
      ]);
    const page = async (account: string, event: string) =>
      (await call(account, "event_get($1)", [event])) as Page;

    describe("W4 sign-up with a note", () => {
      it("allowed: a parent signs up with a note and a time inside the event, changes it and withdraws it", async () => {
        const first = await signUp(PARENT_F1, COMMUNITY_EVENT, "Hozok sütit", inDays(10.02));
        assert.deepEqual([first.state, first.version], ["success", 1]);
        const view = await page(PARENT_F2, COMMUNITY_EVENT);
        assert.equal(view.signups[0]!.is_own, false, "another parent sees it as not their own");
        assert.equal((await page(PARENT_F1, COMMUNITY_EVENT)).signups[0]!.is_own, true);
        const changed = await change(PARENT_F1, first.reference!, 1, "Hozok pitét");
        assert.deepEqual([changed.state, changed.version], ["success", 2]);
        assert.equal((await withdraw(PARENT_F1, first.reference!, 2)).state, "success");
        assert.equal(await count(db, "event_signups"), 0);
        assert.equal(
          (await auditRows(db, "event.signup_removed")).length,
          0,
          "an owner's own withdrawal is not audited",
        );
      });
      it("allowed: the deadline informs and blocks nothing; a sign-up is not a duty and touches no rota table", async () => {
        await db.query(
          "update events set signup_deadline = (now() at time zone 'Europe/Budapest')::date - 1 where id = $1",
          [COMMUNITY_EVENT],
        );
        const before = await count(db, "assignments");
        assert.equal((await signUp(PARENT_F1, COMMUNITY_EVENT)).state, "success");
        assert.equal(await count(db, "assignments"), before);
      });
      it("allowed: ten sign-ups per parent and event, the eleventh is refused", async () => {
        for (let index = 0; index < 10; index += 1) {
          assert.equal(
            (await signUp(PARENT_F1, COMMUNITY_EVENT, `Tétel ${index}`)).state,
            "success",
          );
        }
        assert.deepEqual(outcome(await signUp(PARENT_F1, COMMUNITY_EVENT)), [
          "validation",
          "EVENT_LIMIT_REACHED",
        ]);
        assert.equal(
          (await signUp(PARENT_F2, COMMUNITY_EVENT)).state,
          "success",
          "the limit is per parent",
        );
      });
      it("refused: a closed, finished or cancelled event, a long note, a time outside the event, a teacher, no session", async () => {
        for (const event of [PAST_EVENT, CANCELLED_EVENT]) {
          assert.deepEqual(outcome(await signUp(PARENT_F1, event)), ["conflict", "EVENT_CLOSED"]);
        }
        assert.equal((await signUp(PARENT_F1, COMMUNITY_EVENT, "x".repeat(501))).field, "note");
        const outside = await signUp(PARENT_F1, COMMUNITY_EVENT, "x", inDays(30));
        assert.deepEqual([outside.field, outside.reason], ["chosen_at", "outside_event"]);
        for (const account of [TEACHER_G1, SUPER_ADMIN, OUTSIDER]) {
          assert.deepEqual(
            outcome(await signUp(account, COMMUNITY_EVENT)),
            ["denied", "authorization_denied"],
            account,
          );
        }
        for (const account of [DEACTIVATED, SIGNED_OUT]) {
          assert.deepEqual(outcome(await signUp(account, COMMUNITY_EVENT)), [
            "denied",
            "session_inactive",
          ]);
        }
        assert.equal(await count(db, "event_signups"), 0);
      });
      it("out of reach: another family's sign-up and a made-up id give the same denied answer; another community's event is unavailable", async () => {
        const mine = await signUp(PARENT_F1, COMMUNITY_EVENT);
        const real = await change(PARENT_F2, mine.reference!, 1, "Elvenném");
        const made = await change(PARENT_F2, "99999999-0000-4000-8000-000000000006", 1, "Elvenném");
        assert.deepEqual(real, made);
        assert.deepEqual(outcome(real), ["denied", "authorization_denied"]);
        assert.deepEqual(
          await withdraw(PARENT_F2, mine.reference!, 1),
          await withdraw(PARENT_F2, "99999999-0000-4000-8000-000000000006", 1),
        );
        assert.equal((await signUp(OTHER_ADMIN, COMMUNITY_EVENT)).state, "denied");
        assert.equal(await count(db, "event_signups"), 1);
      });
      it("a manager of the event withdraws any sign-up and it is audited without names; a parent of another group cannot", async () => {
        const mine = await signUp(PARENT_F1, COMMUNITY_EVENT);
        assert.equal(
          (await withdraw(ADMIN_G1, mine.reference!, 1)).state,
          "denied",
          "a group admin does not manage a community event",
        );
        assert.equal((await withdraw(SUPER_ADMIN, mine.reference!, 1)).state, "success");
        const audit = await auditRows(db, "event.signup_removed");
        assert.equal(audit.length, 1);
        assert.equal(audit[0]!.details, `event:${COMMUNITY_EVENT}`);
      });
      it("allowed: the owner may withdraw after the event was cancelled; changing needs an open event", async () => {
        const mine = await signUp(PARENT_F1, COMMUNITY_EVENT);
        await db.query("update events set status = 'cancelled' where id = $1", [COMMUNITY_EVENT]);
        assert.deepEqual(outcome(await change(PARENT_F1, mine.reference!, 1, "Új")), [
          "conflict",
          "EVENT_CLOSED",
        ]);
        assert.equal((await withdraw(PARENT_F1, mine.reference!, 1)).state, "success");
      });
      it("outdated screen and repeated click", async () => {
        const mine = await signUp(PARENT_F1, COMMUNITY_EVENT);
        assert.deepEqual(outcome(await change(PARENT_F1, mine.reference!, 5, "Új")), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        assert.deepEqual(outcome(await withdraw(PARENT_F1, mine.reference!, 5)), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        const key = nextKey("dbl");
        const first = await signUp(PARENT_F2, COMMUNITY_EVENT, "Egyszer", null, key);
        const again = await signUp(PARENT_F2, COMMUNITY_EVENT, "Egyszer", null, key);
        assert.deepEqual(outcome(again), ["success", "replayed"]);
        assert.equal(again.reference, first.reference);
        assert.equal(await count(db, "event_signups", "note = 'Egyszer'"), 1);
      });
      it("two at once: a double withdraw leaves nothing and gives one success", async () => {
        const mine = await signUp(PARENT_F1, COMMUNITY_EVENT);
        const answers = await Promise.all([
          withdraw(PARENT_F1, mine.reference!, 1),
          callSecond(PARENT_F1, "event_signup_withdraw($1, $2, $3)", [
            nextKey("w2"),
            mine.reference,
            1,
          ]),
        ]);
        assert.equal(answers.filter((answer) => answer.state === "success").length, 1);
        assert.equal(await count(db, "event_signups"), 0);
      });
    });

    describe("W7 food offers", () => {
      it("allowed: an offer with its three ticks in a category; the page groups by the eight categories in order", async () => {
        const made = await offer(
          PARENT_F1,
          FOOD_EVENT,
          "free_from",
          "Mentes pite",
          true,
          false,
          true,
        );
        assert.deepEqual([made.state, made.version], ["success", 1]);
        const view = await page(PARENT_F2, FOOD_EVENT);
        assert.deepEqual(
          view.food.categories.map((entry) => entry.category),
          [
            "spreads",
            "bread",
            "free_from",
            "savoury",
            "sweet",
            "drinks",
            "vegetables_fruit",
            "other",
          ],
        );
        assert.deepEqual(
          view.food.categories[2]!.offers.map((entry) => [entry.text, entry.is_own]),
          [["Mentes pite", false]],
        );
        assert.equal(
          JSON.stringify(view).includes("family_id") || JSON.stringify(view).includes("child"),
          false,
          "nothing links a dish to a child or a family's diet",
        );
        const changed = await call(PARENT_F1, "food_offer_change($1, $2, $3, $4, $5, $6, $7, $8)", [
          nextKey("c"),
          made.reference,
          1,
          "sweet",
          "Almás pite",
          false,
          true,
          false,
        ]);
        assert.deepEqual([changed.state, changed.version], ["success", 2]);
        assert.equal(
          (
            await call(PARENT_F1, "food_offer_withdraw($1, $2, $3)", [
              nextKey("w"),
              made.reference,
              2,
            ])
          ).state,
          "success",
        );
      });
      it("refused: the switch off, a closed event, a wrong category, empty or long text, a teacher; twenty is the limit", async () => {
        assert.deepEqual(outcome(await offer(PARENT_F1, COMMUNITY_EVENT)), [
          "conflict",
          "FOOD_SIGNUP_OFF",
        ]);
        assert.deepEqual(outcome(await offer(PARENT_F1, CANCELLED_EVENT)), [
          "conflict",
          "EVENT_CLOSED",
        ]);
        assert.equal((await offer(PARENT_F1, FOOD_EVENT, "pizza")).field, "category");
        assert.equal((await offer(PARENT_F1, FOOD_EVENT, "sweet", " ")).field, "text");
        assert.equal((await offer(PARENT_F1, FOOD_EVENT, "sweet", "x".repeat(201))).field, "text");
        assert.equal((await offer(TEACHER_G1, FOOD_EVENT)).state, "denied");
        for (let index = 0; index < 20; index += 1) {
          assert.equal(
            (await offer(PARENT_F1, FOOD_EVENT, "other", `Étel ${index}`)).state,
            "success",
          );
        }
        assert.deepEqual(outcome(await offer(PARENT_F1, FOOD_EVENT)), [
          "validation",
          "EVENT_LIMIT_REACHED",
        ]);
      });
      it("allowed: changing needs an open event but not the switch; a manager may withdraw any offer, audited", async () => {
        const made = await offer(PARENT_F1, FOOD_EVENT);
        await db.query("update events set food_signup_on = false where id = $1", [FOOD_EVENT]);
        const changed = await call(PARENT_F1, "food_offer_change($1, $2, $3, $4, $5, $6, $7, $8)", [
          nextKey("c"),
          made.reference,
          1,
          "sweet",
          "Más pite",
          false,
          false,
          false,
        ]);
        assert.equal(changed.state, "success");
        assert.equal(
          (
            await call(PARENT_F2, "food_offer_withdraw($1, $2, $3)", [
              nextKey("w"),
              made.reference,
              2,
            ])
          ).state,
          "denied",
        );
        assert.equal(
          (
            await call(SUPER_ADMIN, "food_offer_withdraw($1, $2, $3)", [
              nextKey("w"),
              made.reference,
              2,
            ])
          ).state,
          "success",
        );
        assert.equal((await auditRows(db, "event.offer_removed")).length, 1);
      });
      it("outdated screen, repeated click and out of reach", async () => {
        const made = await offer(PARENT_F1, FOOD_EVENT);
        const stale = await call(PARENT_F1, "food_offer_change($1, $2, $3, $4, $5, $6, $7, $8)", [
          nextKey("c"),
          made.reference,
          4,
          "sweet",
          "x",
          false,
          false,
          false,
        ]);
        assert.deepEqual(outcome(stale), ["conflict", "VERSION_CONFLICT"]);
        const key = nextKey("dbl");
        const first = await offer(PARENT_F2, FOOD_EVENT, "drinks", "Tea", false, false, false, key);
        const again = await offer(PARENT_F2, FOOD_EVENT, "drinks", "Tea", false, false, false, key);
        assert.deepEqual(outcome(again), ["success", "replayed"]);
        assert.equal(again.reference, first.reference);
        const real = await call(PARENT_F2, "food_offer_change($1, $2, $3, $4, $5, $6, $7, $8)", [
          nextKey("c"),
          made.reference,
          1,
          "sweet",
          "x",
          false,
          false,
          false,
        ]);
        const missing = await call(PARENT_F2, "food_offer_change($1, $2, $3, $4, $5, $6, $7, $8)", [
          nextKey("c"),
          "99999999-0000-4000-8000-000000000007",
          1,
          "sweet",
          "x",
          false,
          false,
          false,
        ]);
        assert.deepEqual(real, missing);
      });
      it("two at once: two offers beside the 20th cannot both get in", async () => {
        for (let index = 0; index < 19; index += 1)
          await offer(PARENT_F1, FOOD_EVENT, "other", `Étel ${index}`);
        const answers = await Promise.all([
          offer(PARENT_F1, FOOD_EVENT, "other", "A"),
          callSecond(PARENT_F1, "food_offer_add($1, $2, $3, $4, $5, $6, $7)", [
            nextKey("b"),
            FOOD_EVENT,
            "other",
            "B",
            false,
            false,
            false,
          ]),
        ]);
        assert.deepEqual(answers.map((answer) => answer.state).sort(), ["success", "validation"]);
        assert.equal(await count(db, "food_offers", `event_id = '${FOOD_EVENT}'`), 20);
      });
    });

    it("no application role can read or write the four tables directly (NFR3.7)", async () => {
      for (const table of ["event_notices", "event_roles", "event_signups", "food_offers"]) {
        const failure = await failureOf(() => countAs(db, schema, PARENT_F1, table));
        assert.equal(failure?.code, "42501", table);
      }
    });
  });
}
