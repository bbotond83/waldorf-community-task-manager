import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import type pg from "pg";
import {
  ASSIGNMENT_F2_T3,
  CO_PARENT_F1,
  callFunction,
  DEACTIVATED,
  FAMILY_1,
  FAMILY_2,
  GROUP_1,
  nextKey,
  ORGANIZATION,
  PARENT_F1,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  REQUEST_1,
  SIGNED_OUT,
  SUPER_ADMIN,
  TASK_1,
  TASK_3,
  uuid,
} from "./directory-support.ts";
import { COMMUNITY_EVENT, FOOD_EVENT, insertEvent } from "./events-support.ts";
import { insertBook, insertLoan, insertWatch } from "./library-support.ts";
import { dayOffset, insertOccurrence, insertSchedule } from "./recurring-support.ts";
import { sessionIdFor } from "./stack-support.ts";
import { insertTodo } from "./todo-support.ts";
import { seedGroupWorld } from "./working-groups-support.ts";

/**
 * The shared world of the U14 removal tests: the group world plus at least one record of every kind that a removal
 * touches, for the first family (the subject) and, beside it, the same kinds for the second family (which must stay).
 * Every name and text is invented. Texts start with "saját" when the subject wrote them, "más" when someone else did and
 * "közös" when they belong to shared work.
 */

export type Result = Awaited<ReturnType<typeof callFunction>>;
export type Step = { block: string; to_clear: number; to_flag: number };

export const STEP_ORDER = [
  "rota_planning",
  "dutychanges",
  "duties",
  "checklists",
  "todo",
  "library",
  "events",
  "recurring_duties",
  "notifications",
  "working_groups",
  "directory",
];

/** The four sign-in accounts of the first family's parents, in the order the commands return them. */
export const FAMILY_1_ACCOUNTS = [PARENT_F1, CO_PARENT_F1, DEACTIVATED, SIGNED_OUT].sort();

/** Names that no read other people use may show after the first family is removed. */
export const FAMILY_1_NAMES = [
  "Fenyő család",
  "Fenyő Anna",
  "Fenyő Béla",
  "Fenyő Dóra",
  "Fenyő Emma",
];

/** A group whose only coordinator is the subject's first parent. */
export const GROUP_GARDEN = uuid(9951);
export const GROUP_GARDEN_NAME = "Kerti kör";

export const DUTY_PAST = uuid(9961);
export const DUTY_ROTA = uuid(9962);
export const DUTY_WEEKEND = uuid(9963);
export const DUTY_ANIMAL = uuid(9964);
export const DUTY_FREE = uuid(9965);
export const PLACE_PAST = uuid(9971);
export const PLACE_ROTA = uuid(9972);
export const PLACE_WEEKEND = uuid(9973);
export const PLACE_ANIMAL = uuid(9974);

export const ROTA_PLAN = uuid(9981);
export const ROTA_WEEK_FUTURE = uuid(9982);
export const ROTA_WEEK_PAST = uuid(9983);

export const REQUEST_DECIDED = uuid(9984);
export const REQUEST_OTHER = uuid(9985);

export const CHECKLIST_EVENT = uuid(9986);
export const CHECKLIST = uuid(9987);
export const CHECKLIST_SECTION = uuid(9988);
export const CHECK_TASK_OPEN = uuid(9989);
export const CHECK_TASK_DONE = uuid(9990);

export const TODO_CLAIMED = uuid(9991);
export const TODO_DONE = uuid(9992);
export const TODO_OF_FAMILY = uuid(9993);

export const BOOK_OWNED = uuid(9994);
export const BOOK_HELD = uuid(9995);
export const BOOK_WATCHED = uuid(9996);

export const SCHEDULE_OF_FAMILY = uuid(99011);
export const SCHEDULE_OF_GROUP = uuid(99012);
export const OCC_SKIPPED_OWN = uuid(99211);
export const OCC_SKIPPED_OTHER = uuid(99212);
export const OCC_DONE = uuid(99213);
export const OCC_SWITCHED_OFF = uuid(99214);

async function duties(db: pg.Client): Promise<void> {
  const duty = (id: string, title: string, days: number, origin: string, originId: string | null) =>
    db.query(
      `insert into tasks (id, organization_id, title, capacity, starts_at, ends_at, location, origin_kind, origin_id)
       values ($1, $2, $3, 2, now() + ($4 || ' days')::interval, now() + ($4 || ' days')::interval + interval '2 hours',
               'Udvar', $5, $6)`,
      [id, ORGANIZATION, title, String(days), origin, originId],
    );
  await duty(DUTY_PAST, "Múlt heti söprés", -7, "manual", null);
  await duty(DUTY_ROTA, "Belső takarítás", 14, "rota_week", ROTA_WEEK_FUTURE);
  await duty(DUTY_WEEKEND, "Hétvégi állatetetés", 15, "weekend_slot", uuid(9966));
  await duty(DUTY_ANIMAL, "Reggeli állatgondozás", 16, "animal_slot", uuid(9967));
  await duty(DUTY_FREE, "Szabad kerti nap", 17, "manual", null);
  for (const [id, task] of [
    [PLACE_PAST, DUTY_PAST],
    [PLACE_ROTA, DUTY_ROTA],
    [PLACE_WEEKEND, DUTY_WEEKEND],
    [PLACE_ANIMAL, DUTY_ANIMAL],
  ]) {
    await db.query(
      `insert into assignments (id, organization_id, task_id, family_id, parent_id, source, status)
       values ($1, $2, $3, $4, $5, 'admin_assign', 'active')`,
      [id, ORGANIZATION, task, FAMILY_1, PARENT_ROW_F1],
    );
  }
  await db.query("update assignments set done_at = now(), done_by = $2 where id = $1", [
    PLACE_PAST,
    PARENT_ROW_F1,
  ]);
}

async function rota(db: pg.Client): Promise<void> {
  const year = (await db.query("select school_year_id from groups where id = $1", [GROUP_1]))
    .rows[0].school_year_id as string;
  await db.query(
    `insert into rota_plans (id, organization_id, school_year_id, status, published_at, published_by)
     values ($1, $2, $3, 'published', now(), $4)`,
    [ROTA_PLAN, ORGANIZATION, year, SUPER_ADMIN],
  );
  await db.query(
    `insert into rota_weeks (id, organization_id, plan_id, job, week_start, family_id)
     values ($1, $3, $4, 'indoor_cleaning', date_trunc('week', now() + interval '14 days')::date, $5),
            ($2, $3, $4, 'front_garden', date_trunc('week', now() - interval '14 days')::date, $5)`,
    [ROTA_WEEK_FUTURE, ROTA_WEEK_PAST, ORGANIZATION, ROTA_PLAN, FAMILY_1],
  );
}

/** A decided request of the subject, and an open request of the second family that has nothing to do with it. */
async function requests(db: pg.Client): Promise<void> {
  await db.query("update change_requests set reason = 'saját indok, nyitott' where id = $1", [
    REQUEST_1,
  ]);
  await db.query(
    `insert into change_requests (id, organization_id, assignment_id, kind, requested_by_parent_id, source_task_id,
       source_assignment_version, status, ended_reason, decided_at, decided_by_account_id, reason)
     values ($1, $2, $3, 'cancellation', $4, $5, 1, 'rejected', 'administrator_rejected', now(), $6,
             'saját indok, lezárt')`,
    [REQUEST_DECIDED, ORGANIZATION, PLACE_PAST, PARENT_ROW_F1, DUTY_PAST, SUPER_ADMIN],
  );
  await db.query(
    `insert into change_requests (id, organization_id, assignment_id, kind, requested_by_parent_id, source_task_id,
       source_assignment_version, reason)
     values ($1, $2, $3, 'cancellation', $4, $5, 1, 'más indok')`,
    [REQUEST_OTHER, ORGANIZATION, ASSIGNMENT_F2_T3, PARENT_ROW_F2, TASK_3],
  );
}

async function events(db: pg.Client): Promise<void> {
  await insertEvent(db, { id: COMMUNITY_EVENT, title: "Közös ünnep" });
  await insertEvent(db, { id: FOOD_EVENT, title: "Közös étkezés", food: true });
  await db.query(
    `insert into event_signups (organization_id, event_id, parent_id, family_id, note)
     values ($1, $2, $3, $4, 'saját megjegyzés a jelentkezéshez'), ($1, $2, $5, $6, 'más megjegyzés a jelentkezéshez')`,
    [ORGANIZATION, COMMUNITY_EVENT, PARENT_ROW_F1, FAMILY_1, PARENT_ROW_F2, FAMILY_2],
  );
  await db.query(
    `insert into food_offers (organization_id, event_id, parent_id, category, text)
     values ($1, $2, $3, 'sweet', 'saját süti'), ($1, $2, $4, 'drinks', 'más szörp')`,
    [ORGANIZATION, FOOD_EVENT, PARENT_ROW_F1, PARENT_ROW_F2],
  );
  await db.query(
    `insert into event_roles (organization_id, event_id, name, parent_id, is_organiser)
     values ($1, $2, 'Szervező', $3, true)`,
    [ORGANIZATION, COMMUNITY_EVENT, PARENT_ROW_F1],
  );
}

async function checklist(db: pg.Client): Promise<void> {
  await insertEvent(db, { id: CHECKLIST_EVENT, title: "Lámpás ünnep" });
  await db.query(
    "insert into event_checklists (id, organization_id, event_id) values ($1, $2, $3)",
    [CHECKLIST, ORGANIZATION, CHECKLIST_EVENT],
  );
  await db.query(
    `insert into event_checklist_sections (id, organization_id, checklist_id, event_id, position, title, kind)
     values ($1, $2, $3, $4, 1, 'Szülők', 'parents')`,
    [CHECKLIST_SECTION, ORGANIZATION, CHECKLIST, CHECKLIST_EVENT],
  );
  await db.query(
    `insert into event_checklist_tasks (id, organization_id, event_id, section_id, position, title, helpers_needed)
     values ($1, $3, $4, $5, 1, 'Teát főzni', 5), ($2, $3, $4, $5, 2, 'Lámpásokat kivinni', 5)`,
    [CHECK_TASK_OPEN, CHECK_TASK_DONE, ORGANIZATION, CHECKLIST_EVENT, CHECKLIST_SECTION],
  );
  await db.query(
    "update event_checklist_tasks set done_at = now(), done_by_parent_id = $2 where id = $1",
    [CHECK_TASK_DONE, PARENT_ROW_F1],
  );
  const claim = (task: string, parent: string, family: string, note: string) =>
    db.query(
      `insert into checklist_claims (organization_id, event_id, task_id, parent_id, family_id, note)
       values ($1, $2, $3, $4, $5, $6)`,
      [ORGANIZATION, CHECKLIST_EVENT, task, parent, family, note],
    );
  await claim(CHECK_TASK_OPEN, PARENT_ROW_F1, FAMILY_1, "saját jegyzet a nyitott feladathoz");
  await claim(CHECK_TASK_DONE, PARENT_ROW_F1, FAMILY_1, "saját jegyzet a kész feladathoz");
  await claim(CHECK_TASK_OPEN, PARENT_ROW_F2, FAMILY_2, "más jegyzet");
}

async function todoLibraryAndRecurring(db: pg.Client): Promise<void> {
  await db.query("truncate todo_event_links, todo_task_history, todo_tasks cascade");
  await insertTodo(db, {
    id: TODO_CLAIMED,
    topic: "Kerítés festése",
    claimant: PARENT_ROW_F1,
    note: "közös leírás a feladatról",
  });
  await insertTodo(db, {
    id: TODO_DONE,
    topic: "Pad javítása",
    status: "done",
    doneBy: PARENT_ROW_F1,
  });
  await insertTodo(db, { id: TODO_OF_FAMILY, topic: "Mosás", family: FAMILY_1 });
  await db.query(
    `insert into todo_task_history (task_id, change, from_status, to_status, actor_kind, changed_by_parent_id)
     values ($1, 'created', null, 'open', 'parent', $2)`,
    [TODO_DONE, PARENT_ROW_F1],
  );

  await insertBook(db, {
    id: BOOK_OWNED,
    owner: PARENT_ROW_F1,
    title: "Erdei mesék",
    description: "közös könyvleírás",
  });
  await insertBook(db, { id: BOOK_HELD, owner: PARENT_ROW_F2, title: "Kertész könyv" });
  await insertBook(db, { id: BOOK_WATCHED, owner: PARENT_ROW_F2, title: "Madarak könyve" });
  await insertLoan(db, { book: BOOK_HELD, parent: PARENT_ROW_F1, family: FAMILY_1 });
  await insertLoan(db, { book: BOOK_WATCHED, parent: PARENT_ROW_F2, family: FAMILY_2 });
  await insertWatch(db, BOOK_WATCHED, PARENT_ROW_F1);

  await insertSchedule(db, {
    id: SCHEDULE_OF_FAMILY,
    kind: "family",
    family: FAMILY_1,
    title: "Törölközők mosása",
  });
  await insertSchedule(db, {
    id: SCHEDULE_OF_GROUP,
    kind: "group",
    group: GROUP_1,
    title: "Virágok locsolása",
  });
  await insertOccurrence(db, {
    id: OCC_SKIPPED_OWN,
    schedule: SCHEDULE_OF_GROUP,
    due: await dayOffset(db, -3),
    status: "skipped",
    reason: "saját ok a kihagyásra",
    skippedBy: PARENT_ROW_F1,
  });
  await insertOccurrence(db, {
    id: OCC_SKIPPED_OTHER,
    schedule: SCHEDULE_OF_GROUP,
    due: await dayOffset(db, -4),
    status: "skipped",
    reason: "más ok a kihagyásra",
    skippedBy: PARENT_ROW_F2,
  });
  await insertOccurrence(db, {
    id: OCC_DONE,
    schedule: SCHEDULE_OF_GROUP,
    due: await dayOffset(db, -5),
    status: "done",
    doneBy: PARENT_ROW_F1,
  });
  await insertOccurrence(db, {
    id: OCC_SWITCHED_OFF,
    schedule: SCHEDULE_OF_GROUP,
    due: await dayOffset(db, 9),
    status: "skipped",
    reason: "kikapcsolva",
    skippedBy: PARENT_ROW_F1,
  });
}

async function groupsAndNotices(db: pg.Client): Promise<void> {
  const year = (await db.query("select school_year_id from groups where id = $1", [GROUP_1]))
    .rows[0].school_year_id as string;
  await db.query(
    "insert into groups (id, organization_id, school_year_id, name, description) values ($1, $2, $3, $4, 'Kerti munkák.')",
    [GROUP_GARDEN, ORGANIZATION, year, GROUP_GARDEN_NAME],
  );
  await db.query(
    "insert into group_memberships (organization_id, parent_id, group_id) values ($1, $2, $3)",
    [ORGANIZATION, PARENT_ROW_F1, GROUP_GARDEN],
  );
  await db.query(
    "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, 'group_admin', 'group', $2, $3)",
    [PARENT_F1, GROUP_GARDEN, ORGANIZATION],
  );
  for (const [parent, task] of [
    [PARENT_ROW_F1, TASK_1],
    [PARENT_ROW_F2, TASK_3],
  ]) {
    await db.query(
      `insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, dedupe_key)
       select $1, $2, 'sign_up_confirmed', 'task', t.id, t.id, t.starts_at, $4 from tasks t where t.id = $3`,
      [ORGANIZATION, parent, task, `seed:${parent}`],
    );
  }
  await db.query("select reminder_plan_tasks($1::uuid[])", [[TASK_1, TASK_3]]);
}

export async function seedRemovalWorld(db: pg.Client, schema: string): Promise<void> {
  await seedGroupWorld(db, schema);
  await rota(db);
  await duties(db);
  await requests(db);
  await events(db);
  await checklist(db);
  await todoLibraryAndRecurring(db);
  await groupsAndNotices(db);
}

export const familyVersion = async (db: pg.Client, id: string): Promise<number> =>
  (await db.query("select version from families where id = $1", [id])).rows[0].version as number;
export const parentVersion = async (db: pg.Client, id: string): Promise<number> =>
  (await db.query("select version from parents where id = $1", [id])).rows[0].version as number;

export async function removeFamily(
  db: pg.Client,
  schema: string,
  family: string = FAMILY_1,
  account: string = SUPER_ADMIN,
  key: string = nextKey("rmf"),
  version?: number,
): Promise<Result> {
  return callFunction(db, schema, account, "family_archive($1, $2, $3)", [
    key,
    family,
    version ?? (await familyVersion(db, family)),
  ]);
}

export async function removeParent(
  db: pg.Client,
  schema: string,
  parent: string = PARENT_ROW_F1,
  account: string = SUPER_ADMIN,
  key: string = nextKey("rmp"),
  version?: number,
): Promise<Result> {
  return callFunction(db, schema, account, "parent_remove($1, $2, $3)", [
    key,
    parent,
    version ?? (await parentVersion(db, parent)),
  ]);
}

export const succeeded = (result: Result): Result => {
  assert.equal(result.state, "success", JSON.stringify(result));
  return result;
};
export const refusedWith = (result: Result, state: string, code: string): void =>
  assert.deepEqual([result.state, result.code], [state, code], JSON.stringify(result));

export const stepsOf = (result: Result): Step[] => result.steps as Step[];
export const stepOf = (result: Result, block: string): Step =>
  stepsOf(result).find((step) => step.block === block)!;

/** Every row of every table of the schema, to show that a refused or failed command changed nothing. */
export async function snapshot(db: pg.Client, schema: string): Promise<Record<string, string>> {
  const tables = (
    await db.query("select tablename from pg_tables where schemaname = $1 order by tablename", [
      schema,
    ])
  ).rows.map((row) => String(row.tablename));
  const rows: Record<string, string> = {};
  for (const table of tables) {
    const result = await db.query(
      `select coalesce(string_agg(to_jsonb(t)::text, E'\n' order by to_jsonb(t)::text), '') as r from "${schema}"."${table}" t`,
    );
    rows[table] = result.rows[0].r as string;
  }
  return rows;
}

/** Waits until a statement of the other connection waits on a lock, so the order of two commands is fixed. */
export async function waitUntilBlocked(observer: pg.Client, blocked: pg.Client): Promise<void> {
  const pid = (blocked as unknown as { processID: number }).processID;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const result = await observer.query(
      "select 1 from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'",
      [pid],
    );
    if (result.rowCount) return;
    await sleep(25);
  }
  assert.fail("the second command never waited for a lock");
}

/** Starts a transaction as a signed-in account and runs one call, leaving the transaction (and its locks) open. */
export async function callAndHold(
  db: pg.Client,
  schema: string,
  account: string,
  sql: string,
  values: readonly unknown[],
): Promise<Result> {
  await db.query("begin");
  await db.query(`set local search_path to "${schema}", pg_catalog`);
  await db.query("set local role authenticated");
  const claims = JSON.stringify({
    sub: account,
    role: "authenticated",
    session_id: sessionIdFor(account),
  });
  await db.query("select set_config('request.jwt.claims', $1, true)", [claims]);
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [account]);
  const result = await db.query(`select (${sql}) as result`, [...values]);
  return result.rows[0].result as Result;
}
