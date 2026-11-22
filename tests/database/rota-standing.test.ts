import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ASSIGNMENT_F1_T1,
  asActor,
  authenticated,
  callFunction,
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  FAMILY_OTHER,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  OTHER_ADMIN,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F2,
  REQUEST_1,
  SIGNED_OUT,
  SUPER_ADMIN,
  TASK_1,
  TASK_2,
  TEACHER_G1,
  uuid,
  YEAR_1,
  YEAR_OTHER,
} from "./directory-support.ts";
import { auditEvents, count } from "./identity-support.ts";
import { seedRotaWorld, setChangeover, setStanding } from "./rota-full-support.ts";
import { failureOf, openDatabase, useSchema } from "./stack-support.ts";

/**
 * The fixed-list tests of BR60.1 to BR60.6: marking a family as leaving or new, the changeover rule in the four
 * functions that give a family a duty today, the flagged duties and the standing reads of other units (US4.2).
 */
const A_F2_T2 = uuid(9701);

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`family standing in ${schema}`, () => {
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
    beforeEach(async () => {
      await seedRotaWorld(db, schema);
      // The swap world of the kernel tests: family 1 holds a place on task 1, family 2 one on task 2.
      await db.query("update change_requests set status = 'withdrawn' where id = $1", [REQUEST_1]);
      await db.query("update assignments set status = 'active' where id = $1", [ASSIGNMENT_F1_T1]);
      await db.query("update tasks set capacity = 3 where id = $1", [TASK_2]);
      await db.query(
        "insert into assignments (id, organization_id, task_id, family_id, parent_id, source) values ($1, $2, $3, $4, $5, 'parent_sign_up')",
        [A_F2_T2, ORGANIZATION, TASK_2, FAMILY_2, PARENT_ROW_F2],
      );
    });

    const call = (account: string, sql: string, values: unknown[] = []) =>
      callFunction(db, schema, account, sql, values);
    const set = (
      account: string,
      family: string,
      standing: string,
      version: number,
      key = nextKey("standing"),
      year: string = YEAR_1,
    ) =>
      call(account, "family_standing_set($1, $2, $3, $4, $5)", [
        key,
        family,
        year,
        standing,
        version,
      ]);
    const rows = () => count(db, "family_year_standings");
    const days = (n: number) =>
      db
        .query("select to_char(current_date + $1::integer, 'YYYY-MM-DD') as d", [n])
        .then((r) => String(r.rows[0].d));
    const version = async (table: string, id: string) =>
      (await db.query(`select version from ${table} where id = $1`, [id])).rows[0]
        .version as number;
    const hold = async (family: string, date: string) =>
      (await db.query("select family_may_hold_duty($1, $2::date) as r", [family, date])).rows[0]
        .r as { allowed: boolean; code: string | null; reason: string | null };

    // ---- BR60.1: setting a standing ----------------------------------------------------------------------

    it("BR60.1 allowed: a super admin marks a family as leaving and back, audited without a name", async () => {
      const first = await set(SUPER_ADMIN, FAMILY_1, "leaving", 0);
      assert.equal(first.state, "success", JSON.stringify(first));
      assert.equal(first.version, 1);
      assert.equal(typeof first.flagged, "number");
      const back = await set(SUPER_ADMIN, FAMILY_1, "staying", 1);
      assert.equal(back.state, "success", JSON.stringify(back));
      assert.equal(back.version, 2);
      assert.equal(await rows(), 1);
      const events = (await auditEvents(db)).filter((e) => e.action === "family.standing_set");
      assert.equal(events.length, 2);
      assert.equal(events[0].target_id, FAMILY_1);
      assert.equal(events[0].details, `year:${YEAR_1}:standing:leaving`);
      assert.ok(!/család/i.test(events[0].details ?? ""), "the audit detail holds no name");
    });

    it("BR60.1 refused: every other role and invalid input, with nothing saved", async () => {
      for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G1, OUTSIDER, DEACTIVATED, SIGNED_OUT]) {
        const refused = await set(account, FAMILY_1, "leaving", 0);
        assert.equal(refused.state, "denied", `${account} ${JSON.stringify(refused)}`);
      }
      assert.equal(await rows(), 0);
      const bad = await set(SUPER_ADMIN, FAMILY_1, "gone", 0);
      assert.equal(bad.code, "STANDING_INVALID");
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_2,
      ]);
      assert.equal((await set(SUPER_ADMIN, FAMILY_2, "leaving", 0)).code, "STANDING_INVALID");
      await db.query("update school_years set status = 'archived' where id = $1", [YEAR_1]);
      assert.equal((await set(SUPER_ADMIN, FAMILY_1, "leaving", 0)).code, "STANDING_INVALID");
      assert.equal(await rows(), 0);
    });

    it("BR60.1 out of reach: a family or year of another community and a made-up id are denied alike", async () => {
      const other = await set(SUPER_ADMIN, FAMILY_OTHER, "leaving", 0);
      const madeUp = await set(SUPER_ADMIN, uuid(9999), "leaving", 0);
      const otherYear = await set(SUPER_ADMIN, FAMILY_1, "leaving", 0, nextKey("y"), YEAR_OTHER);
      const otherAdmin = await set(OTHER_ADMIN, FAMILY_1, "leaving", 0);
      for (const result of [other, madeUp, otherYear, otherAdmin]) {
        assert.equal(result.state, "denied", JSON.stringify(result));
        assert.equal(result.code, "authorization_denied");
      }
      assert.equal(await rows(), 0);
    });

    it("BR60.1 outdated screen: a stale or wrong version is refused", async () => {
      assert.equal((await set(SUPER_ADMIN, FAMILY_1, "leaving", 4)).code, "VERSION_CONFLICT");
      await set(SUPER_ADMIN, FAMILY_1, "leaving", 0);
      assert.equal((await set(SUPER_ADMIN, FAMILY_1, "new", 0)).code, "VERSION_CONFLICT");
      assert.equal((await set(SUPER_ADMIN, FAMILY_1, "new", 7)).code, "VERSION_CONFLICT");
      assert.equal(
        (await db.query("select standing from family_year_standings")).rows[0].standing,
        "leaving",
      );
    });

    it("BR60.1 repeated click: the same key changes and audits once; a reused key with other input is refused", async () => {
      const key = nextKey("click");
      const first = await set(SUPER_ADMIN, FAMILY_1, "leaving", 0, key);
      const again = await set(SUPER_ADMIN, FAMILY_1, "leaving", 0, key);
      assert.equal(first.state, "success");
      assert.equal(again.state, "success");
      assert.equal(again.code, "replayed");
      assert.equal(await rows(), 1);
      assert.equal(
        (await auditEvents(db)).filter((e) => e.action === "family.standing_set").length,
        1,
      );
      assert.equal(
        (await set(SUPER_ADMIN, FAMILY_1, "new", 0, key)).code,
        "idempotency_key_reused",
      );
    });

    it("BR60.1 two people at once: one is saved, the other gets the version conflict", async () => {
      const callSecond = (standing: string) =>
        callFunction(second, schema, SUPER_ADMIN, "family_standing_set($1, $2, $3, $4, $5)", [
          nextKey("two"),
          FAMILY_1,
          YEAR_1,
          standing,
          0,
        ]);
      const results = await Promise.all([callSecond("leaving"), callSecond("new")]);
      const states = results.map((r) => r.state).sort();
      assert.deepEqual(states, ["conflict", "success"], JSON.stringify(results));
      assert.equal(await rows(), 1);
      assert.equal(results.find((r) => r.state === "conflict")?.code, "VERSION_CONFLICT");
    });

    // ---- BR60.2, BR60.3: the eligibility function --------------------------------------------------------

    it("BR60.2 a leaving family is refused from the changeover date, a new family before it", async () => {
      await setChangeover(db, "2027-03-01");
      await setStanding(db, schema, FAMILY_1, "leaving");
      await setStanding(db, schema, FAMILY_2, "new");
      assert.equal((await hold(FAMILY_1, "2027-02-28")).allowed, true);
      const gone = await hold(FAMILY_1, "2027-03-01");
      assert.deepEqual(
        [gone.allowed, gone.code, gone.reason],
        [false, "DUTY_INELIGIBLE", "leaving_after_changeover"],
      );
      const early = await hold(FAMILY_2, "2027-02-28");
      assert.deepEqual(
        [early.allowed, early.code, early.reason],
        [false, "DUTY_INELIGIBLE", "new_before_changeover"],
      );
      assert.equal((await hold(FAMILY_2, "2027-03-01")).allowed, true);
    });

    it("BR60.2 an unmarked, an inactive and an unknown family; a leaving row also counts in later years", async () => {
      assert.equal((await hold(FAMILY_1, "2027-05-01")).allowed, true);
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_2,
      ]);
      assert.equal((await hold(FAMILY_2, "2027-05-01")).reason, "family_inactive");
      assert.equal((await hold(uuid(9998), "2027-05-01")).reason, "family_inactive");
      await setChangeover(db, "2027-03-01");
      await setStanding(db, schema, FAMILY_1, "leaving");
      await db.query(
        "insert into school_years (id, organization_id, name, starts_on, ends_on) values ($1, $2, '2027/2028', '2027-09-01', '2028-06-30')",
        [uuid(9702), ORGANIZATION],
      );
      assert.equal((await hold(FAMILY_1, "2027-10-04")).reason, "leaving_after_changeover");
    });

    // ---- BR60.4: the check in the four functions of today ------------------------------------------------

    const signUp = (account: string, task: string) =>
      db
        .query("select version from tasks where id = $1", [task])
        .then((r) =>
          call(account, "duty_sign_up($1, $2, $3)", [nextKey("su"), task, r.rows[0].version]),
        );
    const assign = (account: string, task: string, family: string) =>
      db
        .query("select version from tasks where id = $1", [task])
        .then((r) =>
          call(account, "assignment_assign($1, $2, $3, $4)", [
            nextKey("as"),
            task,
            family,
            r.rows[0].version,
          ]),
        );
    const places = (task: string) =>
      count(db, "assignments", `task_id = '${task}' and status <> 'removed'`);

    it("BR60.4 sign-up: a leaving family is refused from the changeover date, a new family before it, with the reason", async () => {
      // Task 2 starts eleven days from now.
      await setChangeover(db, await days(5));
      await setStanding(db, schema, FAMILY_1, "leaving");
      const refused = await signUp(PARENT_F1, TASK_2);
      assert.equal(refused.state, "validation");
      assert.equal(refused.code, "DUTY_INELIGIBLE");
      assert.equal(refused.reason, "leaving_after_changeover");
      assert.equal(await places(TASK_2), 1);
      // The same refusal for a repeated click: nothing is stored, nothing is saved.
      assert.equal((await signUp(PARENT_F1, TASK_2)).code, "DUTY_INELIGIBLE");
      assert.equal(await places(TASK_2), 1);
      // Before the changeover date the same family may sign up.
      await setChangeover(db, await days(30));
      assert.equal((await signUp(PARENT_F1, TASK_2)).state, "success");
      assert.equal(await places(TASK_2), 2);
    });

    it("BR60.4 sign-up: a new family is refused before the changeover date and allowed from it", async () => {
      await setChangeover(db, await days(30));
      await setStanding(db, schema, FAMILY_1, "new");
      const refused = await signUp(PARENT_F1, TASK_2);
      assert.equal(refused.code, "DUTY_INELIGIBLE");
      assert.equal(refused.reason, "new_before_changeover");
      await setChangeover(db, await days(5));
      assert.equal((await signUp(PARENT_F1, TASK_2)).state, "success");
    });

    it("BR60.4 manual assignment: refused with the reason for a super admin, with the bare code for a group admin", async () => {
      await setChangeover(db, await days(5));
      await setStanding(db, schema, FAMILY_1, "leaving");
      const bySuper = await assign(SUPER_ADMIN, TASK_2, FAMILY_1);
      assert.equal(bySuper.code, "DUTY_INELIGIBLE");
      assert.equal(bySuper.reason, "leaving_after_changeover");
      const byGroupAdmin = await assign(ADMIN_G1, TASK_2, FAMILY_1);
      assert.equal(byGroupAdmin.code, "DUTY_INELIGIBLE");
      assert.equal(byGroupAdmin.reason, undefined, "a group admin gets the bare code");
      assert.equal(await places(TASK_2), 1);
      await setChangeover(db, await days(30));
      assert.equal((await assign(SUPER_ADMIN, TASK_2, FAMILY_1)).state, "success");
    });

    const requestSwap = async (account: string) => {
      const source = (
        await db.query("select version from assignments where id = $1", [ASSIGNMENT_F1_T1])
      ).rows[0];
      const target = (await db.query("select version from assignments where id = $1", [A_F2_T2]))
        .rows[0];
      return call(account, "swap_request($1, $2, $3, $4, $5, $6)", [
        nextKey("sw"),
        ASSIGNMENT_F1_T1,
        source.version,
        A_F2_T2,
        target.version,
        "Időpont-ütközés",
      ]);
    };

    it("BR60.4 proposing a swap: refused when either family would receive a duty on the wrong side", async () => {
      await setChangeover(db, await days(5));
      await setStanding(db, schema, FAMILY_1, "leaving");
      const own = await requestSwap(PARENT_F1);
      assert.equal(own.code, "DUTY_INELIGIBLE");
      assert.equal(own.reason, "leaving_after_changeover");
      await setStanding(db, schema, FAMILY_1, "staying");
      await setStanding(db, schema, FAMILY_2, "leaving");
      const other = await requestSwap(PARENT_F1);
      assert.equal(other.code, "DUTY_INELIGIBLE");
      assert.equal(
        other.reason,
        undefined,
        "the other family's standing is not shown to the requester",
      );
      assert.equal(await count(db, "change_requests", "kind = 'swap'"), 0);
      await setChangeover(db, await days(30));
      assert.equal((await requestSwap(PARENT_F1)).state, "success");
    });

    it("BR60.4 accepting a swap: refused when the standing changed after the proposal", async () => {
      await setChangeover(db, await days(30));
      const proposed = await requestSwap(PARENT_F1);
      assert.equal(proposed.state, "success", JSON.stringify(proposed));
      const id = String(proposed.reference);
      await setChangeover(db, await days(5));
      await setStanding(db, schema, FAMILY_1, "leaving");
      const refused = await call(PARENT_F2, "swap_respond($1, $2, $3, $4)", [
        nextKey("rs"),
        id,
        true,
        await version("change_requests", id),
      ]);
      assert.equal(refused.code, "SWAP_CANNOT_BE_APPLIED");
      assert.equal(
        (await db.query("select status from change_requests where id = $1", [id])).rows[0].status,
        "open",
      );
      // Declining is still possible.
      const declined = await call(PARENT_F2, "swap_respond($1, $2, $3, $4)", [
        nextKey("rs"),
        id,
        false,
        await version("change_requests", id),
      ]);
      assert.equal(declined.state, "success", JSON.stringify(declined));
    });

    it("BR60.4 two people at once: two sign-ups of a leaving family both end in the same refusal", async () => {
      await setChangeover(db, await days(5));
      await setStanding(db, schema, FAMILY_1, "leaving");
      const v = (await db.query("select version from tasks where id = $1", [TASK_2])).rows[0]
        .version;
      const again = callFunction(second, schema, PARENT_F1, "duty_sign_up($1, $2, $3)", [
        nextKey("par"),
        TASK_2,
        v,
      ]);
      const results = await Promise.all([signUp(PARENT_F1, TASK_2), again]);
      for (const result of results) assert.equal(result.code, "DUTY_INELIGIBLE");
      assert.equal(await places(TASK_2), 1);
    });

    // ---- BR60.5: flagged duties ---------------------------------------------------------------------------

    const calendar = (account: string) =>
      call(account, "school_calendar_get($1)", [YEAR_1]) as unknown as Promise<
        Record<string, unknown> & {
          standings: { family_id: string; standing: string; version: number }[];
          flagged_duties: { family_id: string; reason: string; duty_id: string }[];
        }
      >;

    it("BR60.5 flags appear with the standing and the changeover date and go away again; nothing is taken", async () => {
      const before = await places(TASK_1);
      assert.equal((await calendar(SUPER_ADMIN)).flagged_duties.length, 0);
      await setChangeover(db, await days(5));
      const set1 = await setStanding(db, schema, FAMILY_1, "leaving");
      assert.ok(Number(set1.flagged) >= 1, JSON.stringify(set1));
      const flagged = (await calendar(SUPER_ADMIN)).flagged_duties;
      assert.ok(flagged.some((f) => f.family_id === FAMILY_1 && f.duty_id === TASK_1));
      assert.equal(flagged[0].reason, "leaving_after_changeover");
      assert.equal(await places(TASK_1), before, "no place is taken");
      await setChangeover(db, await days(60));
      assert.equal((await calendar(SUPER_ADMIN)).flagged_duties.length, 0);
      await setChangeover(db, await days(5));
      await setStanding(db, schema, FAMILY_1, "staying");
      assert.equal((await calendar(SUPER_ADMIN)).flagged_duties.length, 0);
    });

    it("BR65.4 the calendar with the standings is a super admin's: every other role is denied, never an empty list", async () => {
      await setStanding(db, schema, FAMILY_1, "leaving");
      const own = await calendar(SUPER_ADMIN);
      const standing = own.standings.find((s) => s.family_id === FAMILY_1);
      assert.deepEqual([standing?.standing, standing?.version], ["leaving", 1]);
      assert.equal(own.standings.find((s) => s.family_id === FAMILY_2)?.standing, "staying");
      for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G1, OUTSIDER, OTHER_ADMIN]) {
        const refused = await calendar(account);
        assert.equal(refused.state, "denied", account);
        assert.equal(refused.standings, undefined);
      }
    });

    it("BR60.1 a parent cannot read or write the standings table directly", async () => {
      await setStanding(db, schema, FAMILY_1, "leaving");
      const error = await failureOf(() =>
        asActor(db, schema, authenticated(PARENT_F1), () =>
          db.query("select * from family_year_standings"),
        ),
      );
      assert.ok(error, "application roles hold no right on the standings table");
      const write = await failureOf(() =>
        asActor(db, schema, authenticated(SUPER_ADMIN), () =>
          db.query("update family_year_standings set standing = 'new'"),
        ),
      );
      assert.ok(write);
    });

    // ---- BR60.6: the reads of other units (C20) -----------------------------------------------------------

    it("BR60.6 family_standing counts the active weeks; families_with_standing lists unmarked families as staying", async () => {
      await setChangeover(db, "2027-03-01");
      await setStanding(db, schema, FAMILY_1, "leaving");
      await setStanding(db, schema, FAMILY_2, "new");
      const all = (await db.query("select count(*)::int as n from school_weeks($1)", [YEAR_1]))
        .rows[0].n;
      const before = (
        await db.query(
          "select count(*)::int as n from school_weeks($1) where week_start < '2027-03-01'",
          [YEAR_1],
        )
      ).rows[0].n;
      const read = async (family: string, year: string = YEAR_1) =>
        (await db.query("select family_standing($1, $2) as r", [family, year])).rows[0].r as {
          standing: string;
          active_weeks: number;
        } | null;
      assert.deepEqual(await read(FAMILY_1), { standing: "leaving", active_weeks: before });
      assert.deepEqual(await read(FAMILY_2), { standing: "new", active_weeks: all - before });
      assert.deepEqual(await read(uuid(201 + 9000)), null);
      assert.equal(await read(FAMILY_1, YEAR_OTHER), null);
      const withStanding = async (standing: string) =>
        (await db.query("select families_with_standing($1, $2) as f", [YEAR_1, standing])).rows.map(
          (r) => String(r.f),
        );
      assert.deepEqual(await withStanding("leaving"), [FAMILY_1]);
      assert.deepEqual(await withStanding("new"), [FAMILY_2]);
      const staying = await withStanding("staying");
      assert.equal(staying.length, 4);
      assert.ok(!staying.includes(FAMILY_1) && !staying.includes(FAMILY_2));
    });

    it("NFR3.5 the eligibility and standing functions are not executable by any application role", async () => {
      for (const role of ["anon", "authenticated", "service_role"]) {
        for (const signature of [
          "family_may_hold_duty(uuid, date)",
          "family_standing(uuid, uuid)",
          "families_with_standing(uuid, text)",
        ]) {
          const row = await db.query(
            `select has_function_privilege($1, '"${schema}".${signature}', 'execute') as ok`,
            [role],
          );
          assert.equal(row.rows[0].ok, false, `${role} ${signature}`);
        }
      }
    });
  });
}
