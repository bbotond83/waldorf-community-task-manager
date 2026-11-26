import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ASSIGNMENT_F2_T3,
  callFunction,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  nextKey,
  openDirectoryDatabase,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  SUPER_ADMIN,
  TASK_2,
  uuid,
} from "./directory-support.ts";
import { COMMUNITY_EVENT, insertEvent } from "./events-support.ts";
import { count } from "./identity-support.ts";
import { openDatabase, useSchema } from "./stack-support.ts";
import { insertBook } from "./library-support.ts";
import {
  BOOK_HELD,
  callAndHold,
  CHECK_TASK_OPEN,
  familyVersion,
  parentVersion,
  PLACE_ANIMAL,
  PLACE_ROTA,
  refusedWith,
  REQUEST_OTHER,
  type Result,
  seedRemovalWorld,
  snapshot,
  succeeded,
  TODO_CLAIMED,
} from "./removal-support.ts";
import { insertTodo } from "./todo-support.ts";

const RACE_BOOK = uuid(9921);
const RACE_TODO = uuid(9922);
const RACE_CHECK_TASK = uuid(9923);
const OTHER_EVENT = uuid(9924);

/**
 * Two things at once around a removal (U14; BR201.4, NFR5.1, NFR5.2, NFR5.7, NFR11.1). The first command keeps its
 * transaction open, the second one starts, and only then the first commits, so the order is fixed and not left to
 * chance. Neither side may deadlock (a deadlock would reject the call with 40P01).
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`removal: two at once in ${schema}`, () => {
    let db: pg.Client;
    let first: pg.Client;
    let second: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
      first = await openDatabase();
      second = await openDatabase();
      await useSchema(first, schema);
      await useSchema(second, schema);
    });
    after(async () => {
      await Promise.all([db.end(), first.end(), second.end()]);
    });
    beforeEach(async () => {
      await first.query("rollback");
      await seedAgain();
    });

    async function seedAgain() {
      await seedRemovalWorld(db, schema);
      await insertBook(db, { id: RACE_BOOK, owner: PARENT_ROW_F2, title: "Szabad könyv" });
      await insertTodo(db, { id: RACE_TODO, topic: "Szabad teendő" });
      await db.query(
        `insert into event_checklist_tasks (id, organization_id, event_id, section_id, position, title, helpers_needed)
         select $1, organization_id, event_id, section_id, 3, 'Széket vinni', 3
           from event_checklist_tasks where id = $2`,
        [RACE_CHECK_TASK, CHECK_TASK_OPEN],
      );
    }

    type Command = { account: string; sql: string; values: () => Promise<unknown[]> };

    const familyRemoval: Command = {
      account: SUPER_ADMIN,
      sql: "family_archive($1, $2, $3)",
      values: async () => [nextKey("rf"), FAMILY_1, await familyVersion(db, FAMILY_1)],
    };
    const parentRemoval: Command = {
      account: SUPER_ADMIN,
      sql: "parent_remove($1, $2, $3)",
      values: async () => [nextKey("rp"), PARENT_ROW_F1, await parentVersion(db, PARENT_ROW_F1)],
    };

    /**
     * Runs `held` and keeps it open, starts `other`, waits until `other` either answered or waits for a lock, then
     * commits. Both versions are read before either command starts, as on two screens opened earlier.
     */
    async function crossing(held: Command, other: Command) {
      const heldValues = await held.values();
      const otherValues = await other.values();
      const heldResult = await callAndHold(first, schema, held.account, held.sql, heldValues);
      let settled = false;
      // Any database error rejects here and fails the test: a deadlock (40P01), and also a raw refusal (42501). A
      // command of a removed account that had to wait gets an ordinary answer.
      const pending: Promise<Result> = callFunction(
        second,
        schema,
        other.account,
        other.sql,
        otherValues,
      ).finally(() => {
        settled = true;
      });
      const pid = (second as unknown as { processID: number }).processID;
      let waited = false;
      for (let attempt = 0; attempt < 400 && !settled && !waited; attempt += 1) {
        const lock = await db.query(
          "select 1 from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'",
          [pid],
        );
        waited = Boolean(lock.rowCount);
        if (!waited) await sleep(10);
      }
      await first.query("commit");
      return { first: heldResult, second: await pending, waited };
    }

    for (const [name, held, other] of [
      ["two removals of one family", familyRemoval, familyRemoval],
      ["two removals of one parent", parentRemoval, parentRemoval],
      ["a parent removal during the family's removal", familyRemoval, parentRemoval],
    ] as const) {
      it(`two at once: ${name} end with exactly one removal (BR201.4, NFR5.2)`, async () => {
        const result = await crossing(held, other);
        succeeded(result.first);
        refusedWith(result.second, "conflict", "VERSION_CONFLICT");
        assert.equal(result.waited, true, "the second waited for the family row");
        assert.equal(
          await count(
            db,
            "audit_events",
            "action in ('lifecycle.parent_removed', 'lifecycle.family_removed')",
          ),
          1,
        );
      });
    }

    it("two at once: a family removal that waits for a parent's removal then removes the rest of the family once", async () => {
      // Removing a parent does not change the family record, so the family's screen is not outdated.
      const result = await crossing(parentRemoval, familyRemoval);
      succeeded(result.first);
      succeeded(result.second);
      assert.equal(result.waited, true);
      const ended = result.second.ended_account_ids as string[];
      assert.equal(ended.includes(PARENT_F1), false, "the removed parent is not ended twice");
      assert.equal(
        await count(db, "parents", `family_id = '${FAMILY_1}' and status = 'active'`),
        0,
      );
    });

    const version = async (table: string, id: string) =>
      (await db.query(`select version from ${table} where id = $1`, [id])).rows[0]
        .version as number;

    const swapOntoRemovedPlace: Command = {
      account: PARENT_F2,
      sql: "swap_request($1, $2, $3, $4, $5, null)",
      values: async () => [
        nextKey("sw"),
        ASSIGNMENT_F2_T3,
        await version("assignments", ASSIGNMENT_F2_T3),
        PLACE_ROTA,
        await version("assignments", PLACE_ROTA),
      ],
    };
    const giveUpSlot: Command = {
      account: PARENT_F1,
      sql: "slot_give_up($1, $2, $3)",
      values: async () => [nextKey("gu"), PLACE_ANIMAL, await version("assignments", PLACE_ANIMAL)],
    };
    const signUpForDuty: Command = {
      account: PARENT_F1,
      sql: "duty_sign_up($1, $2, $3)",
      values: async () => [nextKey("su"), TASK_2, await version("tasks", TASK_2)],
    };

    const openRequestsOfRemovedFamily = () =>
      count(
        db,
        "change_requests",
        `status = 'open' and (source_family_id = '${FAMILY_1}' or target_family_id = '${FAMILY_1}')`,
      );

    for (const removalFirst of [true, false]) {
      const order = removalFirst ? "the removal is first" : "the other command is first";

      it(`two at once: a swap onto the family's duty crosses its removal, ${order} (NFR5.1)`, async () => {
        // The shared world has an open request on the other family's place; one place takes one open request.
        await db.query("update change_requests set status = 'withdrawn' where id = $1", [
          REQUEST_OTHER,
        ]);
        const result = removalFirst
          ? await crossing(familyRemoval, swapOntoRemovedPlace)
          : await crossing(swapOntoRemovedPlace, familyRemoval);
        const [removal, swap] = removalFirst
          ? [result.first, result.second]
          : [result.second, result.first];
        succeeded(removal);
        // As one after the other: a request sent first is made and then cancelled; one sent second is refused.
        assert.equal(swap.state === "success", !removalFirst, JSON.stringify(swap));
        assert.equal(await openRequestsOfRemovedFamily(), 0);
        assert.equal(
          await count(db, "assignments", `id = '${ASSIGNMENT_F2_T3}' and status = 'active'`),
          1,
          "the other family keeps its place",
        );
      });

      it(`two at once: a slot give-up crosses the family's removal, ${order} (NFR5.1)`, async () => {
        const result = removalFirst
          ? await crossing(familyRemoval, giveUpSlot)
          : await crossing(giveUpSlot, familyRemoval);
        const [removal, giveUp] = removalFirst
          ? [result.first, result.second]
          : [result.second, result.first];
        succeeded(removal);
        const place = (
          await db.query("select status from assignments where id = $1", [PLACE_ANIMAL])
        ).rows[0].status as string;
        // Whichever won, the stored place agrees with the answer the parent got.
        assert.equal(
          place,
          giveUp.state === "success" ? "removed" : "active",
          JSON.stringify(giveUp),
        );
        if (!removalFirst) assert.equal(giveUp.state, "success");
      });

      it(`two at once: a duty sign-up by the family crosses its removal, ${order} (NFR5.1)`, async () => {
        const result = removalFirst
          ? await crossing(familyRemoval, signUpForDuty)
          : await crossing(signUpForDuty, familyRemoval);
        succeeded(removalFirst ? result.first : result.second);
        assert.equal(
          await count(
            db,
            "assignments",
            `family_id = '${FAMILY_1}' and task_id = '${TASK_2}' and status <> 'removed'`,
          ),
          0,
        );
      });
    }

    it("another family's sign-up is not blocked while a removal holds its transaction open (NFR5.7)", async () => {
      // An event the removed family has nothing on: the removal holds only the events it changes.
      await insertEvent(db, { id: OTHER_EVENT, title: "Másik ünnep" });
      const removal = await callAndHold(first, schema, SUPER_ADMIN, familyRemoval.sql, [
        ...(await familyRemoval.values()),
      ]);
      succeeded(removal);
      try {
        await second.query("set lock_timeout = '2s'");
        succeeded(
          await callFunction(second, schema, PARENT_F2, "event_signup_add($1, $2, $3, null)", [
            nextKey("es"),
            OTHER_EVENT,
            "másik család jelentkezése",
          ]),
        );
        succeeded(
          await callFunction(second, schema, PARENT_F2, "duty_sign_up($1, $2, $3)", [
            nextKey("ds"),
            TASK_2,
            await version("tasks", TASK_2),
          ]),
        );
      } finally {
        await second.query("reset lock_timeout");
        await first.query("commit");
      }
    });

    it("a removal that gives up on a lock (error 40001) changes nothing, and the same key then succeeds", async () => {
      await db.query(`set search_path to "${schema}", pg_catalog`);
      await db.query(
        `create function race_give_up() returns trigger language plpgsql as $$ begin
           raise exception 'could not serialize access' using errcode = '40001'; end $$`,
      );
      await db.query(
        "create trigger race_give_up before update on group_memberships for each row execute function race_give_up()",
      );
      const values = await familyRemoval.values();
      const unchanged = await snapshot(db, schema);
      try {
        const failure = await callFunction(
          second,
          schema,
          SUPER_ADMIN,
          familyRemoval.sql,
          values,
        ).then(
          () => undefined,
          (error: Error & { code?: string }) => error,
        );
        assert.equal(failure?.code, "40001");
        assert.deepEqual(await snapshot(db, schema), unchanged);
      } finally {
        await db.query("drop trigger race_give_up on group_memberships");
        await db.query("drop function race_give_up()");
      }
      const retried = succeeded(
        await callFunction(second, schema, SUPER_ADMIN, familyRemoval.sql, values),
      );
      assert.notEqual(retried.code, "replayed");
      assert.equal(await count(db, "audit_events", "action = 'lifecycle.family_removed'"), 1);
    });

    /**
     * The removed parent's own click on a record, sent in the same moment as the removal. Both meet on the family's
     * standing lock, so neither order may deadlock and both finish. What is left behind is checked, kind by kind, in
     * removal-same-moment.test.ts.
     */
    const ownClicks: Record<string, Command> = {
      "an event sign-up": {
        account: PARENT_F1,
        sql: "event_signup_add($1, $2, 'verseny', null)",
        values: async () => [nextKey("os"), COMMUNITY_EVENT],
      },
      "a book loan": {
        account: PARENT_F1,
        sql: "library_book_borrow($1, $2, $3)",
        values: async () => [nextKey("ob"), RACE_BOOK, await version("books", RACE_BOOK)],
      },
      "a checklist claim": {
        account: PARENT_F1,
        sql: "checklist_claim($1, $2, 'verseny', null)",
        values: async () => [nextKey("oc"), RACE_CHECK_TASK],
      },
      "a to-do claim": {
        account: PARENT_F1,
        sql: "todo_task_claim($1, $2, $3)",
        values: async () => [nextKey("ot"), RACE_TODO, await version("todo_tasks", RACE_TODO)],
      },
    };

    /** Another family's click on a record that a step locks too, so the two really meet on a row lock (NFR5.1). */
    const onHeldRecords: Record<string, Command> = {
      "an event sign-up on the same event": {
        account: PARENT_F2,
        sql: "event_signup_add($1, $2, 'másik', null)",
        values: async () => [nextKey("he"), COMMUNITY_EVENT],
      },
      "a loan of the book the removed family holds": {
        account: PARENT_F2,
        sql: "library_book_borrow($1, $2, $3)",
        values: async () => [nextKey("hb"), BOOK_HELD, await version("books", BOOK_HELD)],
      },
      "a claim on the to-do the removed parent holds": {
        account: PARENT_F2,
        sql: "todo_task_claim($1, $2, $3)",
        values: async () => [
          nextKey("ht"),
          TODO_CLAIMED,
          await version("todo_tasks", TODO_CLAIMED),
        ],
      },
      "a claim withdrawal on the same checklist task": {
        account: PARENT_F2,
        sql: "checklist_claim_withdraw($1, $2, $3)",
        values: async () => {
          const claim = (
            await db.query(
              "select id, version from checklist_claims where task_id = $1 and parent_id = $2",
              [CHECK_TASK_OPEN, PARENT_ROW_F2],
            )
          ).rows[0];
          return [nextKey("hc"), claim.id, claim.version];
        },
      },
    };

    for (const [name, command] of Object.entries(onHeldRecords)) {
      for (const removalFirst of [true, false]) {
        const order = removalFirst ? "the removal is first" : "the click is first";
        it(`two at once: ${name} and the family's removal both finish without a deadlock, ${order}`, async () => {
          const result = removalFirst
            ? await crossing(familyRemoval, command)
            : await crossing(command, familyRemoval);
          succeeded(removalFirst ? result.first : result.second);
          // Either answer is an ordinary one; an error such as a deadlock would have been thrown.
          assert.ok(
            ["success", "conflict", "validation", "denied"].includes(
              String((removalFirst ? result.second : result.first).state),
            ),
            JSON.stringify(result),
          );
        });
      }
    }

    for (const [name, command] of Object.entries(ownClicks)) {
      for (const removalFirst of [true, false]) {
        const order = removalFirst ? "the removal is first" : "the click is first";
        it(`two at once: ${name} crosses the family's removal without a deadlock, ${order}`, async () => {
          const result = removalFirst
            ? await crossing(familyRemoval, command)
            : await crossing(command, familyRemoval);
          const [removal, click] = removalFirst
            ? [result.first, result.second]
            : [result.second, result.first];
          succeeded(removal);
          if (!removalFirst) succeeded(click);
          // A click that had to wait for the removal keeps nothing.
          if (removalFirst && result.waited) assert.notEqual(click.state, "success");
          assert.equal(
            (await db.query("select parent_display_name($1) as name", [PARENT_ROW_F1])).rows[0]
              .name,
            "korábbi tag",
          );
        });
      }
    }
  });
}
