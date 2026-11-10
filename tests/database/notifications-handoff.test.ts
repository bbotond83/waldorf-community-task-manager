import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { NOTIFICATION_EXTRA_FUNCTIONS, NOTIFICATION_USE_CASES } from "../../src/data/index.ts";
import {
  ADMIN_G1,
  callFunction,
  EVENT_1,
  FAMILY_1,
  GROUP_1,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_1,
  TASK_2,
  uuid,
} from "./directory-support.ts";
import { NOTIFICATION_SCHEMAS } from "./notifications-support.ts";
import { ensureAccount, failureOf, openDatabase, sessionIdFor } from "./stack-support.ts";

/** Two extra families of the first group, each with sign-in accounts, and two extra tasks: the swap partners. */
const ACCOUNT_A = "bbbbbbbb-0000-4000-8000-000000000051";
const ACCOUNT_A2 = "bbbbbbbb-0000-4000-8000-000000000052";
const ACCOUNT_B = "bbbbbbbb-0000-4000-8000-000000000053";
const FAMILY_A = uuid(9601);
const FAMILY_B = uuid(9602);
const FAMILY_C = uuid(9603);
const PARENT_A = uuid(9611);
const PARENT_A2 = uuid(9612);
const PARENT_B = uuid(9613);
const PARENT_C = uuid(9614);
const TASK_P = uuid(9621);
const TASK_Q = uuid(9622);

type Result = Awaited<ReturnType<typeof callFunction>>;
type Notice = { kind: string; target_type: string; target_ref: string; task_id: string };

/**
 * Hand-off completeness, failure injection and races on the real stack: every entry of U3's
 * `NOTIFICATION_USE_CASES` and the extra functions of BR40.9 produces the notices and job changes of the table,
 * a use case whose notice or job write fails leaves nothing behind, a replay creates nothing twice, a genuine
 * repeat creates a new notice, and two sign-ups at once create one notice per parent and cause (BR40.1, BR40.5,
 * BR40.9, BR42.5, NFR6.18, NFR6.25, NFR3.14, NFR1.56).
 */
for (const schema of NOTIFICATION_SCHEMAS) {
  describe(`notification hand-off in ${schema}`, () => {
    let db: pg.Client;
    const extra: pg.Client[] = [];
    /** The names (with dots) of the functions the tests of this schema have exercised. */
    const covered = new Set<string>();

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await Promise.all(extra.map((client) => client.end()));
      await db.end();
    });
    beforeEach(async () => {
      await seedCoordinationWorld(db, schema);
      for (const id of [ACCOUNT_A, ACCOUNT_A2, ACCOUNT_B]) {
        await ensureAccount(db, { id, organization: ORGANIZATION });
      }
      await db.query(
        "insert into families (id, organization_id, display_name) values ($1, $4, 'Cserélő A család'), ($2, $4, 'Cserélő B család'), ($3, $4, 'Cserélő C család')",
        [FAMILY_A, FAMILY_B, FAMILY_C, ORGANIZATION],
      );
      await db.query(
        `insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id)
         values ($1, 'parent', 'family', $4, $6), ($2, 'parent', 'family', $4, $6), ($3, 'parent', 'family', $5, $6)`,
        [ACCOUNT_A, ACCOUNT_A2, ACCOUNT_B, FAMILY_A, FAMILY_B, ORGANIZATION],
      );
      await db.query(
        `insert into parents (id, organization_id, family_id, display_name, account_id)
         values ($1, $5, $6, 'Cserélő Aranka', $7), ($2, $5, $6, 'Cserélő Attila', $8), ($3, $5, $9, 'Cserélő Berta', $10),
                ($4, $5, $11, 'Cserélő Csaba', null)`,
        [
          PARENT_A,
          PARENT_A2,
          PARENT_B,
          PARENT_C,
          ORGANIZATION,
          FAMILY_A,
          ACCOUNT_A,
          ACCOUNT_A2,
          FAMILY_B,
          ACCOUNT_B,
          FAMILY_C,
        ],
      );
      // A group-wide reminder reaches the families of the group's members (BR4.4).
      await db.query(
        "insert into group_memberships (organization_id, parent_id, group_id) values ($1, $2, $5), ($1, $3, $5), ($1, $4, $5)",
        [ORGANIZATION, PARENT_A, PARENT_B, PARENT_C, GROUP_1],
      );
      await db.query(
        `insert into tasks (id, organization_id, group_id, title, capacity, starts_at, ends_at, location)
         values ($1, $3, $4, 'Csere P', 2, now() + interval '8 days', now() + interval '8 days 2 hours', 'Terem'),
                ($2, $3, $4, 'Csere Q', 2, now() + interval '9 days', now() + interval '9 days 2 hours', 'Kert')`,
        [TASK_P, TASK_Q, ORGANIZATION, GROUP_1],
      );
    });

    const as = (account: string, sql: string, values: unknown[] = []): Promise<Result> =>
      callFunction(db, schema, account, sql, values);
    const taskVersion = async (id: string) =>
      (await db.query("select version from tasks where id = $1", [id])).rows[0].version as number;
    const signUp = async (account: string, task: string, key = nextKey("su")) => {
      covered.add("duty.sign_up");
      return as(account, "duty_sign_up($1, $2, $3)", [key, task, await taskVersion(task)]);
    };
    const placeOf = async (family: string, task: string) =>
      (
        await db.query(
          "select id, version, status from assignments where family_id = $1 and task_id = $2 and status <> 'removed'",
          [family, task],
        )
      ).rows[0] as { id: string; version: number; status: string };
    const notices = async (parent: string) =>
      (
        await db.query(
          "select kind, target_type, target_ref, task_id from notifications where parent_id = $1 order by created_at, kind",
          [parent],
        )
      ).rows as Notice[];
    const kinds = async (parent: string) => (await notices(parent)).map((notice) => notice.kind);
    const total = async () =>
      (await db.query("select count(*)::int as n from notifications")).rows[0].n as number;
    const recipients = async (task: string) =>
      (
        await db.query(
          `select distinct r.family_id from reminder_recipients r join reminder_jobs j on j.id = r.reminder_job_id
            where j.task_id = $1 and r.status = 'active' and j.status not in ('stale', 'cancelled') order by 1`,
          [task],
        )
      ).rows.map((row) => row.family_id as string);
    const liveJobs = async (task: string) =>
      (
        await db.query(
          "select count(*)::int as n from reminder_jobs where task_id = $1 and status not in ('stale', 'cancelled')",
          [task],
        )
      ).rows[0].n as number;
    const swapRequest = async (
      account: string,
      source: { id: string; version: number },
      target: { id: string; version: number },
    ) => {
      covered.add("swap.request");
      return as(account, "swap_request($1, $2, $3, $4, $5, $6)", [
        nextKey("sw"),
        source.id,
        source.version,
        target.id,
        target.version,
        null,
      ]);
    };
    const sortedIds = (...ids: string[]) => [...ids].sort();

    async function bothSignedUp() {
      assert.equal((await signUp(ACCOUNT_A, TASK_P)).state, "success");
      assert.equal((await signUp(ACCOUNT_B, TASK_Q)).state, "success");
      return { a: await placeOf(FAMILY_A, TASK_P), b: await placeOf(FAMILY_B, TASK_Q) };
    }

    it("tells the signing family's linked parents and nobody else, and adds the family to the task's jobs (duty.sign_up)", async () => {
      const result = await signUp(ACCOUNT_A, TASK_P);
      assert.equal(result.state, "success");
      for (const parent of [PARENT_A, PARENT_A2]) {
        const own = await notices(parent);
        assert.deepEqual(
          own.map((notice) => [notice.kind, notice.target_type, notice.target_ref, notice.task_id]),
          [["sign_up_confirmed", "task", TASK_P, TASK_P]],
          parent,
        );
      }
      assert.equal(await total(), 2, "no other parent got anything");
      assert.deepEqual(await recipients(TASK_P), [FAMILY_A]);
      assert.equal(await liveJobs(TASK_P), 2, "a 7-day and a 24-hour job");
      assert.equal(await liveJobs(TASK_Q), 0, "other tasks are untouched");
    });

    it("adds a family that signs up later only to the jobs that can still run, never to one that is sent or terminal", async () => {
      assert.equal((await signUp(ACCOUNT_A, TASK_P)).state, "success");
      await db.query(
        "update reminder_jobs set status = 'sent', attempt = 1 where task_id = $1 and threshold = '24h'",
        [TASK_P],
      );
      await db.query(
        "update reminder_jobs set status = 'terminal', attempt = 3 where task_id = $1 and threshold = '7d'",
        [TASK_P],
      );
      assert.equal((await signUp(ACCOUNT_B, TASK_P)).state, "success");
      const rows = (
        await db.query(
          `select j.threshold, j.status, array_agg(r.family_id order by r.family_id) filter (where r.status = 'active') as families
             from reminder_jobs j left join reminder_recipients r on r.reminder_job_id = j.id
            where j.task_id = $1 group by j.id order by j.threshold`,
          [TASK_P],
        )
      ).rows;
      assert.deepEqual(
        rows.map((row) => [row.threshold, row.status, row.families]),
        [
          ["24h", "sent", [FAMILY_A]],
          ["7d", "terminal", [FAMILY_A]],
        ],
        "the families of the finished jobs are the ones that were planned for them",
      );
      // A job that can still run takes the new family: the same sign-up on a task whose 24-hour job is queued.
      assert.equal((await signUp(ACCOUNT_A, TASK_Q)).state, "success");
      await db.query(
        "update reminder_jobs set status = 'sent', attempt = 1 where task_id = $1 and threshold = '7d'",
        [TASK_Q],
      );
      assert.equal((await signUp(ACCOUNT_B, TASK_Q)).state, "success");
      const queued = (
        await db.query(
          `select j.threshold, j.status, array_agg(r.family_id order by r.family_id) filter (where r.status = 'active') as families
             from reminder_jobs j left join reminder_recipients r on r.reminder_job_id = j.id
            where j.task_id = $1 group by j.id order by j.threshold`,
          [TASK_Q],
        )
      ).rows;
      assert.deepEqual(
        queued.map((row) => [row.threshold, row.status, row.families]),
        [
          ["24h", "queued", sortedIds(FAMILY_A, FAMILY_B)],
          ["7d", "sent", [FAMILY_A]],
        ],
      );
    });

    it("creates nothing twice for a replay, nothing for a refusal, and a new notice for a genuine repeat (BR40.1)", async () => {
      const key = nextKey("replay");
      const version = await taskVersion(TASK_P);
      const first = await as(ACCOUNT_A, "duty_sign_up($1, $2, $3)", [key, TASK_P, version]);
      assert.equal(first.state, "success");
      const again = await as(ACCOUNT_A, "duty_sign_up($1, $2, $3)", [key, TASK_P, version]);
      assert.deepEqual([again.state, again.code], ["success", "replayed"]);
      assert.equal(await total(), 2, "the replay wrote no second notice");
      const second = await signUp(ACCOUNT_A, TASK_P);
      assert.deepEqual([second.state, second.code], ["conflict", "DUTY_ALREADY_ASSIGNED"]);
      const stale = await as(ACCOUNT_B, "duty_sign_up($1, $2, $3)", [nextKey("stale"), TASK_P, 1]);
      assert.equal(stale.state, "invalidated");
      assert.equal(await total(), 2, "refusals wrote nothing");
      assert.equal(await liveJobs(TASK_P), 2);
      // A genuine repeat: the place is removed, then the family signs up again.
      const place = await placeOf(FAMILY_A, TASK_P);
      covered.add("assignment.remove");
      const removed = await as(ADMIN_G1, "assignment_remove($1, $2, $3)", [
        nextKey("rm"),
        place.id,
        place.version,
      ]);
      assert.equal(removed.state, "success");
      assert.deepEqual(await kinds(PARENT_A), ["sign_up_confirmed", "place_removed"]);
      assert.equal(
        await liveJobs(TASK_P),
        0,
        "the family was the only recipient: the jobs are cancelled",
      );
      assert.equal((await signUp(ACCOUNT_A, TASK_P)).state, "success");
      assert.deepEqual(await kinds(PARENT_A), [
        "sign_up_confirmed",
        "place_removed",
        "sign_up_confirmed",
      ]);
      assert.equal(await liveJobs(TASK_P), 2, "new jobs for the new place");
    });

    it("lets an admin give and take a place: a notice for the linked parents, none for a family without one and no backfill later (assignment.assign, assignment.remove)", async () => {
      covered.add("assignment.assign");
      // The version of the task is read for each call (it rises with every place).
      const assignB = await as(ADMIN_G1, "assignment_assign($1, $2, $3, $4)", [
        nextKey("as"),
        TASK_P,
        FAMILY_B,
        await taskVersion(TASK_P),
      ]);
      assert.equal(assignB.state, "success");
      assert.deepEqual(await kinds(PARENT_B), ["sign_up_confirmed"]);
      assert.equal((await notices(PARENT_B))[0]!.task_id, TASK_P);
      const assignC = await as(ADMIN_G1, "assignment_assign($1, $2, $3, $4)", [
        nextKey("as"),
        TASK_P,
        FAMILY_C,
        await taskVersion(TASK_P),
      ]);
      assert.equal(assignC.state, "success");
      assert.equal(await total(), 1, "family C has no linked parent: no notice");
      assert.deepEqual(
        await recipients(TASK_P),
        sortedIds(FAMILY_B, FAMILY_C),
        "but it is a recipient of the jobs",
      );
      // A parent linked later is not backfilled.
      await ensureAccount(db, {
        id: "bbbbbbbb-0000-4000-8000-000000000054",
        organization: ORGANIZATION,
      });
      await db.query(
        "update parents set account_id = 'bbbbbbbb-0000-4000-8000-000000000054' where id = $1",
        [PARENT_C],
      );
      assert.equal((await notices(PARENT_C)).length, 0);
      // Removing B's place tells B and takes B out of the jobs.
      const placeB = await placeOf(FAMILY_B, TASK_P);
      const removed = await as(ADMIN_G1, "assignment_remove($1, $2, $3)", [
        nextKey("rm"),
        placeB.id,
        placeB.version,
      ]);
      assert.equal(removed.state, "success");
      assert.deepEqual(await kinds(PARENT_B), ["sign_up_confirmed", "place_removed"]);
      assert.deepEqual(await recipients(TASK_P), [FAMILY_C]);
    });

    it("tells only the other family about a swap request, and only the requester about a declined one; a withdrawn request's notice reads cancelled (swap.request, swap.respond, swap.withdraw)", async () => {
      const { a, b } = await bothSignedUp();
      const before = await total();
      const requested = await swapRequest(ACCOUNT_A, a, b);
      assert.equal(requested.state, "success");
      assert.deepEqual(await kinds(PARENT_B), ["sign_up_confirmed", "swap_requested"]);
      const request = (await notices(PARENT_B)).find((notice) => notice.kind === "swap_requested")!;
      assert.deepEqual(
        [request.target_type, request.target_ref, request.task_id],
        ["change_request", requested.reference, TASK_P],
        "the notice names the requester's task",
      );
      assert.equal(await total(), before + 1, "the requester and their co-parent got nothing");
      assert.deepEqual(await recipients(TASK_P), [FAMILY_A], "a request changes no job");
      // B declines: the requester's parents are told, B gets nothing new.
      covered.add("swap.respond");
      const declined = await as(ACCOUNT_B, "swap_respond($1, $2, $3, $4)", [
        nextKey("no"),
        requested.reference,
        false,
        null,
      ]);
      assert.deepEqual([declined.state, declined.outcome], ["success", "declined"]);
      assert.deepEqual(await kinds(PARENT_A), ["sign_up_confirmed", "swap_decided"]);
      assert.deepEqual(await kinds(PARENT_A2), ["sign_up_confirmed", "swap_decided"]);
      assert.deepEqual(await kinds(PARENT_B), ["sign_up_confirmed", "swap_requested"]);
      assert.deepEqual(
        [await recipients(TASK_P), await recipients(TASK_Q)],
        [[FAMILY_A], [FAMILY_B]],
      );
      const list = (await as(ACCOUNT_B, "notification_list()")).items as {
        title: string;
        timing: string;
      }[];
      assert.equal(
        list.find((item) => item.title.startsWith("Cserekérés"))!.timing,
        "cancelled",
        "the declined request's notice reads cancelled",
      );
      // A new request, withdrawn by A: no new notice, and the notice of the withdrawn request reads cancelled.
      const aNow = await placeOf(FAMILY_A, TASK_P);
      const bNow = await placeOf(FAMILY_B, TASK_Q);
      const second = await swapRequest(ACCOUNT_A, aNow, bNow);
      assert.equal(second.state, "success");
      const afterSecond = await total();
      covered.add("swap.withdraw");
      const withdrawn = await as(ACCOUNT_A, "swap_withdraw($1, $2)", [
        nextKey("wd"),
        second.reference,
      ]);
      assert.equal(withdrawn.state, "success");
      assert.equal(await total(), afterSecond, "a withdrawal creates no notice");
      const shown = (await as(ACCOUNT_B, "notification_list()")).items as {
        title: string;
        timing: string;
      }[];
      assert.deepEqual(
        shown.filter((item) => item.title.startsWith("Cserekérés")).map((item) => item.timing),
        ["cancelled", "cancelled"],
      );
    });

    it("exchanges the recipients of both tasks when a swap is confirmed, and tells both families (swap.respond applied)", async () => {
      const { a, b } = await bothSignedUp();
      const requested = await swapRequest(ACCOUNT_A, a, b);
      const confirmed = await as(ACCOUNT_B, "swap_respond($1, $2, $3, $4)", [
        nextKey("yes"),
        requested.reference,
        true,
        null,
      ]);
      assert.deepEqual([confirmed.state, confirmed.outcome], ["success", "applied"]);
      for (const parent of [PARENT_A, PARENT_A2, PARENT_B]) {
        assert.equal(
          (await kinds(parent)).filter((kind) => kind === "swap_decided").length,
          1,
          parent,
        );
      }
      assert.equal((await notices(PARENT_A))[1]!.task_id, TASK_P);
      // The places moved, and so did the recipients of the jobs.
      assert.equal((await placeOf(FAMILY_A, TASK_Q)).status, "active");
      assert.deepEqual(
        [await recipients(TASK_P), await recipients(TASK_Q)],
        [[FAMILY_B], [FAMILY_A]],
      );
      assert.equal(await liveJobs(TASK_P), 2);
      assert.equal(await liveJobs(TASK_Q), 2);
      const removedRows = await db.query(
        "select count(*)::int as n from reminder_recipients where status = 'removed'",
      );
      assert.equal(
        removedRows.rows[0].n,
        4,
        "each family's old rows stay as history (two jobs per task)",
      );
    });

    it("lets an admin decide a swap or a cancellation: notices to the families involved, and the jobs follow an approval (swap.decide, cancellation.decide, cancellation.request)", async () => {
      const { a } = await bothSignedUp();
      // A cancellation request creates nothing; a rejection tells the requester and changes no job.
      covered.add("cancellation.request");
      const before = await total();
      const cancel = await as(ACCOUNT_A, "cancellation_request($1, $2, $3, $4)", [
        nextKey("cr"),
        a.id,
        a.version,
        null,
      ]);
      assert.equal(cancel.state, "success");
      assert.equal(await total(), before, "admins are not notified in U4");
      covered.add("cancellation.decide");
      const rejected = await as(ADMIN_G1, "cancellation_decide($1, $2, $3, $4)", [
        nextKey("cd"),
        cancel.reference,
        false,
        null,
      ]);
      assert.deepEqual([rejected.state, rejected.outcome], ["success", "rejected"]);
      assert.deepEqual(await kinds(PARENT_A), ["sign_up_confirmed", "cancellation_decided"]);
      assert.deepEqual(await kinds(PARENT_A2), ["sign_up_confirmed", "cancellation_decided"]);
      assert.deepEqual(await kinds(PARENT_B), ["sign_up_confirmed"]);
      assert.deepEqual(await recipients(TASK_P), [FAMILY_A], "a rejection changes no job");
      // An approval removes the place and the recipient.
      const aNow = await placeOf(FAMILY_A, TASK_P);
      const second = await as(ACCOUNT_A, "cancellation_request($1, $2, $3, $4)", [
        nextKey("cr"),
        aNow.id,
        aNow.version,
        null,
      ]);
      const approved = await as(ADMIN_G1, "cancellation_decide($1, $2, $3, $4)", [
        nextKey("cd"),
        second.reference,
        true,
        null,
      ]);
      assert.deepEqual([approved.state, approved.outcome], ["success", "approved"]);
      assert.equal(
        (await kinds(PARENT_A)).filter((kind) => kind === "cancellation_decided").length,
        2,
      );
      assert.deepEqual(await recipients(TASK_P), []);
      assert.equal(await liveJobs(TASK_P), 0, "the job without a recipient is cancelled");
      // The admin's swap decision: A (now without a place) signs up for P again; swap with B, approved, then rejected.
      assert.equal((await signUp(ACCOUNT_A, TASK_P)).state, "success");
      const aAgain = await placeOf(FAMILY_A, TASK_P);
      const bNow = await placeOf(FAMILY_B, TASK_Q);
      const requested = await swapRequest(ACCOUNT_A, aAgain, bNow);
      const countBefore = await total();
      covered.add("swap.decide");
      const approvedSwap = await as(ADMIN_G1, "swap_decide($1, $2, $3, $4)", [
        nextKey("sd"),
        requested.reference,
        true,
        null,
      ]);
      assert.deepEqual([approvedSwap.state, approvedSwap.outcome], ["success", "approved"]);
      assert.equal(await total(), countBefore + 3, "A's two parents and B's parent");
      assert.deepEqual(
        [await recipients(TASK_P), await recipients(TASK_Q)],
        [[FAMILY_B], [FAMILY_A]],
      );
      const aQ = await placeOf(FAMILY_A, TASK_Q);
      const bP = await placeOf(FAMILY_B, TASK_P);
      const again = await swapRequest(ACCOUNT_A, aQ, bP);
      const beforeReject = await total();
      const rejectedSwap = await as(ADMIN_G1, "swap_decide($1, $2, $3, $4)", [
        nextKey("sd"),
        again.reference,
        false,
        null,
      ]);
      assert.deepEqual([rejectedSwap.state, rejectedSwap.outcome], ["success", "rejected"]);
      assert.equal(await total(), beforeReject + 3, "a rejection tells both families as well");
      assert.deepEqual(
        [await recipients(TASK_P), await recipients(TASK_Q)],
        [[FAMILY_B], [FAMILY_A]],
        "and changes no job",
      );
    });

    it("takes an archived family out of the jobs without a notice, and restoring it creates nothing (family.archive, family.restore)", async () => {
      const { a } = await bothSignedUp();
      assert.deepEqual(await recipients(TASK_P), [FAMILY_A]);
      const before = await total();
      covered.add("family.archive");
      const version = (await db.query("select version from families where id = $1", [FAMILY_A]))
        .rows[0].version as number;
      const archived = await as(SUPER_ADMIN, "family_archive($1, $2, $3)", [
        nextKey("fa"),
        FAMILY_A,
        version,
      ]);
      assert.equal(archived.state, "success");
      assert.equal(
        await total(),
        before,
        "the archived family's parents are archived and get no notice",
      );
      assert.deepEqual(await recipients(TASK_P), []);
      assert.equal(await liveJobs(TASK_P), 0);
      assert.equal(await liveJobs(TASK_Q), 2, "other families' jobs are untouched");
      assert.equal(
        (await db.query("select status from assignments where id = $1", [a.id])).rows[0].status,
        "removed",
      );
      covered.add("family.restore");
      const restoredVersion = (
        await db.query("select version from families where id = $1", [FAMILY_A])
      ).rows[0].version as number;
      const restored = await as(SUPER_ADMIN, "family_restore($1, $2, $3)", [
        nextKey("fr"),
        FAMILY_A,
        restoredVersion,
      ]);
      assert.equal(restored.state, "success");
      assert.equal(await total(), before, "restoring creates no notice");
      assert.equal(
        await liveJobs(TASK_P),
        0,
        "and brings no job back: the places were not brought back",
      );
    });

    it("keeps the jobs right when a task, an event or the reminder setting changes, with no notice (task.save, event.save, settings.save)", async () => {
      assert.equal((await signUp(ACCOUNT_A, TASK_P)).state, "success");
      const baseline = await total();
      const stored = (
        await db.query("select starts_at, ends_at, version from tasks where id = $1", [TASK_P])
      ).rows[0];
      covered.add("task.save");
      const moved = await as(ADMIN_G1, "task_save($1, $2::jsonb)", [
        nextKey("ts"),
        JSON.stringify({
          id: TASK_P,
          expected_version: stored.version,
          group_id: GROUP_1,
          title: "Csere P",
          capacity: 2,
          starts_at: new Date(stored.starts_at.getTime() + 2 * 3600_000).toISOString(),
          ends_at: new Date(stored.ends_at.getTime() + 2 * 3600_000).toISOString(),
        }),
      ]);
      assert.equal(moved.state, "success");
      const jobs = (
        await db.query(
          "select status, task_starts_at = (select starts_at from tasks where id = $1) as current from reminder_jobs where task_id = $1 order by created_at",
          [TASK_P],
        )
      ).rows;
      assert.deepEqual(
        jobs.map((job) => [job.status, job.current]),
        [
          ["stale", false],
          ["stale", false],
          ["queued", true],
          ["queued", true],
        ],
      );
      assert.equal(await total(), baseline, "a task change creates no notice");
      // The reminder setting: off cancels every live job, on with the group scope plans the group's families.
      covered.add("settings.save");
      const setting = await as(SUPER_ADMIN, "settings_get()");
      assert.equal(setting.state, "success");
      const off = await as(SUPER_ADMIN, "settings_save($1, $2, $3, $4)", [
        nextKey("set"),
        setting.version,
        false,
        "duty",
      ]);
      assert.equal(off.state, "success");
      assert.equal(await liveJobs(TASK_P), 0);
      const on = await as(SUPER_ADMIN, "settings_save($1, $2, $3, $4)", [
        nextKey("set"),
        off.version,
        true,
        "group",
      ]);
      assert.equal(on.state, "success");
      assert.equal(await liveJobs(TASK_P), 2);
      assert.deepEqual(
        await recipients(TASK_Q),
        sortedIds(FAMILY_A, FAMILY_B, FAMILY_C, FAMILY_1),
        "the group scope: every active family of the group, with or without a place",
      );
      assert.equal(await total(), baseline);
      // A cancelled task cancels its jobs; places are removed; still no notice.
      const latest = (
        await db.query("select starts_at, ends_at, version from tasks where id = $1", [TASK_P])
      ).rows[0];
      const cancelled = await as(ADMIN_G1, "task_save($1, $2::jsonb)", [
        nextKey("ts"),
        JSON.stringify({
          id: TASK_P,
          expected_version: latest.version,
          group_id: GROUP_1,
          title: "Csere P",
          capacity: 2,
          starts_at: latest.starts_at.toISOString(),
          ends_at: latest.ends_at.toISOString(),
          status: "cancelled",
        }),
      ]);
      assert.equal(cancelled.state, "success");
      assert.equal(await liveJobs(TASK_P), 0);
      // An event cancelled closes its tasks and cancels their jobs.
      covered.add("event.save");
      await db.query("select reminder_plan($1)", [TASK_1]);
      assert.equal(await liveJobs(TASK_1), 2);
      const otherEventsJobs = await liveJobs(TASK_2);
      assert.equal(otherEventsJobs, 2, "the group scope planned the other task as well");
      const event = (
        await db.query("select starts_at, ends_at, version, group_id from events where id = $1", [
          EVENT_1,
        ])
      ).rows[0];
      const eventResult = await as(ADMIN_G1, "event_save($1, $2::jsonb)", [
        nextKey("es"),
        JSON.stringify({
          id: EVENT_1,
          expected_version: event.version,
          group_id: event.group_id,
          title: "Őszi ünnep",
          starts_at: event.starts_at.toISOString(),
          ends_at: event.ends_at.toISOString(),
          status: "cancelled",
        }),
      ]);
      assert.equal(eventResult.state, "success");
      assert.equal(await liveJobs(TASK_1), 0);
      assert.equal(await liveJobs(TASK_2), otherEventsJobs, "a task of another event is untouched");
      assert.equal(await total(), baseline, "none of these writes a notice");
    });

    it("removes the notices and recipient rows of a family that goes through the lifecycle, with no personal link left (lifecycle.run, NFR1.56)", async () => {
      assert.equal((await signUp(ACCOUNT_A, TASK_P)).state, "success");
      assert.equal((await signUp(ACCOUNT_B, TASK_P)).state, "success");
      const noticeOfB = await total();
      assert.equal(noticeOfB, 3);
      const version = (await db.query("select version from families where id = $1", [FAMILY_A]))
        .rows[0].version as number;
      assert.equal(
        (await as(SUPER_ADMIN, "family_archive($1, $2, $3)", [nextKey("fa"), FAMILY_A, version]))
          .state,
        "success",
      );
      await db.query("update families set archived_at = now() - interval '40 days' where id = $1", [
        FAMILY_A,
      ]);
      await db.query(
        "insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, dedupe_key) values ($1, $2, 'sign_up_confirmed', 'task', $3, $3, now(), 'leftover-1')",
        [ORGANIZATION, PARENT_A, TASK_Q],
      );
      await db.query("update reminder_recipients set status = 'active' where family_id = $1", [
        FAMILY_A,
      ]);
      assert.ok(
        (
          await db.query(
            "select count(*)::int as n from reminder_recipients where family_id = $1",
            [FAMILY_A],
          )
        ).rows[0].n > 0,
        "rows to delete",
      );
      covered.add("lifecycle.run");
      const current = (await db.query("select version from families where id = $1", [FAMILY_A]))
        .rows[0].version as number;
      const run = await as(SUPER_ADMIN, "lifecycle_run($1, $2, $3, $4)", [
        nextKey("lc"),
        FAMILY_A,
        current,
        true,
      ]);
      assert.deepEqual([run.state, run.outcome], ["success", "anonymized"]);
      for (const parent of [PARENT_A, PARENT_A2]) {
        assert.equal((await notices(parent)).length, 0, `${parent}: notices deleted`);
      }
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from reminder_recipients where family_id = $1",
            [FAMILY_A],
          )
        ).rows[0].n,
        0,
        "recipient rows deleted, not kept as history",
      );
      assert.deepEqual(await kinds(PARENT_B), ["sign_up_confirmed"], "other families keep theirs");
      assert.deepEqual(await recipients(TASK_P), [FAMILY_B]);
      // A family that never held a place is deleted outright, with its notices.
      await db.query(
        "insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, dedupe_key) values ($1, $2, 'place_removed', 'task', $3, $3, now(), 'leftover-2')",
        [ORGANIZATION, PARENT_C, TASK_Q],
      );
      await db.query(
        "update families set status = 'archived', archived_at = now() - interval '40 days' where id = $1",
        [FAMILY_C],
      );
      await db.query("update parents set status = 'archived' where family_id = $1", [FAMILY_C]);
      const cVersion = (await db.query("select version from families where id = $1", [FAMILY_C]))
        .rows[0].version as number;
      const deleted = await as(SUPER_ADMIN, "lifecycle_run($1, $2, $3, $4)", [
        nextKey("lc"),
        FAMILY_C,
        cVersion,
        true,
      ]);
      assert.deepEqual([deleted.state, deleted.outcome], ["success", "deleted"]);
      assert.equal((await notices(PARENT_C)).length, 0);
    });

    /**
     * Runs `work` in one transaction in which a trigger makes every insert into `table` fail, then rolls the whole
     * transaction back (DDL included), so nothing of the injection can leak into the schema. Inside, `check`
     * looks at the state after the failed call, rolled back to a savepoint.
     */
    async function withFailingInsert(table: string, work: () => Promise<void>) {
      await db.query("begin");
      try {
        await db.query(`set local search_path to "${schema}", pg_catalog`);
        await db.query(
          "create function injected_failure() returns trigger language plpgsql as $f$ begin raise exception 'injected failure' using errcode = 'XX000'; end $f$",
        );
        await db.query(
          `create trigger injected_failure before insert on ${table} for each row execute function injected_failure()`,
        );
        await work();
      } finally {
        await db.query("rollback");
      }
    }
    async function callInTransaction(account: string, sql: string, values: unknown[]) {
      await db.query("savepoint injected");
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: account, role: "authenticated", session_id: sessionIdFor(account) }),
      ]);
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [account]);
      const failure = await failureOf(() => db.query(`select (${sql}) as result`, values));
      await db.query("rollback to savepoint injected");
      await db.query("reset role");
      return failure;
    }

    it("rolls a use case back as a whole when its notice or job write fails, and leaves the key free to be used again (NFR6.18, BR40.1)", async () => {
      const key = nextKey("inject");
      const version = await taskVersion(TASK_P);
      const idempotencyBefore = (
        await db.query("select count(*)::int as n from idempotency_records")
      ).rows[0].n as number;
      await withFailingInsert("notifications", async () => {
        const failure = await callInTransaction(ACCOUNT_A, "duty_sign_up($1, $2, $3)", [
          key,
          TASK_P,
          version,
        ]);
        assert.equal(failure?.code, "XX000", "the error reaches the caller, it is not swallowed");
        assert.equal(
          (
            await db.query("select count(*)::int as n from assignments where task_id = $1", [
              TASK_P,
            ])
          ).rows[0].n,
          0,
          "no place",
        );
        assert.equal(await taskVersion(TASK_P), version, "the task is untouched");
        assert.equal(
          (await db.query("select count(*)::int as n from idempotency_records")).rows[0].n,
          idempotencyBefore,
          "no stored result",
        );
        assert.equal(
          (await db.query("select count(*)::int as n from reminder_jobs")).rows[0].n,
          0,
          "no job",
        );
        // Without the fault, the same key and the same request succeed: the failed attempt left nothing in the way.
        await db.query("drop trigger injected_failure on notifications");
        await db.query("savepoint again");
        await db.query("set local role authenticated");
        await db.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({
            sub: ACCOUNT_A,
            role: "authenticated",
            session_id: sessionIdFor(ACCOUNT_A),
          }),
        ]);
        await db.query("select set_config('request.jwt.claim.sub', $1, true)", [ACCOUNT_A]);
        const retry = (
          await db.query("select duty_sign_up($1, $2, $3) as result", [key, TASK_P, version])
        ).rows[0].result as Result;
        await db.query("reset role");
        assert.equal(retry.state, "success");
        assert.equal((await db.query("select count(*)::int as n from notifications")).rows[0].n, 2);
        await db.query("rollback to savepoint again");
      });
      assert.equal(
        (await db.query("select count(*)::int as n from assignments where task_id = $1", [TASK_P]))
          .rows[0].n,
        0,
        "the outer rollback left nothing",
      );
      assert.equal(
        (await db.query("select count(*)::int from pg_trigger where tgname = 'injected_failure'"))
          .rows[0].count,
        0,
      );

      // A removal and a confirmed swap fail the same way and restore the state they found.
      const { a, b } = await bothSignedUp();
      const removeKey = nextKey("rm");
      await withFailingInsert("notifications", async () => {
        const failure = await callInTransaction(ADMIN_G1, "assignment_remove($1, $2, $3)", [
          removeKey,
          a.id,
          a.version,
        ]);
        assert.equal(failure?.code, "XX000");
        assert.deepEqual(
          (await db.query("select status, version from assignments where id = $1", [a.id])).rows[0],
          { status: "active", version: a.version },
        );
        assert.deepEqual(await recipients(TASK_P), [FAMILY_A], "the recipient is still there");
      });
      const requested = await swapRequest(ACCOUNT_A, a, b);
      await withFailingInsert("notifications", async () => {
        const failure = await callInTransaction(ACCOUNT_B, "swap_respond($1, $2, $3, $4)", [
          nextKey("yes"),
          requested.reference,
          true,
          null,
        ]);
        assert.equal(failure?.code, "XX000");
        assert.equal((await placeOf(FAMILY_A, TASK_P)).id, a.id, "the places were not exchanged");
        assert.equal(
          (
            await db.query("select status from change_requests where id = $1", [
              requested.reference,
            ])
          ).rows[0].status,
          "open",
        );
      });
      // A failing job write rolls a task change back too: the start is unchanged and nothing is stale.
      const stored = (
        await db.query("select starts_at, ends_at, version from tasks where id = $1", [TASK_P])
      ).rows[0];
      await withFailingInsert("reminder_jobs", async () => {
        const failure = await callInTransaction(ADMIN_G1, "task_save($1, $2::jsonb)", [
          nextKey("ts"),
          JSON.stringify({
            id: TASK_P,
            expected_version: stored.version,
            group_id: GROUP_1,
            title: "Csere P",
            capacity: 2,
            starts_at: new Date(stored.starts_at.getTime() + 3600_000).toISOString(),
            ends_at: new Date(stored.ends_at.getTime() + 3600_000).toISOString(),
          }),
        ]);
        assert.equal(failure?.code, "XX000");
        assert.equal(await taskVersion(TASK_P), stored.version);
        assert.equal(
          (await db.query("select count(*)::int as n from reminder_jobs where status = 'stale'"))
            .rows[0].n,
          0,
        );
      });
    });

    it("creates exactly one notice per parent and cause when two families sign up at once, and for a double click (NFR3.14)", async () => {
      const second = await openDatabase();
      extra.push(second);
      await second.query(`set search_path to "${schema}", pg_catalog`);
      const race = async (client: pg.Client, account: string, task: string, key: string) => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const version = (await client.query("select version from tasks where id = $1", [task]))
            .rows[0].version as number;
          const result = await callFunction(client, schema, account, "duty_sign_up($1, $2, $3)", [
            key,
            task,
            version,
          ]);
          if (result.code !== "DUTY_VERSION_STALE") return result;
        }
        throw new Error("no final answer");
      };
      const [one, two] = await Promise.all([
        race(db, ACCOUNT_A, TASK_P, nextKey("race-a")),
        race(second, ACCOUNT_B, TASK_P, nextKey("race-b")),
      ]);
      assert.deepEqual([one.state, two.state], ["success", "success"]);
      assert.deepEqual(await kinds(PARENT_A), ["sign_up_confirmed"]);
      assert.deepEqual(await kinds(PARENT_A2), ["sign_up_confirmed"]);
      assert.deepEqual(await kinds(PARENT_B), ["sign_up_confirmed"]);
      assert.deepEqual(await recipients(TASK_P), sortedIds(FAMILY_A, FAMILY_B));
      assert.equal(
        await liveJobs(TASK_P),
        2,
        "one 7-day and one 24-hour job, however the two sign-ups interleaved",
      );
      // The same parent clicks twice with the same key on two connections: one place, one notice per parent.
      const click = nextKey("click");
      const version = await taskVersion(TASK_Q);
      const results = await Promise.all([
        callFunction(db, schema, ACCOUNT_A, "duty_sign_up($1, $2, $3)", [click, TASK_Q, version]),
        callFunction(second, schema, ACCOUNT_A, "duty_sign_up($1, $2, $3)", [
          click,
          TASK_Q,
          version,
        ]),
      ]);
      assert.ok(results.every((result) => result.state === "success"));
      assert.deepEqual(results.map((result) => result.code).sort(), [null, "replayed"].sort());
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from notifications where task_id = $1 and kind = 'sign_up_confirmed'",
            [TASK_Q],
          )
        ).rows[0].n,
        2,
        "one per linked parent of the family",
      );
    });

    it("has exercised every entry of the use-case list and every extra function of BR40.9 (BR42.5, NFR6.25)", () => {
      const expected = [...NOTIFICATION_USE_CASES, ...NOTIFICATION_EXTRA_FUNCTIONS].sort();
      assert.deepEqual([...covered].sort(), expected);
    });
  });
}
