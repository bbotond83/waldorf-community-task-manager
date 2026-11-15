import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  asActor,
  authenticated,
  DEACTIVATED,
  FAMILY_1,
  openDirectoryDatabase,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_CO,
  PARENT_ROW_DEACTIVATED,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_1,
  TEACHER_G1,
} from "./directory-support.ts";
import { NOTIFICATION_SCHEMAS } from "./notifications-support.ts";
import { bindSchema, failureOf, openDatabase } from "./stack-support.ts";

type Claimed = {
  delivery_id: string;
  round: number;
  attempt: number;
  email: string;
  title: string;
  item_name: string;
  item_date: string;
  path: string;
};
type Answer = {
  state: string;
  code: string | null;
  status?: string;
  items?: Claimed[];
  cancelled?: number;
  swept?: number;
};

const SERVICE = { role: "service_role" as const };

/**
 * The delivery pass on the real stack: claim, sweep and outcome record (BR51), granted to the service role only. A claim
 * counts the try in the same statement, hands the address out for that call only, cancels an email whose parent is
 * no longer active, and skips rows another pass holds. An outcome that matches the claimed try moves the email on; a
 * repeat or an outdated one changes nothing (BR51.5). Three tries make a round, 15 minutes apart (BR51.3).
 *
 * The fixed list: allowed; refused; out of reach (the deactivated account, the archived parent, no address kept);
 * outdated screen (not meaningful: these calls have no screen; its analogue, a record for a try that is no longer the
 * claimed one, is the "ignored" case); repeated click (an outcome recorded twice); two at once (two passes).
 */
for (const schema of NOTIFICATION_SCHEMAS) {
  describe(`email delivery pass in ${schema}`, () => {
    let db: pg.Client;
    let second: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
      second = await openDatabase();
      await bindSchema(second, schema);
    });
    after(async () => {
      await db.end();
      await second.end();
    });
    beforeEach(async () => {
      await seedCoordinationWorld(db, schema);
    });

    const asService = async (client: pg.Client, sql: string, values: unknown[] = []) =>
      asActor(client, schema, SERVICE, async () => {
        const result = await client.query(`select (${sql}) as result`, values);
        return result.rows[0].result as Answer;
      });
    const claim = (limit = 10, client: pg.Client = db) =>
      asService(client, "notice_email_claim($1)", [limit]);
    const record = (id: string, round: number, attempt: number, outcome: string, reason?: string) =>
      asService(db, "notice_email_record($1, $2, $3, $4, $5)", [
        id,
        round,
        attempt,
        outcome,
        reason ?? null,
      ]);
    const queue = async (parents = [PARENT_ROW_F1], key = "k1", kind = "sign_up_confirmed") =>
      db.query("select notice_send($1::uuid[], $2, 'task', $3, $4)", [parents, kind, TASK_1, key]);
    const delivery = async (id: string) =>
      (await db.query("select * from email_deliveries where id = $1", [id])).rows[0];
    const only = async () =>
      (await db.query("select id from email_deliveries")).rows[0].id as string;

    it("allowed: a claim returns the due email once with its address, title and path, and counts the try (BR51.1)", async () => {
      await queue();
      const answer = await claim();
      assert.equal(answer.state, "success");
      assert.equal(answer.items!.length, 1);
      const item = answer.items![0]!;
      assert.deepEqual([item.round, item.attempt], [1, 1]);
      assert.equal(item.email, `identity.${PARENT_F1}@example.test`);
      assert.match(item.title, /^Jelentkezés megerősítve: Sütés$/);
      assert.equal(item.item_name, "Sütés");
      assert.equal(item.path, `/szulo/feladatok/${TASK_1}`);
      const row = await delivery(item.delivery_id);
      assert.equal(row.status, "sending");
      assert.equal(row.attempts_in_round, 1);
      assert.ok(row.claimed_at, "the claim time is kept");
      assert.equal((await claim()).items!.length, 0, "a claimed email is not handed out again");
      assert.equal(
        /@/.test(
          JSON.stringify((await db.query("select to_jsonb(d) from email_deliveries d")).rows),
        ),
        false,
        "the address was not stored",
      );
    });

    it("allowed: a sent outcome ends the email; three failures make a round, 15 minutes apart, and the third is final (BR51.3)", async () => {
      await queue([PARENT_ROW_F1, PARENT_ROW_F2], "k2");
      const first = (await claim()).items!;
      assert.equal(first.length, 2);
      const [sent, failing] = first as [Claimed, Claimed];
      assert.equal((await record(sent.delivery_id, 1, 1, "sent")).status, "sent");
      assert.equal(
        (await record(failing.delivery_id, 1, 1, "failed", "mail_unavailable")).status,
        "retry_wait",
      );
      const waiting = await delivery(failing.delivery_id);
      const minutes = (
        await db.query(
          "select extract(epoch from (next_attempt_at - last_attempt_at)) / 60 as m from email_deliveries where id = $1",
          [failing.delivery_id],
        )
      ).rows[0].m as number;
      assert.ok(Math.abs(minutes - 15) < 0.1, "the next try is 15 minutes later");
      assert.equal(waiting.status, "retry_wait");
      assert.equal((await claim()).items!.length, 0, "not due before the wait ends");
      for (const attempt of [2, 3]) {
        await db.query("update email_deliveries set next_attempt_at = now() where id = $1", [
          failing.delivery_id,
        ]);
        const again = (await claim()).items!;
        assert.equal(again.length, 1);
        assert.equal(again[0]!.attempt, attempt);
        const outcome = await record(failing.delivery_id, 1, attempt, "failed", "mail_rejected");
        assert.equal(outcome.status, attempt < 3 ? "retry_wait" : "failed");
      }
      const attempts = (
        await db.query(
          "select attempt_number, outcome, reason_code from email_attempts where delivery_id = $1 order by attempt_number",
          [failing.delivery_id],
        )
      ).rows;
      assert.deepEqual(
        attempts.map((row) => [row.attempt_number, row.outcome, row.reason_code]),
        [
          [1, "failed", "mail_unavailable"],
          [2, "failed", "mail_rejected"],
          [3, "failed", "mail_rejected"],
        ],
        "only the class of the failure is kept",
      );
      assert.equal((await delivery(failing.delivery_id)).status, "failed");
      assert.equal((await claim()).items!.length, 0, "a failed email is not claimed again");
    });

    it("refused: no application role can run the claim, the sweep or the outcome record, as a parent, teacher, coordinator or super admin (NFR3.1)", async () => {
      await queue();
      const id = await only();
      const calls = [
        "select notice_email_claim(10)",
        "select notice_email_sweep()",
        `select notice_email_record('${id}', 1, 1, 'sent', null)`,
        `select email_delivery_record('${id}', 1, 1, 'sent', null)`,
        "select timed_checks_run_system('daily')",
      ];
      for (const actor of [
        { role: "anon" as const },
        authenticated(PARENT_F1),
        authenticated(TEACHER_G1),
        authenticated(ADMIN_G1),
        authenticated(SUPER_ADMIN),
      ]) {
        for (const sql of calls) {
          const error = await failureOf(() => asActor(db, schema, actor, () => db.query(sql)));
          assert.equal(error?.code, "42501", `${actor.role}: ${sql}`);
        }
      }
      assert.equal((await delivery(id)).status, "queued", "nothing moved");
    });

    it("refused: a limit outside 1 to 50 and an outcome with a bad class, a free-text reason or a reason on success are validation errors, and the address of a failure is never accepted (NFR1.4)", async () => {
      await queue();
      for (const limit of [0, 51, -1]) {
        assert.deepEqual(
          [(await claim(limit)).state, (await claim(limit)).code],
          ["validation", "request_invalid"],
        );
      }
      const id = await only();
      const claimed = (await claim()).items![0]!;
      for (const [outcome, reason] of [
        ["failed", null],
        ["failed", "anna@example.test"],
        ["failed", "550 mailbox unavailable"],
        ["sent", "mail_unavailable"],
        ["maybe", null],
      ] as const) {
        const answer = await record(
          id,
          claimed.round,
          claimed.attempt,
          outcome,
          reason ?? undefined,
        );
        assert.equal(answer.state, "validation", `${outcome} ${reason}`);
      }
      assert.equal((await delivery(id)).status, "sending", "nothing was recorded");
    });

    it("out of reach: a deactivated account or an archived parent with a queued email is cancelled at claim time and no address is returned (NFR3.5)", async () => {
      await queue([PARENT_ROW_F1, PARENT_ROW_DEACTIVATED, PARENT_ROW_CO, PARENT_ROW_F2], "k3");
      assert.equal(
        (await db.query("select count(*)::int as n from email_deliveries")).rows[0].n,
        3,
        "the already deactivated parent got no email queued",
      );
      await db.query("update accounts set status = 'deactivated' where id = $1", [PARENT_F1]);
      await db.query("update parents set status = 'archived' where id = $1", [PARENT_ROW_CO]);
      const answer = await claim();
      assert.equal(answer.items!.length, 1, "only the parent who is still active gets an email");
      assert.equal(answer.cancelled, 2);
      assert.equal(answer.items![0]!.email, `identity.${PARENT_F2}@example.test`);
      const states = (
        await db.query("select parent_id, status from email_deliveries order by status, parent_id")
      ).rows;
      assert.deepEqual(
        states.map((row) => row.status),
        ["cancelled", "cancelled", "sending"],
      );
      const text = JSON.stringify({ ...answer, items: [] });
      assert.equal(/@/.test(text), false, "no address of a cancelled email came back");
      assert.ok(DEACTIVATED, "the deactivated fixture account exists");
      assert.equal((await claim()).items!.length, 0, "a cancelled email is never claimed");
    });

    it("repeated click: an outcome recorded twice changes nothing, and a record for a try that is not the claimed one is ignored (BR51.5)", async () => {
      await queue();
      const id = await only();
      const claimed = (await claim()).items![0]!;
      assert.equal((await record(id, 1, 1, "failed", "mail_unavailable")).status, "retry_wait");
      const again = await record(id, 1, 1, "failed", "mail_unavailable");
      assert.deepEqual(
        [again.state, again.code, again.status],
        ["success", "ignored", "retry_wait"],
      );
      const wrongRound = await record(id, 2, 1, "sent");
      assert.equal(wrongRound.code, "ignored");
      const wrongTry = await record(id, claimed.round, 2, "sent");
      assert.equal(wrongTry.code, "ignored");
      assert.equal(
        (
          await db.query("select count(*)::int as n from email_attempts where delivery_id = $1", [
            id,
          ])
        ).rows[0].n,
        1,
        "one record for the one try",
      );
      const unknown = await record("11111111-1111-4111-8111-111111111111", 1, 1, "sent");
      assert.equal(unknown.code, "ignored");
    });

    it("sweep: a try claimed more than 10 minutes ago and never recorded fails with claim_expired, a recent claim is left alone, and a late outcome is ignored (BR51.4)", async () => {
      await queue([PARENT_ROW_F1, PARENT_ROW_F2], "k4");
      const [old, recent] = (await claim()).items! as [Claimed, Claimed];
      await db.query(
        "update email_deliveries set claimed_at = now() - interval '11 minutes' where id = $1",
        [old.delivery_id],
      );
      await db.query(
        "update email_deliveries set claimed_at = now() - interval '9 minutes' where id = $1",
        [recent.delivery_id],
      );
      assert.equal((await asService(db, "notice_email_sweep()")).swept, 1);
      assert.equal((await delivery(old.delivery_id)).status, "retry_wait");
      assert.equal((await delivery(recent.delivery_id)).status, "sending");
      const reason = (
        await db.query("select reason_code from email_attempts where delivery_id = $1", [
          old.delivery_id,
        ])
      ).rows[0].reason_code;
      assert.equal(reason, "claim_expired");
      assert.equal(
        (await asService(db, "notice_email_sweep()")).swept,
        0,
        "a second sweep finds nothing",
      );
      const late = await record(old.delivery_id, old.round, old.attempt, "sent");
      assert.equal(late.code, "ignored", "the late outcome of a swept try is ignored");
      assert.equal((await delivery(old.delivery_id)).status, "retry_wait");
    });

    it("two at once: two passes claim different emails, and two sweeps record an expired claim once (NFR5.1, NFR5.2)", async () => {
      const parents = [PARENT_ROW_F1, PARENT_ROW_F2, PARENT_ROW_CO];
      for (let index = 0; index < 8; index += 1) await queue(parents, `bulk-${index}`);
      assert.equal(
        (await db.query("select count(*)::int as n from email_deliveries")).rows[0].n,
        24,
      );
      for (let round = 0; round < 3; round += 1) {
        await db.query(
          "update email_deliveries set status = 'queued', claimed_at = null, attempts_in_round = 0",
        );
        const [one, two] = await Promise.all([claim(10, db), claim(10, second)]);
        const ids = [...one.items!, ...two.items!].map((item) => item.delivery_id);
        assert.equal(ids.length, 20, "each pass took its ten");
        assert.equal(new Set(ids).size, 20, "no email was handed to both passes");
      }
      await db.query(
        "update email_deliveries set claimed_at = now() - interval '11 minutes' where status = 'sending'",
      );
      const [sweepOne, sweepTwo] = await Promise.all([
        asService(db, "notice_email_sweep()"),
        asService(second, "notice_email_sweep()"),
      ]);
      assert.equal(sweepOne.swept! + sweepTwo.swept!, 20, "each expired claim was recorded once");
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from email_attempts where reason_code = 'claim_expired'",
          )
        ).rows[0].n,
        20,
      );
    });

    it("removal with a claim held: the notice and email are gone, the late outcome is ignored and nothing is sent again (NFR1.6)", async () => {
      await queue([PARENT_ROW_F1], "k5");
      const claimed = (await claim()).items![0]!;
      await db.query("select notifications_remove_core($1, $2::uuid[], false)", [
        FAMILY_1,
        [PARENT_ROW_F1, PARENT_ROW_CO],
      ]);
      assert.equal((await db.query("select count(*)::int as n from notifications")).rows[0].n, 0);
      assert.equal(
        (await db.query("select count(*)::int as n from email_deliveries")).rows[0].n,
        0,
      );
      const late = await record(
        claimed.delivery_id,
        claimed.round,
        claimed.attempt,
        "failed",
        "mail_unavailable",
      );
      assert.equal(late.code, "ignored");
      assert.equal((await db.query("select count(*)::int as n from email_attempts")).rows[0].n, 0);
      assert.equal((await claim()).items!.length, 0, "nothing is left to send");
    });
  });
}
