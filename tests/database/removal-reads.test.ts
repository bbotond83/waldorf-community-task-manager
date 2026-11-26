import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { resetSchema } from "../../scripts/db/reset.ts";
import { seedSchema } from "../../scripts/db/seed.ts";
import { seedAccount, seedId } from "../../scripts/db/seed/index.ts";
import { resetWorkerData } from "../../scripts/db/worker.ts";
import {
  ADMIN_G1,
  callFunction,
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  nextKey,
  openDirectoryDatabase,
  OTHER_ADMIN,
  PARENT_F1,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  SUPER_ADMIN,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import {
  BOOK_HELD,
  DUTY_ANIMAL,
  DUTY_ROTA,
  DUTY_WEEKEND,
  FAMILY_1_NAMES,
  GROUP_GARDEN,
  GROUP_GARDEN_NAME,
  parentVersion,
  familyVersion,
  refusedWith,
  type Result,
  removeFamily,
  removeParent,
  ROTA_WEEK_FUTURE,
  ROTA_WEEK_PAST,
  SCHEDULE_OF_FAMILY,
  seedRemovalWorld,
  snapshot,
  STEP_ORDER,
  stepsOf,
  succeeded,
  TODO_CLAIMED,
  TODO_OF_FAMILY,
} from "./removal-support.ts";
import { realSeedDeps } from "./seed-support.ts";
import {
  ensureAccount,
  lockSchemas,
  openDatabase,
  prepareSchema,
  report,
  // Imported under another name: the lint rule for React hooks takes any `use…` call for a hook.
  useSchema as selectSchema,
} from "./stack-support.ts";

/**
 * The two reads of a removal (U14, W6 and W7; BR200.1, BR200.2, BR205.1 to BR205.3; NFR1.2, NFR4.4) and the timings
 * on the large seed's busiest family (NFR9.1 to NFR9.4). The reads write nothing and take no lock, so the fixed
 * list's "outdated screen", "repeated click" and "two people at once" do not apply to them.
 */

type Item = {
  kind: string;
  item_id: string;
  label: string;
  on_date: string | null;
  link: string;
};

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`removal reads in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedRemovalWorld(db, schema);
    });

    const preview = (account: string, kind: string | null, id: string | null): Promise<Result> =>
      callFunction(db, schema, account, "removal_preview($1, $2)", [kind, id]);
    const flagged = (account: string, kind: string | null, id: string | null): Promise<Result> =>
      callFunction(db, schema, account, "removal_flagged_items($1, $2)", [kind, id]);
    const items = (result: Result) => result.items as Item[];
    const kinds = (result: Result) => items(result).map((item) => [item.kind, item.item_id]);

    it("allowed: the preview holds the eleven steps in order, the totals, the version and the groups, with these fields only (BR205.3, NFR1.2)", async () => {
      const result = succeeded(await preview(SUPER_ADMIN, "family", FAMILY_1));

      assert.deepEqual(Object.keys(result).sort(), [
        "code",
        "groups_left_without_coordinator",
        "reference",
        "refusal",
        "state",
        "steps",
        "subject",
        "totals",
        "version",
      ]);
      assert.deepEqual(result.subject, { kind: "family", id: FAMILY_1 });
      assert.equal(result.version, await familyVersion(db, FAMILY_1));
      assert.equal(result.refusal, null);
      assert.deepEqual(
        stepsOf(result).map((step) => step.block),
        STEP_ORDER,
      );
      for (const step of stepsOf(result)) {
        assert.deepEqual(Object.keys(step).sort(), ["block", "to_clear", "to_flag"]);
      }
      const sum = (key: "to_clear" | "to_flag") =>
        stepsOf(result).reduce((total, step) => total + step[key], 0);
      assert.deepEqual(result.totals, { to_clear: sum("to_clear"), to_flag: sum("to_flag") });
      assert.ok(sum("to_clear") > 0 && sum("to_flag") > 0, "the world has records of both sorts");
      assert.deepEqual(result.groups_left_without_coordinator, [
        { group_id: GROUP_GARDEN, name: GROUP_GARDEN_NAME },
      ]);
      for (const name of FAMILY_1_NAMES) assert.ok(!JSON.stringify(result).includes(name), name);
    });

    it("counts what the removal then does, and writes nothing (BR205.3)", async () => {
      for (const [kind, id, remove] of [
        ["parent", PARENT_ROW_F1, () => removeParent(db, schema)],
        ["family", FAMILY_1, () => removeFamily(db, schema)],
      ] as const) {
        await seedRemovalWorld(db, schema);
        const before = await snapshot(db, schema);
        const counted = succeeded(await preview(SUPER_ADMIN, kind, id));
        assert.deepEqual(await snapshot(db, schema), before, "the preview changed nothing");
        const done = succeeded(await remove());
        assert.deepEqual(stepsOf(done), stepsOf(counted), kind);
      }
    });

    it("takes no lock: it answers while another transaction holds the family and its parents (W6)", async () => {
      const holder = await openDatabase();
      try {
        await selectSchema(holder, schema);
        await holder.query("begin");
        await holder.query("select 1 from families where id = $1 for update", [FAMILY_1]);
        await holder.query("select 1 from parents where family_id = $1 for update", [FAMILY_1]);
        await db.query("set lock_timeout = '1s'");
        succeeded(await preview(SUPER_ADMIN, "family", FAMILY_1));
        succeeded(await flagged(SUPER_ADMIN, "family", FAMILY_1));
      } finally {
        await db.query("reset lock_timeout");
        await holder.query("rollback");
        await holder.end();
      }
    });

    it("carries the refusal the removal would answer with beside the counts (BR200.2, NFR3.3)", async () => {
      const lastParent = succeeded(await preview(SUPER_ADMIN, "parent", PARENT_ROW_F2));
      assert.equal(lastParent.refusal, "PARENT_LAST_IN_FAMILY");
      assert.equal(lastParent.version, await parentVersion(db, PARENT_ROW_F2));
      assert.equal(stepsOf(lastParent).length, 11);

      await db.query("update parents set account_id = null where account_id = $1", [SUPER_ADMIN]);
      await db.query("update parents set account_id = $1 where id = $2", [
        SUPER_ADMIN,
        PARENT_ROW_CO,
      ]);
      for (const [kind, id] of [
        ["parent", PARENT_ROW_CO],
        ["family", FAMILY_1],
      ] as const) {
        assert.equal(succeeded(await preview(SUPER_ADMIN, kind, id)).refusal, "SELF_REMOVAL", kind);
      }

      await seedRemovalWorld(db, schema);
      succeeded(await removeFamily(db, schema));
      assert.equal(
        succeeded(await preview(SUPER_ADMIN, "family", FAMILY_1)).refusal,
        "VERSION_CONFLICT",
      );
      assert.equal(
        succeeded(await preview(SUPER_ADMIN, "parent", PARENT_ROW_F1)).refusal,
        "VERSION_CONFLICT",
      );
    });

    it("refused and out of reach: only a super admin of the subject's community reads either (BR200.1, NFR3.4)", async () => {
      for (const read of [preview, flagged]) {
        for (const account of [ADMIN_G1, PARENT_F1, TEACHER_G1]) {
          refusedWith(await read(account, "family", FAMILY_1), "denied", "authorization_denied");
        }
        refusedWith(await read(DEACTIVATED, "family", FAMILY_1), "denied", "session_inactive");
        refusedWith(await read(OTHER_ADMIN, "family", FAMILY_1), "validation", "family_not_found");
        refusedWith(
          await read(OTHER_ADMIN, "parent", PARENT_ROW_F1),
          "validation",
          "parent_not_found",
        );
        refusedWith(
          await read(SUPER_ADMIN, "family", uuid(99999)),
          "validation",
          "family_not_found",
        );
        for (const [kind, id] of [
          ["child", FAMILY_1],
          [null, FAMILY_1],
          ["family", null],
        ]) {
          refusedWith(await read(SUPER_ADMIN, kind!, id!), "validation", "request_invalid");
        }
      }
      for (const name of ["removal_preview", "removal_flagged_items"]) {
        const rights = (
          await db.query(
            `select has_function_privilege('anon', $1, 'execute') as anonymous,
                    has_function_privilege('authenticated', $1, 'execute') as signed_in`,
            [`${name}(text, uuid)`],
          )
        ).rows[0];
        assert.deepEqual(rights, { anonymous: false, signed_in: true }, name);
      }
    });

    it("allowed: after a family removal the flagged items are its future places, held book, released claim, own task and schedule (BR205.1, BR205.2)", async () => {
      assert.deepEqual(
        items(succeeded(await flagged(SUPER_ADMIN, "family", FAMILY_1))),
        [],
        "a family that is not removed has nothing flagged",
      );
      succeeded(await removeFamily(db, schema));
      const before = await snapshot(db, schema);

      const result = succeeded(await flagged(SUPER_ADMIN, "family", FAMILY_1));

      assert.deepEqual(await snapshot(db, schema), before, "the read changed nothing");
      assert.deepEqual(Object.keys(result).sort(), [
        "code",
        "items",
        "reference",
        "state",
        "subject",
      ]);
      for (const item of items(result)) {
        assert.deepEqual(Object.keys(item).sort(), ["item_id", "kind", "label", "link", "on_date"]);
      }
      assert.deepEqual(
        items(result)
          .filter((item) => item.kind === "future_place")
          .map((item) => item.item_id)
          .sort(),
        [DUTY_ROTA, DUTY_WEEKEND, DUTY_ANIMAL].sort(),
      );
      assert.deepEqual(kinds(result).slice(3), [
        ["held_book", BOOK_HELD],
        ["claimed_task", TODO_CLAIMED],
        ["family_task", TODO_OF_FAMILY],
        ["family_schedule", SCHEDULE_OF_FAMILY],
      ]);
      assert.deepEqual(
        items(result)
          .slice(3)
          .map((item) => [item.label, item.link]),
        [
          ["Kertész könyv", `/admin/konyvtar/${BOOK_HELD}`],
          ["Kerítés festése", `/admin/teendok/${TODO_CLAIMED}`],
          ["Mosás", `/admin/teendok/${TODO_OF_FAMILY}`],
          ["Törölközők mosása", `/admin/ismetlodo/${SCHEDULE_OF_FAMILY}`],
        ],
      );
      assert.ok(
        items(result)
          .slice(0, 3)
          .every((item) => item.link === "/admin/tanev" && item.on_date !== null),
      );
      for (const name of FAMILY_1_NAMES) assert.ok(!JSON.stringify(result).includes(name), name);
    });

    // Regression: the flagged-duties list holds every week of a draft plan, past ones too; the result page calls these
    // items future, and the confirmation counts from this week on.
    it("leaves out the past weeks of a draft rota plan (BR205.1)", async () => {
      succeeded(await removeFamily(db, schema));
      await db.query(
        "update rota_plans set status = 'draft', published_at = null, published_by = null",
      );

      const listed = items(succeeded(await flagged(SUPER_ADMIN, "family", FAMILY_1)))
        .filter((item) => item.kind === "future_place")
        .map((item) => item.item_id);

      assert.ok(listed.includes(ROTA_WEEK_FUTURE), "a week still ahead is listed");
      assert.ok(!listed.includes(ROTA_WEEK_PAST), "a week already over is not");
    });

    it("after a parent removal the list holds only that parent's held book and released claim, never another family's flags (NFR4.4)", async () => {
      await db.query("update todo_tasks set needs_attention = true where id = $1", [
        TODO_OF_FAMILY,
      ]);
      succeeded(await removeParent(db, schema));

      assert.deepEqual(kinds(succeeded(await flagged(SUPER_ADMIN, "parent", PARENT_ROW_F1))), [
        ["held_book", BOOK_HELD],
        ["claimed_task", TODO_CLAIMED],
      ]);
      assert.deepEqual(items(succeeded(await flagged(SUPER_ADMIN, "family", FAMILY_2))), []);
    });

    it("drops each item once an administrator has handled it (BR205.2)", async () => {
      succeeded(await removeFamily(db, schema));
      const left = async () =>
        items(succeeded(await flagged(SUPER_ADMIN, "family", FAMILY_1))).map((item) => item.kind);

      await db.query("update loans set returned_at = now() where book_id = $1", [BOOK_HELD]);
      assert.ok(!(await left()).includes("held_book"));
      await db.query(
        `update todo_tasks set claimant_parent_id = $2, claimed_at = now(), status = 'in_progress',
           needs_attention = false where id = $1`,
        [TODO_CLAIMED, PARENT_ROW_F2],
      );
      assert.ok(!(await left()).includes("claimed_task"));
      await db.query(
        "update todo_tasks set status = 'done', done_at = now(), needs_attention = false where id = $1",
        [TODO_OF_FAMILY],
      );
      assert.ok(!(await left()).includes("family_task"));
      await db.query("update recurring_schedules set is_active = false where id = $1", [
        SCHEDULE_OF_FAMILY,
      ]);
      assert.ok(!(await left()).includes("family_schedule"));
      await db.query("update assignments set status = 'removed' where family_id = $1", [FAMILY_1]);
      assert.deepEqual(await left(), []);
    });
  });
}

/**
 * NFR9.1 to NFR9.4: the preview, the removal, the result page's list and the later run each take under 2 seconds on
 * the busiest family of the 30-family seed. Each is measured once, after one warm-up on the second busiest family.
 * The limit is that of the requirements and is never raised to make a run pass.
 */
const TIMING_SCHEMA = "worker_4";
const LIMIT_MS = 2000;

describe("removal timings on the large seed", () => {
  let db: pg.Client;

  before(async () => {
    db = await openDatabase();
    await lockSchemas(db, [TIMING_SCHEMA]);
    await prepareSchema(db, TIMING_SCHEMA);
    await selectSchema(db, TIMING_SCHEMA);
    await resetWorkerData(db, TIMING_SCHEMA);
    await seedSchema(realSeedDeps().deps, { schema: TIMING_SCHEMA, size: "large" });
  });
  after(async () => {
    await resetSchema(realSeedDeps().deps, { schema: TIMING_SCHEMA });
    await db.end();
  });

  /** The seeded super administrator, ready to call functions in the timing schema. */
  const timingAdmin = async () => {
    await selectSchema(db, TIMING_SCHEMA);
    const admin = seedAccount(TIMING_SCHEMA, "super-admin");
    const account = (
      await db.query("select id, organization_id from accounts where email = $1", [
        admin.email.toLowerCase(),
      ])
    ).rows[0] as { id: string; organization_id: string };
    await ensureAccount(db, {
      id: account.id,
      organization: account.organization_id,
      email: admin.email,
    });
    return account;
  };
  /** Removes a family and answers how long the command took, in milliseconds. */
  const timedRemoval = async (account: string, family: string): Promise<number> => {
    await selectSchema(db, TIMING_SCHEMA);
    const version = await familyVersion(db, family);
    const started = performance.now();
    succeeded(
      await callFunction(db, TIMING_SCHEMA, account, "family_archive($1, $2, $3)", [
        nextKey("t"),
        family,
        version,
      ]),
    );
    return performance.now() - started;
  };

  it("removes five families one after another, each in under 2 seconds (NFR5.5)", async () => {
    const account = await timingAdmin();
    const times: number[] = [];
    // Families 11 to 15 hold no staff right; the test below uses other families.
    for (let n = 11; n <= 15; n += 1) {
      times.push(await timedRemoval(account.id, seedId(TIMING_SCHEMA, `family:${n}`)));
    }
    report(
      `five family removals in a row: ${times.map((ms) => Math.round(ms)).join(", ")} ms (limit ${LIMIT_MS} ms each)`,
    );
    assert.ok(
      Math.max(...times) < LIMIT_MS,
      `the slowest took ${Math.round(Math.max(...times))} ms`,
    );
  });

  it("removes a family with three school years of records in under 2 seconds (NFR5.6)", async () => {
    const account = await timingAdmin();
    const family = seedId(TIMING_SCHEMA, "family:20");
    const parent = seedId(TIMING_SCHEMA, "parent:20:1");
    await selectSchema(db, TIMING_SCHEMA);
    // Three past years, forty records a year of each kind that grows with time: a done duty place with its closed
    // cancellation request and its notice, a returned loan, and a finished to-do task.
    await db.query(
      `create temporary table history as
         select n, gen_random_uuid() as task_id, gen_random_uuid() as place_id,
                date_trunc('day', now()) - make_interval(days => 30 + n * 9) as at
           from generate_series(1, 120) as g(n)`,
    );
    await db.query(
      `insert into tasks (id, organization_id, title, capacity, starts_at, ends_at, location)
       select task_id, $1, 'Régi feladat ' || n, 1, at, at + interval '1 hour', 'Udvar' from history`,
      [account.organization_id],
    );
    await db.query(
      `insert into assignments (id, organization_id, task_id, family_id, parent_id, source, status, done_at,
                                done_by)
       select place_id, $1, task_id, $2, $3, 'parent_sign_up', 'active', at, $3 from history`,
      [account.organization_id, family, parent],
    );
    await db.query(
      `insert into change_requests (id, organization_id, assignment_id, kind, status, ended_reason, reason,
                                    source_task_id, source_assignment_version, source_family_id, source_confirmed)
       select gen_random_uuid(), $1, place_id, 'cancellation', 'expired', 'duty_started', 'Régi kérelem', task_id, 1,
              $2, false from history`,
      [account.organization_id, family],
    );
    await db.query(
      `insert into notifications (id, organization_id, parent_id, kind, target_type, target_ref, task_id,
                                  task_starts_at, dedupe_key)
       select gen_random_uuid(), $1, $2, 'sign_up_confirmed', 'task', task_id, task_id, at, 'history:' || n
         from history`,
      [account.organization_id, parent],
    );
    await db.query(
      `insert into loans (organization_id, book_id, borrower_parent_id, borrower_family_id, borrowed_at, returned_at)
       select $1, (select id from books where organization_id = $1 order by id limit 1), $2, $3,
              at, at + interval '5 days' from history`,
      [account.organization_id, parent, family],
    );
    await db.query(
      `insert into todo_tasks (organization_id, owner_group_id, topic, status, claimant_parent_id, claimed_at, done_at,
                               done_by_parent_id)
       select $1, $2, 'Régi teendő ' || n, 'done', $3, at, at, $3 from history`,
      [account.organization_id, seedId(TIMING_SCHEMA, "group:1"), parent],
    );
    await db.query("drop table history");

    const elapsed = await timedRemoval(account.id, family);

    report(
      `family removal with three years of history: ${Math.round(elapsed)} ms (limit ${LIMIT_MS} ms)`,
    );
    assert.ok(elapsed < LIMIT_MS, `it took ${Math.round(elapsed)} ms`);
  });

  it("previews, removes, lists and later anonymises the busiest family, each in under 2 seconds (NFR9.1 to NFR9.4)", async () => {
    await selectSchema(db, TIMING_SCHEMA);
    const admin = seedAccount(TIMING_SCHEMA, "super-admin");
    const account = (
      await db.query("select id, organization_id from accounts where email = $1", [
        admin.email.toLowerCase(),
      ])
    ).rows[0];
    await ensureAccount(db, {
      id: account.id,
      organization: account.organization_id,
      email: admin.email,
    });
    // The families with the most records, leaving out any that holds a super admin (that removal is refused).
    const busiest = (
      await db.query(
        `select f.id,
                (select count(*) from assignments a where a.family_id = f.id)
              + (select count(*) from notifications n join parents p on p.id = n.parent_id where p.family_id = f.id)
              + (select count(*) from loans l where l.borrower_family_id = f.id)
              + (select count(*) from todo_tasks t
                  where t.owner_family_id = f.id
                     or t.claimant_parent_id in (select p.id from parents p where p.family_id = f.id))
              + (select count(*) from books b join parents p on p.id = b.owner_parent_id where p.family_id = f.id)
              + (select count(*) from group_memberships m join parents p on p.id = m.parent_id
                  where p.family_id = f.id) as records
           from families f
          where f.status = 'active'
            and not exists (select 1 from parents p join app_role_grants g on g.subject_id = p.account_id
                             where p.family_id = f.id and g.role = 'super_admin' and g.revoked_at is null)
          order by records desc, f.id limit 2`,
      )
    ).rows as { id: string; records: string }[];
    const [subject, warmUp] = [busiest[0]!, busiest[1]!];
    // The seed gives its first family a record of every kind, so the timings below measure every step with work to do.
    // The browser timing (tests/browser/removal-timing.spec.ts) removes the same family.
    assert.equal(subject.id, seedId(TIMING_SCHEMA, "family:1"));
    await selectSchema(db, TIMING_SCHEMA);
    const full = succeeded(
      await callFunction(db, TIMING_SCHEMA, account.id, "removal_preview('family', $1)", [
        subject.id,
      ]),
    );
    const empty = (full.steps as { block: string; to_clear: number; to_flag: number }[])
      .filter((step) => step.to_clear + step.to_flag === 0)
      .map((step) => step.block);
    assert.deepEqual(empty, [], "every removal step has something to do for the busiest family");
    report(`busiest family's preview: ${JSON.stringify(full.steps)}`);

    const call = async (sql: string, values: unknown[]): Promise<Result> =>
      succeeded(await callFunction(db, TIMING_SCHEMA, account.id, sql, values));
    const version = async (family: string) => {
      await selectSchema(db, TIMING_SCHEMA);
      return familyVersion(db, family);
    };
    const operations: [string, (family: string) => Promise<() => Promise<unknown>>][] = [
      ["removal preview", async (family) => () => call("removal_preview('family', $1)", [family])],
      [
        "family removal",
        async (family) => {
          const current = await version(family);
          return () => call("family_archive($1, $2, $3)", [nextKey("t"), family, current]);
        },
      ],
      [
        "flagged items",
        async (family) => () => call("removal_flagged_items('family', $1)", [family]),
      ],
      [
        "later run",
        async (family) => {
          await selectSchema(db, TIMING_SCHEMA);
          await db.query(
            "update families set archived_at = now() - interval '40 days' where id = $1",
            [family],
          );
          const current = await version(family);
          return () => call("lifecycle_run($1, $2, $3, true)", [nextKey("t"), family, current]);
        },
      ],
    ];
    for (const [label, prepare] of operations) {
      await (
        await prepare(warmUp.id)
      )();
      const work = await prepare(subject.id);
      const started = performance.now();
      await work();
      const elapsed = performance.now() - started;
      report(
        `${label} on the busiest family (${subject.records} records): ${Math.round(elapsed)} ms (limit ${LIMIT_MS} ms)`,
      );
      assert.ok(elapsed < LIMIT_MS, `${label} took ${Math.round(elapsed)} ms`);
    }
  });
});
