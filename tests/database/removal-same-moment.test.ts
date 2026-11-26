import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ASSIGNMENT_F2_T3,
  CO_PARENT_F1,
  callFunction,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  SUPER_ADMIN,
  uuid,
} from "./directory-support.ts";
import { insertEvent } from "./events-support.ts";
import { count } from "./identity-support.ts";
import { insertBook, insertLoan } from "./library-support.ts";
import {
  callAndHold,
  CHECK_TASK_OPEN,
  familyVersion,
  parentVersion,
  PLACE_ROTA,
  REQUEST_OTHER,
  type Result,
  seedRemovalWorld,
  succeeded,
  waitUntilBlocked,
} from "./removal-support.ts";
import { openDatabase, useSchema } from "./stack-support.ts";
import { insertTodo } from "./todo-support.ts";

const FREE_BOOK = uuid(9931);
const LENT_BOOK = uuid(9932);
const FREE_TODO = uuid(9933);
const FREE_CHECK_TASK = uuid(9934);
const UNTOUCHED_EVENT = uuid(9935);
const UNTOUCHED_FOOD_EVENT = uuid(9936);

/**
 * A removed person's own click in the same moment as the removal (U14; BR201.1, BR201.4, NFR1.3, NFR5.1, NFR5.2).
 * Both meet on the family's standing lock before any row lock: whichever comes second waits, then sees what the first
 * committed. The first command keeps its transaction open until the second one waits or answers, so the order is
 * fixed. A deadlock (40P01) or any other database error would reject the call and fail the test: the one who waited
 * must get an ordinary answer.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`removal: the removed person's own click at the same moment in ${schema}`, () => {
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
      await seedRemovalWorld(db, schema);
      // Records the removed family has nothing on, so no row lock of a removal step reaches them.
      await insertEvent(db, { id: UNTOUCHED_EVENT, title: "Másik ünnep" });
      await insertEvent(db, { id: UNTOUCHED_FOOD_EVENT, title: "Másik étkezés", food: true });
      await insertBook(db, { id: FREE_BOOK, owner: PARENT_ROW_F2, title: "Szabad könyv" });
      await insertBook(db, { id: LENT_BOOK, owner: PARENT_ROW_F2, title: "Kölcsönadott könyv" });
      await insertLoan(db, { book: LENT_BOOK, parent: PARENT_ROW_F2, family: FAMILY_2 });
      await insertTodo(db, { id: FREE_TODO, topic: "Szabad teendő" });
      await db.query(
        `insert into event_checklist_tasks (id, organization_id, event_id, section_id, position, title, helpers_needed)
         select $1, organization_id, event_id, section_id, 3, 'Széket vinni', 3
           from event_checklist_tasks where id = $2`,
        [FREE_CHECK_TASK, CHECK_TASK_OPEN],
      );
    });

    type Command = { account: string; sql: string; values: () => Promise<unknown[]> };

    const removals: Record<string, { kind: "family" | "parent"; id: string; command: Command }> = {
      "the family's removal": {
        kind: "family",
        id: FAMILY_1,
        command: {
          account: SUPER_ADMIN,
          sql: "family_archive($1, $2, $3)",
          values: async () => [nextKey("smf"), FAMILY_1, await familyVersion(db, FAMILY_1)],
        },
      },
      "the parent's own removal": {
        kind: "parent",
        id: PARENT_ROW_F1,
        command: {
          account: SUPER_ADMIN,
          sql: "parent_remove($1, $2, $3)",
          values: async () => [
            nextKey("smp"),
            PARENT_ROW_F1,
            await parentVersion(db, PARENT_ROW_F1),
          ],
        },
      },
    };

    const version = async (table: string, id: string) =>
      (await db.query(`select version from ${table} where id = $1`, [id])).rows[0]
        .version as number;

    /** Each click, how to count what it would leave behind, and the flagged-item kind that is meant to stay. */
    const clicks: Record<
      string,
      { command: Command; table: string; leftover: string; flaggedAs?: [string, string] }
    > = {
      "a sign-up on an event with nothing of theirs": {
        command: {
          account: PARENT_F1,
          sql: "event_signup_add($1, $2, 'verseny-jegyzet', null)",
          values: async () => [nextKey("sms"), UNTOUCHED_EVENT],
        },
        table: "event_signups",
        leftover: `(event_id = '${UNTOUCHED_EVENT}' and parent_id = '${PARENT_ROW_F1}') or note like 'verseny%'`,
      },
      "a food offer on an event with nothing of theirs": {
        command: {
          account: PARENT_F1,
          sql: "food_offer_add($1, $2, 'sweet', 'verseny-süti', false, false, false)",
          values: async () => [nextKey("smo"), UNTOUCHED_FOOD_EVENT],
        },
        table: "food_offers",
        leftover: `(event_id = '${UNTOUCHED_FOOD_EVENT}' and parent_id = '${PARENT_ROW_F1}') or text like 'verseny%'`,
      },
      "a book loan": {
        command: {
          account: PARENT_F1,
          sql: "library_book_borrow($1, $2, $3)",
          values: async () => [nextKey("smb"), FREE_BOOK, await version("books", FREE_BOOK)],
        },
        table: "loans",
        leftover: `book_id = '${FREE_BOOK}' and borrower_parent_id = '${PARENT_ROW_F1}' and returned_at is null`,
        // A borrowed book is physically with the person, so the removal keeps the loan and flags it.
        flaggedAs: ["held_book", FREE_BOOK],
      },
      "a return watch": {
        command: {
          account: PARENT_F1,
          sql: "library_watch_add($1, $2)",
          values: async () => [nextKey("smw"), LENT_BOOK],
        },
        table: "return_watches",
        leftover: `book_id = '${LENT_BOOK}' and parent_id = '${PARENT_ROW_F1}'`,
      },
      "a checklist claim": {
        command: {
          account: PARENT_F1,
          sql: "checklist_claim($1, $2, 'verseny-jegyzet', null)",
          values: async () => [nextKey("smc"), FREE_CHECK_TASK],
        },
        table: "checklist_claims",
        leftover: `(task_id = '${FREE_CHECK_TASK}' and parent_id = '${PARENT_ROW_F1}') or note like 'verseny%'`,
      },
      "a to-do claim": {
        command: {
          account: PARENT_F1,
          sql: "todo_task_claim($1, $2, $3)",
          values: async () => [nextKey("smt"), FREE_TODO, await version("todo_tasks", FREE_TODO)],
        },
        table: "todo_tasks",
        leftover: `id = '${FREE_TODO}' and claimant_parent_id = '${PARENT_ROW_F1}'`,
      },
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
      const pending: Promise<{ result?: Result; error?: Error & { code?: string } }> = callFunction(
        second,
        schema,
        other.account,
        other.sql,
        otherValues,
      )
        .then((result) => ({ result }))
        .catch((error: Error & { code?: string }) => ({ error }))
        .finally(() => {
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
      const answered = await pending;
      assert.equal(
        answered.error,
        undefined,
        `no database error: ${answered.error?.code} ${answered.error?.message}`,
      );
      return { first: heldResult, second: answered.result!, waited };
    }

    async function flagged(kind: string, id: string) {
      const result = succeeded(
        await callFunction(db, schema, SUPER_ADMIN, "removal_flagged_items($1, $2)", [kind, id]),
      );
      return (result.items as { kind: string; item_id: string }[]).map(
        (item) => `${item.kind}:${item.item_id}`,
      );
    }

    for (const [removalName, removal] of Object.entries(removals)) {
      for (const [clickName, click] of Object.entries(clicks)) {
        it(`${removalName} first, then ${clickName}: the click waits, is refused and leaves nothing`, async () => {
          const result = await crossing(removal.command, click.command);
          succeeded(result.first);
          assert.equal(await count(db, click.table, click.leftover), 0, "nothing is left behind");
          assert.equal(result.second.state, "denied", JSON.stringify(result.second));
          assert.equal(result.waited, true, "the click waited for the removal");
        });

        it(`${clickName} first, then ${removalName}: the removal waits and clears or flags it`, async () => {
          const result = await crossing(click.command, removal.command);
          succeeded(result.first);
          succeeded(result.second);
          if (click.flaggedAs) {
            assert.ok(
              (await flagged(removal.kind, removal.id)).includes(click.flaggedAs.join(":")),
              "what stays is on the flagged list",
            );
          } else {
            assert.equal(await count(db, click.table, click.leftover), 0);
          }
          if (click.table === "todo_tasks") {
            assert.ok(
              (await flagged(removal.kind, removal.id)).includes(`claimed_task:${FREE_TODO}`),
              "the released claim is on the flagged list",
            );
          }
          assert.equal(result.waited, true, "the removal waited for the click");
        });
      }
    }

    /**
     * Answering a swap is the one command left out of the standing lock. It meets a removal on the duties and places
     * both lock, and an answer of an ended session cannot be stored: the database then rejects it with 42501, which
     * undoes all of it and which the app shows as "denied".
     */
    async function swapOffer(): Promise<Command> {
      await db.query("update change_requests set status = 'withdrawn' where id = $1", [
        REQUEST_OTHER,
      ]);
      const offer = succeeded(
        await callFunction(db, schema, PARENT_F2, "swap_request($1, $2, $3, $4, $5, null)", [
          nextKey("smq"),
          ASSIGNMENT_F2_T3,
          await version("assignments", ASSIGNMENT_F2_T3),
          PLACE_ROTA,
          await version("assignments", PLACE_ROTA),
        ]),
      );
      return {
        account: PARENT_F1,
        sql: "swap_respond($1, $2, true, 1)",
        values: async () => [nextKey("sma"), offer.reference],
      };
    }

    for (const [removalName, removal] of Object.entries(removals)) {
      it(`${removalName} first, then their answer to a swap: no deadlock, and nothing of the answer is kept`, async () => {
        const answer = await swapOffer();
        const answerValues = await answer.values();
        succeeded(
          await callAndHold(
            first,
            schema,
            removal.command.account,
            removal.command.sql,
            await removal.command.values(),
          ),
        );
        const pending = callFunction(second, schema, answer.account, answer.sql, answerValues).then(
          (result) => String(result.state),
          (error: Error & { code?: string }) => String(error.code),
        );
        await waitUntilBlocked(db, second);
        await first.query("commit");
        const outcome = await pending;
        assert.ok(["denied", "conflict", "42501"].includes(outcome), outcome);
        assert.equal(
          await count(
            db,
            "assignments",
            `id = '${ASSIGNMENT_F2_T3}' and family_id = '${FAMILY_2}' and status <> 'removed'`,
          ),
          1,
          "the places were not exchanged",
        );
        assert.equal(await count(db, "change_requests", "status = 'applied'"), 0);
      });

      it(`their answer to a swap first, then ${removalName}: both finish without a deadlock`, async () => {
        const answer = await swapOffer();
        const [, offer] = await answer.values();
        const result = await crossing(answer, removal.command);
        succeeded(result.second);
        // The answer was accepted for processing, so the offer is settled whatever its outcome.
        succeeded(result.first);
        assert.equal(await count(db, "change_requests", `id = '${offer}' and status = 'open'`), 0);
        assert.equal(
          await count(db, "assignments", `parent_id = '${PARENT_ROW_F1}' and id = '${PLACE_ROTA}'`),
          0,
          "an exchanged place names no parent",
        );
      });
    }

    it("every command asks who the caller is after the shared entry, so a wait cannot keep a stale answer", async () => {
      // The standing lock relies on this order: what a command reads before the entry may be older than a removal.
      const commands = await db.query(
        `select p.proname, regexp_replace(p.prosrc, '--[^\\n]*', '', 'g') as body
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = $1 and p.proname <> 'platform_idempotency_check'
            and p.prosrc like '%platform_idempotency_check(%'
          order by p.proname`,
        [schema],
      );
      const asksWho =
        /\b(current_parent_id|current_family_id|identity_linked_parent|directory_actor_family|has_super_scope|has_core_scope|has_current_role_scope|platform_actor_role|platform_actor_account|platform_deny_unless_super|directory_reaches_[a-z_]+|directory_is_admin|identity_can_manage_scope|can_manage_group|event_lock_managed|library_caller_owns|library_lock_book_for_owner|recurring_occurrence_access)\s*\(/;
      const systemOnly = /not platform_caller_is_system\(\)/;
      const missing = commands.rows
        .filter(({ body }) => {
          const after = (body as string).slice(
            (body as string).indexOf("platform_idempotency_check("),
          );
          return !asksWho.test(after) && !systemOnly.test(body as string);
        })
        .map(({ proname }) => proname as string);
      assert.ok(commands.rows.length > 100, `commands found: ${commands.rows.length}`);
      assert.deepEqual(missing, []);
    });

    /** Makes a seeded parent a super administrator too, so that two of them can remove at once. */
    const makeSuperAdmin = (account: string) =>
      db.query(
        `insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id)
         values ($1, 'super_admin', 'organization', $2, $2)`,
        [account, ORGANIZATION],
      );
    const familyRemovalBy = (account: string, family: string): Command => ({
      account,
      sql: "family_archive($1, $2, $3)",
      values: async () => [nextKey("mx"), family, await familyVersion(db, family)],
    });
    const parentRemovalBy = (account: string, parent: string): Command => ({
      account,
      sql: "parent_remove($1, $2, $3)",
      values: async () => [nextKey("my"), parent, await parentVersion(db, parent)],
    });
    const removals_audited = () =>
      count(
        db,
        "audit_events",
        "action in ('lifecycle.parent_removed', 'lifecycle.family_removed')",
      );

    for (const [name, firstAdmin, secondAdmin] of [
      ["the first family's admin starts", PARENT_F1, PARENT_F2],
      ["the second family's admin starts", PARENT_F2, PARENT_F1],
    ] as const) {
      it(`two administrators remove each other's family, ${name}: one wins, no deadlock`, async () => {
        await makeSuperAdmin(PARENT_F1);
        await makeSuperAdmin(PARENT_F2);
        const familyOf = (account: string) => (account === PARENT_F1 ? FAMILY_1 : FAMILY_2);
        const result = await crossing(
          familyRemovalBy(firstAdmin, familyOf(secondAdmin)),
          familyRemovalBy(secondAdmin, familyOf(firstAdmin)),
        );
        succeeded(result.first);
        assert.equal(result.waited, true);
        assert.equal(result.second.state, "denied", JSON.stringify(result.second));
        assert.equal(await removals_audited(), 1);
        assert.equal(
          await count(db, "families", `id = '${familyOf(firstAdmin)}' and status = 'active'`),
          1,
        );
      });
    }

    it("two administrators removing each other's family at the very same time never deadlock", async () => {
      const third = await openDatabase();
      await useSchema(third, schema);
      try {
        for (let round = 0; round < 5; round += 1) {
          await seedRemovalWorld(db, schema);
          await makeSuperAdmin(PARENT_F1);
          await makeSuperAdmin(PARENT_F2);
          const one = familyRemovalBy(PARENT_F1, FAMILY_2);
          const two = familyRemovalBy(PARENT_F2, FAMILY_1);
          const [oneValues, twoValues] = [await one.values(), await two.values()];
          const results = await Promise.all([
            callFunction(second, schema, one.account, one.sql, oneValues),
            callFunction(third, schema, two.account, two.sql, twoValues),
          ]);
          assert.deepEqual(
            results.map((result) => result.state).sort(),
            ["denied", "success"],
            JSON.stringify(results),
          );
        }
      } finally {
        await third.end();
      }
    });

    it("two administrators of one family remove each other: one wins, no deadlock", async () => {
      await makeSuperAdmin(PARENT_F1);
      await makeSuperAdmin(CO_PARENT_F1);
      const coParent = (
        await db.query("select id from parents where account_id = $1", [CO_PARENT_F1])
      ).rows[0].id as string;
      const result = await crossing(
        parentRemovalBy(PARENT_F1, coParent),
        parentRemovalBy(CO_PARENT_F1, PARENT_ROW_F1),
      );
      succeeded(result.first);
      assert.equal(result.waited, true);
      assert.equal(result.second.state, "denied", JSON.stringify(result.second));
      assert.equal(await removals_audited(), 1);
    });

    for (const clickFirst of [true, false]) {
      it(`an administrator removes a parent of their own family while their own click is open, ${clickFirst ? "the click is first" : "the removal is first"}`, async () => {
        await makeSuperAdmin(PARENT_F1);
        const coParent = (
          await db.query("select id from parents where account_id = $1", [CO_PARENT_F1])
        ).rows[0].id as string;
        const ownClick = clicks["a to-do claim"].command;
        const removal = parentRemovalBy(PARENT_F1, coParent);
        const result = clickFirst
          ? await crossing(ownClick, removal)
          : await crossing(removal, ownClick);
        // The remover stays, so both succeed, one after the other.
        succeeded(result.first);
        succeeded(result.second);
        assert.equal(result.waited, true);
      });
    }

    it("a delete or anonymise run waits for the removal of its administrator and is then refused", async () => {
      await makeSuperAdmin(PARENT_F2);
      const archive = removals["the family's removal"].command;
      succeeded(
        await callFunction(db, schema, archive.account, archive.sql, await archive.values()),
      );
      await db.query("update families set archived_at = now() - interval '31 days' where id = $1", [
        FAMILY_1,
      ]);
      const run: Command = {
        account: PARENT_F2,
        sql: "lifecycle_run($1, $2, $3, true)",
        values: async () => [nextKey("lr"), FAMILY_1, await familyVersion(db, FAMILY_1)],
      };
      const result = await crossing(familyRemovalBy(SUPER_ADMIN, FAMILY_2), run);
      succeeded(result.first);
      assert.equal(result.waited, true);
      assert.equal(result.second.state, "denied", JSON.stringify(result.second));
      assert.equal(
        await count(db, "audit_events", "action in ('lifecycle.delete', 'lifecycle.anonymize')"),
        0,
      );
    });

    it("another family's click does not wait for a removal's standing lock (NFR5.7)", async () => {
      const removal = removals["the family's removal"].command;
      succeeded(
        await callAndHold(first, schema, removal.account, removal.sql, await removal.values()),
      );
      try {
        await second.query("set lock_timeout = '2s'");
        succeeded(
          await callFunction(second, schema, PARENT_F2, "todo_task_claim($1, $2, $3)", [
            nextKey("of"),
            FREE_TODO,
            await version("todo_tasks", FREE_TODO),
          ]),
        );
      } finally {
        await second.query("reset lock_timeout");
        await first.query("commit");
      }
    });

    it("two parents of one family click at once without waiting for each other", async () => {
      const mine = clicks["a to-do claim"].command;
      succeeded(await callAndHold(first, schema, mine.account, mine.sql, await mine.values()));
      try {
        await second.query("set lock_timeout = '2s'");
        succeeded(
          await callFunction(second, schema, CO_PARENT_F1, "library_book_borrow($1, $2, $3)", [
            nextKey("cp"),
            FREE_BOOK,
            await version("books", FREE_BOOK),
          ]),
        );
      } finally {
        await second.query("reset lock_timeout");
        await first.query("commit");
      }
    });

    it("a caller who may not remove takes no standing lock on the subject", async () => {
      const mine = clicks["a to-do claim"].command;
      succeeded(await callAndHold(first, schema, mine.account, mine.sql, await mine.values()));
      try {
        await second.query("set lock_timeout = '2s'");
        const refused = await callFunction(second, schema, PARENT_F2, "parent_remove($1, $2, $3)", [
          nextKey("nl"),
          PARENT_ROW_F1,
          await parentVersion(db, PARENT_ROW_F1),
        ]);
        assert.equal(refused.state, "denied", JSON.stringify(refused));
      } finally {
        await second.query("reset lock_timeout");
        await first.query("commit");
      }
    });
  });
}
