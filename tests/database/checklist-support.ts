import type pg from "pg";
import { nextKey } from "./directory-support.ts";
import {
  auditRows,
  caller,
  COMMUNITY_EVENT,
  GROUP_EVENT,
  insertEvent,
  seedEventWorld,
} from "./events-support.ts";
import { uuid } from "./identity-support.ts";
import { SUPER_ADMIN } from "./working-groups-support.ts";

export {
  auditRows,
  caller,
  COMMUNITY_EVENT,
  GROUP_EVENT,
  insertEvent,
  nextKey,
  seedEventWorld,
  uuid,
};

/** Plain payload builders for the checklist functions (invented content only). */
export type TaskBody = Record<string, unknown> & { title: string };
export const taskBody = (title: string, extra: Record<string, unknown> = {}): TaskBody => ({
  title,
  ...extra,
});
export const sectionBody = (title: string, tasks: TaskBody[], kind: string = "parents") => ({
  title,
  kind,
  tasks,
});
export const templateBody = (
  name: string,
  sections: ReturnType<typeof sectionBody>[],
  extra: Record<string, unknown> = {},
): { name: string; sections: ReturnType<typeof sectionBody>[] } & Record<string, unknown> => ({
  name,
  sections,
  ...extra,
});

export type Call = ReturnType<typeof caller>;
export type Result = Awaited<ReturnType<Call>>;

export const json = (value: unknown): string => JSON.stringify(value);

/** template_save as one call, with a fresh key unless one is given. */
export const saveTemplate = (call: Call, account: string, body: unknown, key = nextKey("tpl")) =>
  call(account, "template_save($1, $2::jsonb)", [key, json(body)]);

export const setRemoved = (
  call: Call,
  account: string,
  id: string,
  removed: boolean,
  version: number,
  key = nextKey("rm"),
) => call(account, "template_set_removed($1, $2, $3, $4)", [key, id, removed, version]);

/** The whole checklist of an event as the reader sees it. */
export type ChecklistClaimView = {
  id: string;
  version: number;
  parent_display_name: string | null;
  family_display_name: string | null;
  typed_name: string | null;
  note: string | null;
  chosen_at: string | null;
  outside_event: boolean;
  is_own: boolean;
  can_remove: boolean;
};
export type ChecklistTaskView = {
  id: string;
  position: number;
  title: string;
  tip: string | null;
  summer_only: boolean;
  helpers_needed: number;
  helpers_taken: number;
  time_matters: boolean;
  version: number;
  deadline: string | null;
  source_ref: string | null;
  done: { at: string; by_display_name: string; is_own: boolean } | null;
  claims: ChecklistClaimView[];
  can: { claim: boolean; mark_done: boolean; undo_done: boolean };
};
export type ChecklistSectionView = {
  id: string;
  position: number;
  title: string;
  kind: string;
  version: number;
  tasks: ChecklistTaskView[];
};
export type ChecklistView = Result & {
  item: {
    checklist_version: number;
    is_empty: boolean;
    is_open: boolean;
    is_finished: boolean;
    signup_deadline: string | null;
    all_done: boolean | null;
    copied_from_template_id: string | null;
    sections: ChecklistSectionView[];
    caller: { in_team: boolean; can_manage: boolean; can_claim_tasks: boolean };
  };
};

export const checklistOf = async (call: Call, account: string, event: string) =>
  (await call(account, "checklist_get($1)", [event])) as ChecklistView;

/** A template saved as the schema owner would see it, returning its id (the save must succeed). */
export async function newTemplate(
  call: Call,
  account: string,
  body: ReturnType<typeof templateBody>,
): Promise<string> {
  const saved = await saveTemplate(call, account, body);
  if (saved.state !== "success") {
    throw new Error(`template_save failed: ${saved.code}`);
  }
  return saved.reference as string;
}

/** An event's checklist built straight from a template, as the event's manager. */
export async function copyInto(
  call: Call,
  account: string,
  event: string,
  template: string,
  key = nextKey("copy"),
) {
  return call(account, "checklist_copy_template($1, $2, $3)", [key, event, template]);
}

/** The common starter: one parents' section with two tasks, one organisers' section, one teachers' section. */
export const SAMPLE = templateBody(
  "Minta lista",
  [
    sectionBody("Szülők", [
      taskBody("Székek bevitele", { helpers_needed: 2 }),
      taskBody("Süti sütése", { time_matters: true, tip: "Hozz tálcát" }),
      taskBody("Nyári virágok", { summer_only: true }),
    ]),
    sectionBody("Szervezők", [taskBody("Értesítő küldése")], "organisers"),
    sectionBody("Óvónők", [taskBody("Dal kiválasztása", { helpers_needed: 5 })], "teachers"),
  ],
  { default_lead_days: 14 },
);

/** Rows of a checklist table for one event, as the schema owner reads them. */
export const rowsOf = async (
  db: pg.Client,
  table: string,
  where = "true",
  values: unknown[] = [],
) =>
  (await db.query(`select * from ${table} where ${where}`, values)).rows as Record<
    string,
    unknown
  >[];

/** Marks a parent row as organiser of an event, as the schema owner (the role command is U10's and tested there). */
export async function makeOrganiser(
  db: pg.Client,
  event: string,
  parentRow: string,
): Promise<void> {
  await db.query(
    `insert into event_roles (organization_id, event_id, name, parent_id, is_organiser)
     values ((select organization_id from events where id = $1), $1, 'Szervező', $2, true)`,
    [event, parentRow],
  );
}

export const setSummer = (db: pg.Client, event: string, summer: boolean) =>
  db.query("update events set is_summer = $2 where id = $1", [event, summer]);

/** A copy of SAMPLE into the event, as its manager. */
export async function seedSampleChecklist(
  call: Call,
  manager: string,
  event: string,
  summer = true,
  db?: pg.Client,
): Promise<string> {
  if (db) {
    await setSummer(db, event, summer);
  }
  const template = await newTemplate(call, SUPER_ADMIN, SAMPLE);
  const copied = await copyInto(call, manager, event, template);
  if (copied.state !== "success") {
    throw new Error(`copy failed: ${copied.code}`);
  }
  return template;
}

/** A claim written as the schema owner, for tests of rules that only need one to exist (the claim command has its own). */
export async function claimDirect(
  db: pg.Client,
  task: string,
  parentRow: string | null,
  family: string | null,
  typedName: string | null = null,
): Promise<string> {
  const row = await db.query(
    `insert into checklist_claims (organization_id, event_id, task_id, parent_id, family_id, typed_name)
     select t.organization_id, t.event_id, t.id, $2, $3, $4 from event_checklist_tasks t where t.id = $1 returning id`,
    [task, parentRow, family, typedName],
  );
  return row.rows[0].id as string;
}

/** The ids of an event's sections and, per section title, its tasks (as the schema owner reads them). */
export async function idsOf(db: pg.Client, event: string) {
  const sections = (
    await db.query(
      "select id, title, position, kind from event_checklist_sections where event_id = $1 order by position",
      [event],
    )
  ).rows as { id: string; title: string; position: number; kind: string }[];
  const tasks = (
    await db.query(
      "select id, title, section_id, position from event_checklist_tasks where event_id = $1 order by section_id, position",
      [event],
    )
  ).rows as { id: string; title: string; section_id: string; position: number }[];
  return {
    sections,
    tasks,
    task: (title: string) => tasks.find((row) => row.title === title)!.id,
    section: (title: string) => sections.find((row) => row.title === title)!.id,
  };
}
