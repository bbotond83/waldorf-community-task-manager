import type pg from "pg";
import {
  CO_PARENT_F1,
  DEACTIVATED,
  FAMILY_2,
  GROUP_1,
  GROUP_2,
  nextKey,
  ORGANIZATION,
  OTHER_ORGANIZATION,
  OUTSIDER,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import {
  auditRows,
  caller,
  COMMUNITY_EVENT,
  GROUP_EVENT,
  noticeRows,
  seedEventWorld,
} from "./events-support.ts";
import {
  ADMIN_G1,
  ADMIN_G2,
  FAMILY_1,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_ADMIN_G1,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  SUPER_ADMIN,
} from "./working-groups-support.ts";

export {
  ADMIN_G1,
  ADMIN_G2,
  auditRows,
  caller,
  CO_PARENT_F1,
  COMMUNITY_EVENT,
  DEACTIVATED,
  FAMILY_1,
  FAMILY_2,
  GROUP_1,
  GROUP_2,
  GROUP_EVENT,
  nextKey,
  noticeRows,
  ORGANIZATION,
  OTHER_ORGANIZATION,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_ADMIN_G1,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  SUPER_ADMIN,
  TEACHER_G1,
  uuid,
};

export type Call = ReturnType<typeof caller>;
export type Answer = Awaited<ReturnType<Call>>;

/** Invented ids of to-do tasks the tests write straight into the table. */
export const TODO_A = uuid(9801);
export const TODO_B = uuid(9802);
export const TODO_C = uuid(9803);
export const TODO_FAMILY = uuid(9804);

/** Empties the to-do tables and seeds the event world (groups, families, parents, events). */
export async function seedTodoWorld(db: pg.Client, schema: string): Promise<void> {
  await seedEventWorld(db, schema);
  await db.query("truncate todo_event_links, todo_task_history, todo_tasks cascade");
}

export type TodoOptions = {
  id?: string;
  group?: string | null;
  family?: string | null;
  topic?: string;
  priority?: number | null;
  status?: string;
  note?: string | null;
  notBefore?: string | null;
  deadline?: string | null;
  claimant?: string | null;
  doneBy?: string | null;
  attention?: boolean;
};

/** One to-do task written as the schema owner (the commands have their own tests). */
export async function insertTodo(db: pg.Client, options: TodoOptions = {}): Promise<string> {
  const family = options.family ?? null;
  const group = options.group === undefined && family === null ? GROUP_1 : (options.group ?? null);
  const status = options.status ?? (options.claimant ? "in_progress" : "open");
  const row = await db.query(
    `insert into todo_tasks (id, organization_id, owner_group_id, owner_family_id, topic, priority, status, note,
                             not_before, deadline, claimant_parent_id, claimed_at, done_at, done_by_parent_id, needs_attention)
     values (coalesce($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             case when $11::uuid is null then null else now() end,
             case when $7 = 'done' then now() end, $12, $13)
     returning id`,
    [
      options.id ?? null,
      ORGANIZATION,
      group,
      family,
      options.topic ?? "Kerítés javítása",
      options.priority ?? null,
      status,
      options.note ?? null,
      options.notBefore ?? null,
      options.deadline ?? null,
      options.claimant ?? null,
      options.doneBy ?? null,
      options.attention ?? false,
    ],
  );
  return row.rows[0].id as string;
}

export type TodoRow = {
  id: string;
  status: string;
  version: number;
  note: string | null;
  claimant_parent_id: string | null;
  claimed_at: Date | null;
  done_at: Date | null;
  done_by_parent_id: string | null;
  needs_attention: boolean;
  owner_group_id: string | null;
  owner_family_id: string | null;
  topic: string;
  deadline: string | null;
};

export const todoRow = async (db: pg.Client, id: string): Promise<TodoRow> =>
  (await db.query("select * from todo_tasks where id = $1", [id])).rows[0] as TodoRow;

export const historyOf = async (db: pg.Client, id: string) =>
  (
    await db.query(
      "select change, from_status, to_status, actor_kind, changed_by_parent_id, event_id from todo_task_history where task_id = $1 order by changed_at, id",
      [id],
    )
  ).rows as {
    change: string;
    from_status: string | null;
    to_status: string | null;
    actor_kind: string;
    changed_by_parent_id: string | null;
    event_id: string | null;
  }[];

/** The body of a new group-owned task as a coordinator would save it. */
export const newTask = (extra: Record<string, unknown> = {}) => ({
  owner_group_id: GROUP_1,
  topic: "Pad festése",
  ...extra,
});

export const json = (value: unknown): string => JSON.stringify(value);

/** todo_task_save as one call. */
export const save = (call: Call, account: string, body: unknown, key = nextKey("sv")) =>
  call(account, "todo_task_save($1, $2::jsonb)", [key, json(body)]);

export const claim = (
  call: Call,
  account: string,
  id: string,
  version: number,
  key = nextKey("cl"),
) => call(account, "todo_task_claim($1, $2, $3)", [key, id, version]);
export const giveBack = (
  call: Call,
  account: string,
  id: string,
  version: number,
  key = nextKey("gb"),
) => call(account, "todo_task_give_back($1, $2, $3)", [key, id, version]);
export const freeClaim = (
  call: Call,
  account: string,
  id: string,
  version: number,
  key = nextKey("fc"),
) => call(account, "todo_task_free_claim($1, $2, $3)", [key, id, version]);
export const update = (
  call: Call,
  account: string,
  id: string,
  status: string | null,
  note: string | null,
  version: number,
  key = nextKey("up"),
) => call(account, "todo_task_update($1, $2, $3, $4, $5)", [key, id, status, note, version]);
export const markDone = (
  call: Call,
  account: string,
  id: string,
  version: number,
  key = nextKey("md"),
) => call(account, "todo_task_mark_done($1, $2, $3)", [key, id, version]);
export const undoDone = (
  call: Call,
  account: string,
  id: string,
  version: number,
  key = nextKey("ud"),
) => call(account, "todo_task_undo_done($1, $2, $3)", [key, id, version]);

export const outcome = (answer: { state: string; code: string | null }) => [
  answer.state,
  answer.code,
];
