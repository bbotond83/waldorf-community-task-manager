import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ASSIGNMENT_F2_T3,
  callFunction,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  GROUP_1,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  OTHER_ADMIN,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  SUPER_ADMIN,
  TASK_1,
  uuid,
} from "./directory-support.ts";
import { COMMUNITY_EVENT } from "./events-support.ts";
import { auditEvents, count } from "./identity-support.ts";
import { insertWatch } from "./library-support.ts";
// Imported under another name: the lint rule for React hooks takes any `use…` call for a hook.
import { openDatabase, useSchema as selectSchema } from "./stack-support.ts";
import {
  BOOK_HELD,
  BOOK_WATCHED,
  callAndHold,
  CHECK_TASK_DONE,
  CHECK_TASK_OPEN,
  CHECKLIST_EVENT,
  familyVersion,
  OCC_DONE,
  OCC_SKIPPED_OTHER,
  PLACE_ROTA,
  refusedWith,
  type Result,
  removeFamily,
  REQUEST_DECIDED,
  ROTA_WEEK_PAST,
  SCHEDULE_OF_FAMILY,
  seedRemovalWorld,
  snapshot,
  STEP_ORDER,
  stepsOf,
  succeeded,
  TODO_CLAIMED,
  TODO_DONE,
  TODO_OF_FAMILY,
  waitUntilBlocked,
} from "./removal-support.ts";

/**
 * The later delete or anonymise of a family that left (U14, W4; BR206.1 to BR206.4; AC3.6.6; NFR1.5, NFR4.1 to
 * NFR4.3, NFR11.3, NFR11.4). The conditions that did not change are tested in lifecycle.test.ts. Here the family is
 * removed with the real command first, then the 30 days are made to have passed.
 */

/** The family with no places and no history, and its invented parent and child. */
const LONELY_PARENT = uuid(620);

/**
 * Every column that holds a family or parent id and that the "still referenced" check reads, with one statement that
 * makes it point at the lonely family ($1) or its parent. A statement that needs no id of one sort ignores it.
 */
const FORCES_ANONYMISE: [string, string, "family" | "parent"][] = [
  [
    "assignments.family_id",
    `insert into assignments (organization_id, task_id, family_id, source, status)
     values ('${ORGANIZATION}', '${TASK_1}', $1, 'admin_assign', 'removed')`,
    "family",
  ],
  [
    "assignments.parent_id",
    `update assignments set parent_id = $1 where id = '${ASSIGNMENT_F2_T3}'`,
    "parent",
  ],
  [
    "assignments.done_by",
    `update assignments set done_at = now(), done_by = $1 where id = '${PLACE_ROTA}'`,
    "parent",
  ],
  [
    "rota_weeks.family_id",
    `update rota_weeks set family_id = $1 where id = '${ROTA_WEEK_PAST}'`,
    "family",
  ],
  [
    "change_requests.source_family_id",
    `update change_requests set source_family_id = $1 where id = '${REQUEST_DECIDED}'`,
    "family",
  ],
  [
    "change_requests.target_family_id",
    `update change_requests set target_family_id = $1 where id = '${REQUEST_DECIDED}'`,
    "family",
  ],
  [
    "change_requests.requested_by_parent_id",
    `update change_requests set requested_by_parent_id = $1 where id = '${REQUEST_DECIDED}'`,
    "parent",
  ],
  [
    "recurring_schedules.family_id",
    `update recurring_schedules set family_id = $1 where id = '${SCHEDULE_OF_FAMILY}'`,
    "family",
  ],
  [
    "recurring_occurrences.done_by_parent_id",
    `update recurring_occurrences set done_by_parent_id = $1 where id = '${OCC_DONE}'`,
    "parent",
  ],
  [
    "recurring_occurrences.skipped_by_parent_id",
    `update recurring_occurrences set skipped_by_parent_id = $1 where id = '${OCC_SKIPPED_OTHER}'`,
    "parent",
  ],
  [
    "todo_tasks.owner_family_id",
    `update todo_tasks set owner_family_id = $1 where id = '${TODO_OF_FAMILY}'`,
    "family",
  ],
  [
    "todo_tasks.claimant_parent_id",
    `update todo_tasks set claimant_parent_id = $1 where id = '${TODO_CLAIMED}'`,
    "parent",
  ],
  [
    "todo_tasks.done_by_parent_id",
    `update todo_tasks set done_by_parent_id = $1 where id = '${TODO_DONE}'`,
    "parent",
  ],
  [
    "todo_task_history.changed_by_parent_id",
    `insert into todo_task_history (task_id, change, from_status, to_status, actor_kind, changed_by_parent_id)
     values ('${TODO_DONE}', 'created', null, 'open', 'parent', $1)`,
    "parent",
  ],
  [
    "event_signups.family_id",
    `update event_signups set family_id = $1 where parent_id = '${PARENT_ROW_F2}'`,
    "family",
  ],
  [
    "event_signups.parent_id",
    `update event_signups set parent_id = $1 where parent_id = '${PARENT_ROW_F2}'`,
    "parent",
  ],
  [
    "food_offers.parent_id",
    `update food_offers set parent_id = $1 where parent_id = '${PARENT_ROW_F2}'`,
    "parent",
  ],
  [
    "event_roles.parent_id",
    `update event_roles set parent_id = $1 where event_id = '${COMMUNITY_EVENT}'`,
    "parent",
  ],
  [
    "loans.borrower_family_id",
    `update loans set borrower_family_id = $1 where book_id = '${BOOK_WATCHED}'`,
    "family",
  ],
  [
    "loans.borrower_parent_id",
    `update loans set borrower_parent_id = $1 where book_id = '${BOOK_WATCHED}'`,
    "parent",
  ],
  [
    "books.owner_parent_id",
    `update books set owner_parent_id = $1 where id = '${BOOK_HELD}'`,
    "parent",
  ],
  [
    "checklist_claims.family_id",
    `update checklist_claims set family_id = $1 where parent_id = '${PARENT_ROW_F2}'`,
    "family",
  ],
  [
    "checklist_claims.parent_id",
    `update checklist_claims set parent_id = $1 where parent_id = '${PARENT_ROW_F2}'`,
    "parent",
  ],
  [
    "event_checklist_tasks.done_by_parent_id",
    `update event_checklist_tasks set done_by_parent_id = $1 where id = '${CHECK_TASK_DONE}'`,
    "parent",
  ],
];

/** The columns whose rows never keep a family: the run itself or the notification and library steps remove them. */
const REMOVED_BY_THE_RUN = [
  "children.family_id",
  "email_deliveries.parent_id",
  "family_year_standings.family_id",
  "group_memberships.parent_id",
  "migration_loads.family_id",
  "notifications.parent_id",
  "parent_profiles.parent_id",
  "parents.family_id",
  "reminder_recipients.family_id",
  "return_watches.parent_id",
];

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`removal: the later delete or anonymise in ${schema}`, () => {
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

    const run = async (
      family: string,
      account: string = SUPER_ADMIN,
      key: string = nextKey("later"),
      version?: number,
    ): Promise<Result> =>
      callFunction(db, schema, account, "lifecycle_run($1, $2, $3, true)", [
        key,
        family,
        version ?? (await familyVersion(db, family)),
      ]);
    const waited = (family: string) =>
      db.query("update families set archived_at = now() - interval '40 days' where id = $1", [
        family,
      ]);
    const removedLongAgo = async (family: string) => {
      succeeded(await removeFamily(db, schema, family));
      await waited(family);
    };
    const stateInList = async (family: string) => {
      const result = succeeded(
        await callFunction(db, schema, SUPER_ADMIN, "lifecycle_list(null)", []),
      );
      return (result.items as { family_id: string; state: string }[]).find(
        (item) => item.family_id === family,
      )?.state;
    };
    const lonelyParent = () =>
      db.query(
        "insert into parents (id, organization_id, family_id, display_name) values ($1, $2, $3, 'Csoport Géza')",
        [LONELY_PARENT, ORGANIZATION, FAMILY_NO_GROUP],
      );
    const referenced = async (family: string) =>
      (await db.query("select lifecycle_family_still_referenced($1) as r", [family])).rows[0]
        .r as boolean;

    it("allowed: anonymises a removed family with history, leaves no stored name or own text, and says what the steps did (BR206.2 to BR206.4, NFR1.5, NFR4.3)", async () => {
      // The invented world gives several families the same phone number and town: only the values that are this
      // family's alone can show whether something of it is left.
      const contacts = `select v.value from parent_profiles pr join parents p on p.id = pr.parent_id
        cross join lateral (values (pr.email_on_record), (pr.phone), (pr.residence), (pr.occupation), (pr.hobby))
          as v(value) where v.value is not null and p.family_id`;
      const stored = (
        await db.query(
          `select display_name as value from families where id = $1
           union select display_name from parents where family_id = $1
           union select display_name from children where family_id = $1
           union (${contacts} = $1 except ${contacts} <> $1)`,
          [FAMILY_1],
        )
      ).rows.map((row) => String(row.value));
      assert.ok(stored.length > 4, "the family has names and contacts before");
      await removedLongAgo(FAMILY_1);
      assert.equal(await stateInList(FAMILY_1), "eligible-anonymize");

      const result = succeeded(await run(FAMILY_1));

      assert.deepEqual(Object.keys(result).sort(), [
        "audit_event_id",
        "code",
        "outcome",
        "reference",
        "state",
        "steps",
      ]);
      assert.equal(result.outcome, "anonymized");
      assert.deepEqual(
        stepsOf(result).map((step) => step.block),
        STEP_ORDER,
      );
      assert.deepEqual(
        stepsOf(result).filter((step) => step.to_clear !== 0),
        [],
        "the removal had finished every step",
      );
      const left = Object.entries(await snapshot(db, schema))
        // A deactivated account keeps its e-mail: the one documented exception (BR35.2).
        .filter(([table]) => table !== "accounts")
        .flatMap(([table, rows]) =>
          [...stored, "saját"]
            .filter((value) => rows.includes(value))
            .map((value) => `${table}: ${value}`),
        );
      assert.deepEqual(left, []);
      const event = (await auditEvents(db)).find(
        (entry) => entry.action === "lifecycle.anonymize",
      )!;
      assert.deepEqual(
        [event.target_type, event.target_id, event.actor_account_id, event.outcome],
        ["family", FAMILY_1, SUPER_ADMIN, "success"],
      );
      assert.match(String(event.details), /directory:0:\d+.*ended_accounts:0$/);
      for (const value of stored) assert.ok(!String(event.details).includes(value));
    });

    it("clears a link that a click left behind during the removal, when the later run repeats the steps (BR206.2, NFR11.3)", async () => {
      await removedLongAgo(FAMILY_1);
      // What the race tests showed can survive: a checklist claim and a to-do claim of a removed parent.
      await db.query(
        `insert into checklist_claims (organization_id, event_id, task_id, parent_id, family_id, note)
         values ($1, $2, $3, $4, $5, 'saját jegyzet a verseny után')`,
        [ORGANIZATION, CHECKLIST_EVENT, CHECK_TASK_OPEN, PARENT_ROW_F1, FAMILY_1],
      );
      await db.query(
        `update todo_tasks set claimant_parent_id = $2, claimed_at = now(), status = 'in_progress'
          where id = $1`,
        [TODO_CLAIMED, PARENT_ROW_F1],
      );
      await insertWatch(db, BOOK_HELD, PARENT_ROW_F1);

      const result = succeeded(await run(FAMILY_1));

      assert.equal(result.outcome, "anonymized");
      for (const block of ["checklists", "todo", "library"]) {
        assert.ok(stepsOf(result).find((step) => step.block === block)!.to_clear > 0, block);
      }
      assert.equal(await count(db, "checklist_claims", `parent_id = '${PARENT_ROW_F1}'`), 0);
      assert.equal(await count(db, "todo_tasks", `claimant_parent_id = '${PARENT_ROW_F1}'`), 0);
      assert.equal(await count(db, "return_watches", `parent_id = '${PARENT_ROW_F1}'`), 0);
    });

    it("checks every column that holds a family or parent id, so a new one cannot be forgotten (NFR11.4)", async () => {
      const columns = (
        await db.query(
          `select table_name || '.' || column_name as name from information_schema.columns
            where table_schema = $1
              and (column_name like '%family\\_id' or column_name like '%parent\\_id' or column_name = 'done_by')
            order by 1`,
          [schema],
        )
      ).rows.map((row) => String(row.name));
      assert.deepEqual(
        columns,
        [...FORCES_ANONYMISE.map(([column]) => column), ...REMOVED_BY_THE_RUN].sort(),
      );
    });

    it("each kind of record that still points at the family or its parent forces anonymise (BR206.3, BR206.4)", async () => {
      await lonelyParent();
      for (const [column, statement, sort] of FORCES_ANONYMISE) {
        await db.query("begin");
        try {
          assert.equal(await referenced(FAMILY_NO_GROUP), false, `${column}: before`);
          const changed = await db.query(statement, [
            sort === "family" ? FAMILY_NO_GROUP : LONELY_PARENT,
          ]);
          assert.ok(changed.rowCount! > 0, `${column}: the statement changed a record`);
          assert.equal(await referenced(FAMILY_NO_GROUP), true, column);
        } finally {
          await db.query("rollback");
        }
      }
    });

    it("deletes a family that nothing of history points at, and no column of any table is left pointing at it (BR206.3, NFR11.4)", async () => {
      await lonelyParent();
      await db.query(
        "insert into children (organization_id, family_id, display_name) values ($1, $2, 'Csoport Dani')",
        [ORGANIZATION, FAMILY_NO_GROUP],
      );
      await db.query(
        "insert into group_memberships (organization_id, parent_id, group_id) values ($1, $2, $3)",
        [ORGANIZATION, LONELY_PARENT, GROUP_1],
      );
      await db.query(
        `insert into family_year_standings (organization_id, family_id, school_year_id, standing)
         select $1, $2, school_year_id, 'leaving' from groups where id = $3`,
        [ORGANIZATION, FAMILY_NO_GROUP, GROUP_1],
      );
      await db.query(
        `insert into event_signups (organization_id, event_id, parent_id, family_id, note)
         values ($1, $2, $3, $4, 'saját megjegyzés')`,
        [ORGANIZATION, COMMUNITY_EVENT, LONELY_PARENT, FAMILY_NO_GROUP],
      );
      await insertWatch(db, BOOK_WATCHED, LONELY_PARENT);
      await db.query(
        `insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, dedupe_key)
         select $1, $2, 'sign_up_confirmed', 'task', t.id, t.id, t.starts_at, 'lonely' from tasks t where t.id = $3`,
        [ORGANIZATION, LONELY_PARENT, TASK_1],
      );
      await db.query(
        `insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id)
         values ($1, 'parent', 'family', $2, $3)`,
        [PARENT_F2, FAMILY_NO_GROUP, ORGANIZATION],
      );
      await db.query(
        `insert into migration_loads (source_key, organization_id, family_id, payload_hash)
         values ('invented-row-1', $1, $2, $3)`,
        [ORGANIZATION, FAMILY_NO_GROUP, randomBytes(32).toString("hex")],
      );
      await removedLongAgo(FAMILY_NO_GROUP);
      assert.equal(await stateInList(FAMILY_NO_GROUP), "eligible-delete");

      const result = succeeded(await run(FAMILY_NO_GROUP));

      assert.equal(result.outcome, "deleted");
      for (const column of [...FORCES_ANONYMISE.map(([name]) => name), ...REMOVED_BY_THE_RUN]) {
        const [table, field] = column.split(".") as [string, string];
        assert.equal(
          await count(db, table, `${field} in ('${FAMILY_NO_GROUP}', '${LONELY_PARENT}')`),
          0,
          column,
        );
      }
      assert.equal(await count(db, "families", `id = '${FAMILY_NO_GROUP}'`), 0);
      assert.equal(await count(db, "app_role_grants", `scope_id = '${FAMILY_NO_GROUP}'`), 0);
      for (const [table, rows] of Object.entries(await snapshot(db, schema))) {
        // The audit trail and the stored results keep the id of what happened; they are never rewritten (NFR4.2).
        if (table === "audit_events" || table === "idempotency_records") continue;
        for (const id of [FAMILY_NO_GROUP, LONELY_PARENT]) {
          assert.ok(!rows.includes(id), `${table} still holds ${id}`);
        }
      }
      assert.equal(await count(db, "audit_events", "action = 'lifecycle.delete'"), 1);
      assert.equal(await count(db, "audit_events", "action = 'lifecycle.family_removed'"), 1);
    });

    it("refused and out of reach: only a super admin of the family's community runs it, and nothing changes otherwise (BR200.1)", async () => {
      await removedLongAgo(FAMILY_1);
      const before = await snapshot(db, schema);
      for (const account of [ADMIN_G1, PARENT_F2]) {
        refusedWith(await run(FAMILY_1, account), "denied", "authorization_denied");
      }
      refusedWith(await run(FAMILY_1, PARENT_F1), "denied", "session_inactive");
      refusedWith(await run(FAMILY_1, OTHER_ADMIN), "validation", "family_not_found");
      assert.deepEqual((await snapshot(db, schema)).families, before.families);
      assert.deepEqual((await snapshot(db, schema)).parents, before.parents);
    });

    it("outdated screen and repeated click: a stale version is refused; the same key gives the same outcome once (BR200.3, NFR5.3, NFR5.4)", async () => {
      await removedLongAgo(FAMILY_1);
      const version = await familyVersion(db, FAMILY_1);
      refusedWith(
        await run(FAMILY_1, SUPER_ADMIN, nextKey("old"), version - 1),
        "invalidated",
        "LIFECYCLE_STALE",
      );
      const key = nextKey("click");
      const first = succeeded(await run(FAMILY_1, SUPER_ADMIN, key, version));
      const after = await snapshot(db, schema);

      const again = succeeded(await run(FAMILY_1, SUPER_ADMIN, key, version));

      assert.equal(again.code, "replayed");
      assert.deepEqual(
        [again.outcome, again.audit_event_id, again.steps],
        [first.outcome, first.audit_event_id, first.steps],
      );
      assert.deepEqual(await snapshot(db, schema), after);
    });

    it("two people at once: the second run waits and changes nothing, for a deleted and for an anonymised family (NFR5.2)", async () => {
      for (const [family, expected] of [
        [FAMILY_1, "anonymized"],
        [FAMILY_NO_GROUP, "deleted"],
      ] as const) {
        await seedRemovalWorld(db, schema);
        await removedLongAgo(family);
        const version = await familyVersion(db, family);
        const [holder, other] = [await openDatabase(), await openDatabase()];
        try {
          await selectSchema(holder, schema);
          await selectSchema(other, schema);
          const first = await callAndHold(
            holder,
            schema,
            SUPER_ADMIN,
            "lifecycle_run($1, $2, $3, true)",
            [nextKey("two"), family, version],
          );
          const second = callFunction(
            other,
            schema,
            SUPER_ADMIN,
            "lifecycle_run($1, $2, $3, true)",
            [nextKey("two"), family, version],
          );
          await waitUntilBlocked(db, other);
          await holder.query("commit");
          assert.equal(succeeded(first).outcome, expected);
          const late = await second;
          assert.ok(
            ["family_not_found", "LIFECYCLE_STALE"].includes(String(late.code)),
            JSON.stringify(late),
          );
          assert.notEqual(late.state, "success");
        } finally {
          await holder.query("rollback");
          await holder.end();
          await other.end();
        }
        assert.equal(
          await count(db, "audit_events", "action in ('lifecycle.delete', 'lifecycle.anonymize')"),
          1,
        );
      }
    });

    it("a failed audit write rolls the whole run back (NFR4.1, NFR11.1)", async () => {
      await removedLongAgo(FAMILY_1);
      await db.query(
        `create function refuse_audit() returns trigger language plpgsql as $$ begin
           if new.action = 'lifecycle.anonymize' then raise exception 'injected failure' using errcode = 'XX000'; end if;
           return new; end $$`,
      );
      await db.query(
        "create trigger refuse_audit before insert on audit_events for each row execute function refuse_audit()",
      );
      const before = await snapshot(db, schema);
      try {
        await assert.rejects(run(FAMILY_1), { code: "XX000" });
        assert.deepEqual(await snapshot(db, schema), before);
      } finally {
        await db.query("drop trigger refuse_audit on audit_events");
        await db.query("drop function refuse_audit()");
      }
    });

    it("never takes another family's records with it (BR206.2)", async () => {
      const others = async () => ({
        claims: await count(db, "checklist_claims", `family_id = '${FAMILY_2}'`),
        places: await count(db, "assignments", `family_id = '${FAMILY_2}' and status <> 'removed'`),
        loans: await count(db, "loans", `borrower_family_id = '${FAMILY_2}'`),
        signups: await count(db, "event_signups", `family_id = '${FAMILY_2}'`),
      });
      const before = await others();
      await removedLongAgo(FAMILY_1);
      succeeded(await run(FAMILY_1));
      assert.deepEqual(await others(), before);
    });
  });
}
