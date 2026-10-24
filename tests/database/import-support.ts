import type pg from "pg";
import { DIRECTORY_SHEET, SHEET_REGISTRY } from "../../src/import-parser/template.ts";
import {
  callFunction,
  GROUP_1,
  ORGANIZATION,
  OTHER_ORGANIZATION,
  uuid,
} from "./directory-support.ts";
import { ensureAccount } from "./stack-support.ts";

export { NOTIFICATION_SCHEMAS as IMPORT_SCHEMAS } from "./notifications-support.ts";
export { DIRECTORY_SHEET };

/** A second super admin of the first organization: sees nothing of the first one's runs (BR41.7). */
export const SUPER_ADMIN_2 = "bbbbbbbb-0000-4000-8000-000000000051";
/** A third super admin, used where a test deactivates the account that started a run. */
export const SUPER_ADMIN_3 = "bbbbbbbb-0000-4000-8000-000000000052";

/** The seven task sheets of the template, in registry order. */
export const TASK_SHEETS = SHEET_REGISTRY.filter(
  (entry) => entry.mode === "interactive" && entry.sheet !== DIRECTORY_SHEET,
).map((entry) => entry.sheet);
export const ARCHIVE_SHEETS = SHEET_REGISTRY.filter(
  (entry) => entry.mode === "read_only_archive",
).map((entry) => entry.sheet);
export const TASK_SHEET = TASK_SHEETS[0]!;

/** Seeds the extra super admins on top of the directory world. */
export async function seedImportAccounts(db: pg.Client): Promise<void> {
  for (const account of [SUPER_ADMIN_2, SUPER_ADMIN_3]) {
    await ensureAccount(db, { id: account, organization: ORGANIZATION });
    await db.query(
      "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, 'super_admin', 'organization', $2, $2)",
      [account, ORGANIZATION],
    );
    await db.query(
      "insert into app_authorization_versions (subject_id, authorization_version) values ($1, 1) on conflict do nothing",
      [account],
    );
  }
}

let counter = 0;
const nextRef = () => `${Date.now().toString(16)}${(++counter).toString(16).padStart(4, "0")}`;
/** A 64-character hex string, the shape of a fingerprint or a unit reference. */
export const hex64 = (seed = nextRef()): string => seed.padEnd(64, "0").slice(0, 64);

/** Inserts an import run as the schema owner (row rules do not apply) and returns its id. */
export async function insertRun(
  db: pg.Client,
  args: {
    startedBy: string;
    organization?: string;
    status?: string;
    step?: number;
    totalRows?: number;
    name?: string;
    expiresAt?: string;
    id?: string;
  },
): Promise<string> {
  const result = await db.query(
    `insert into import_runs (id, organization_id, workbook_name, workbook_fingerprint, status, step, total_rows,
                              started_by_account_id, committed_at, expires_at)
     values (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8,
             case when $5 in ('committed', 'recovered') then now() else null end,
             coalesce($9::timestamptz, now() + interval '7 days'))
     returning id`,
    [
      args.id ?? null,
      args.organization ?? ORGANIZATION,
      args.name ?? "tavaszi-feladatok.xlsx",
      hex64(),
      args.status ?? "previewed",
      args.step ?? 4,
      args.totalRows ?? 3,
      args.startedBy,
      args.expiresAt ?? null,
    ],
  );
  return result.rows[0].id as string;
}

/** Inserts an import row (history, no personal data) and returns its id. */
export async function insertRow(
  db: pg.Client,
  args: {
    run: string;
    sheet?: string;
    row: number;
    organization?: string;
    outcome?: string;
  },
): Promise<string> {
  const sheet = args.sheet ?? DIRECTORY_SHEET;
  const result = await db.query(
    `insert into import_rows (organization_id, import_run_id, sheet, row_number, source_key, outcome)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [
      args.organization ?? ORGANIZATION,
      args.run,
      sheet,
      args.row,
      `${sheet}:${args.row}`,
      args.outcome ?? "staged",
    ],
  );
  return result.rows[0].id as string;
}

/** Inserts a staged row (personal data) for an existing import row and returns its id. */
export async function insertStaged(
  db: pg.Client,
  args: {
    run: string;
    sheet?: string;
    row: number;
    payload?: Record<string, unknown>;
    organization?: string;
  },
): Promise<string> {
  const sheet = args.sheet ?? DIRECTORY_SHEET;
  const result = await db.query(
    `insert into import_staged_rows (organization_id, import_run_id, source_key, payload, unit_ref)
     values ($1, $2, $3, $4, $5) returning id`,
    [
      args.organization ?? ORGANIZATION,
      args.run,
      `${sheet}:${args.row}`,
      JSON.stringify(
        args.payload ?? { Csoport: "Boróka", Család: "Mintacsalád", "Szülő neve": "Minta Mária" },
      ),
      hex64(),
    ],
  );
  return result.rows[0].id as string;
}

/** Inserts a conflict for an import row and returns its id. */
export async function insertConflict(
  db: pg.Client,
  args: {
    run: string;
    row: string;
    label?: string;
    message?: string;
    resolution?: string | null;
    organization?: string;
  },
): Promise<string> {
  const result = await db.query(
    `insert into import_conflicts (organization_id, import_run_id, import_row_id, row_label, message, resolution)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [
      args.organization ?? ORGANIZATION,
      args.run,
      args.row,
      args.label ?? `${DIRECTORY_SHEET} · 2. sor`,
      args.message ?? "Az elem már létezik.",
      args.resolution ?? null,
    ],
  );
  return result.rows[0].id as string;
}

/** A run with one row, one staged row and one conflict, all started by one super admin. */
export async function seedRun(
  db: pg.Client,
  startedBy: string,
  options: { organization?: string; status?: string } = {},
): Promise<{ run: string; row: string; staged: string; conflict: string }> {
  const organization = options.organization ?? ORGANIZATION;
  const run = await insertRun(db, { startedBy, organization, status: options.status });
  const row = await insertRow(db, { run, row: 2, organization, outcome: "conflict" });
  const staged = await insertStaged(db, { run, row: 2, organization });
  const conflict = await insertConflict(db, { run, row, organization });
  return { run, row, staged, conflict };
}

// ---------------------------------------------------------------------------------------------------
// The parsed workbook rows the preview function takes (the shape the parser of Step 17 produces).
// ---------------------------------------------------------------------------------------------------

/** One row of the parsed workbook: the sheet, the row number and the cell values by header text. */
export type ParsedRow = {
  sheet: string;
  row: number;
  values?: Record<string, string>;
  warnings?: number;
};

/** A row of the directory sheet; unknown keys are left out. */
export function dirRow(
  row: number,
  values: Partial<
    Record<
      | "Csoport"
      | "Család"
      | "Szülő neve"
      | "E-mail"
      | "Telefon"
      | "Helység"
      | "Gyermek neve"
      | "Opcionális profil"
      | "Hozzájárulás",
      string
    >
  >,
  warnings = 0,
): ParsedRow {
  return {
    sheet: DIRECTORY_SHEET,
    row,
    values: Object.fromEntries(
      Object.entries(values).filter(([, value]) => value !== undefined),
    ) as Record<string, string>,
    ...(warnings ? { warnings } : {}),
  };
}

/** A row of a task sheet. */
export function taskRow(
  row: number,
  values: Partial<
    Record<
      | "Csoport"
      | "Esemény"
      | "Feladat"
      | "Kategória"
      | "Kezdés"
      | "Befejezés"
      | "Helyszín"
      | "Létszám"
      | "Család",
      string
    >
  >,
  sheet = TASK_SHEET,
): ParsedRow {
  return {
    sheet,
    row,
    values: Object.fromEntries(
      Object.entries(values).filter(([, value]) => value !== undefined),
    ) as Record<string, string>,
  };
}

/** A row of an archive sheet: only the sheet and the row number (the content is not copied). */
export const archiveRow = (row: number, sheet = ARCHIVE_SHEETS[0]!): ParsedRow => ({ sheet, row });

/** The Budapest-time text of the template for a moment `days` days from now at the given hour. */
export function budapestText(days: number, hour = 10): string {
  const moment = new Date(Date.now() + days * 86_400_000);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(moment);
  return `${parts} ${String(hour).padStart(2, "0")}:00`;
}

export type PreviewModel = {
  state: string;
  reference: string | null;
  code: string | null;
  run_id: string;
  version: number;
  fingerprint: string;
  workbook_name: string;
  step: number;
  model_state: string;
  run_status: string;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  warning_count: number;
  changed_rows: string[];
  conflicts: {
    id: string;
    row_label: string;
    message: string;
    resolution: string | null;
    skip_only: boolean;
  }[];
};

let importKey = 0;
/** A fresh idempotency key for one import call. */
export const importKeyOf = (label = "imp"): string => `${label}-${Date.now()}-${++importKey}`;

/** Calls `import_preview_create` as a signed-in account. */
export function preview(
  db: pg.Client,
  schema: string,
  account: string,
  rows: readonly ParsedRow[],
  name = "tavaszi-feladatok.xlsx",
  key = importKeyOf("preview"),
) {
  return callFunction(db, schema, account, "import_preview_create($1, $2, $3::jsonb)", [
    key,
    name,
    JSON.stringify(rows),
  ]) as Promise<PreviewModel>;
}

/** Inserts a task as the schema owner at a Budapest-time text of the template (`YYYY-MM-DD HH:mm`). */
export async function insertTaskAt(
  db: pg.Client,
  args: {
    group: string;
    title: string;
    startsText: string;
    endsText?: string;
    capacity?: number;
    category?: string;
    location?: string;
    status?: string;
    event?: string | null;
  },
): Promise<string> {
  const result = await db.query(
    `insert into tasks (organization_id, group_id, event_id, title, category, capacity, starts_at, ends_at, location, status)
     values ($1, $2, $3, $4, $5, $6, $7::timestamp at time zone 'Europe/Budapest',
             $8::timestamp at time zone 'Europe/Budapest', $9, $10)
     returning id`,
    [
      ORGANIZATION,
      args.group,
      args.event ?? null,
      args.title,
      args.category ?? "general",
      args.capacity ?? 3,
      args.startsText,
      args.endsText ?? args.startsText.replace(/ \d{2}:/, " 12:"),
      args.location ?? "Konyha",
      args.status ?? "open",
    ],
  );
  return result.rows[0].id as string;
}

/** What the preview decided for each staged row of a run, in file order (owner view, personal data not read). */
export async function decisions(db: pg.Client, run: string) {
  return (
    await db.query(
      `select r.sheet, r.row_number as row, s.match_class as class, s.conflict_message as message, s.row_conflict,
              s.matched_record_type as type, s.matched_record_id as matched, s.matched_record_version as version, s.is_leader
         from import_staged_rows s join import_rows r on r.import_run_id = s.import_run_id and r.source_key = s.source_key
        where s.import_run_id = $1 order by r.sheet, r.row_number`,
      [run],
    )
  ).rows as {
    sheet: string;
    row: number;
    class: string;
    message: string | null;
    row_conflict: boolean;
    type: string | null;
    matched: string | null;
    version: number | null;
    is_leader: boolean;
  }[];
}

/** The identity world's first group is called 'Boróka'; the helper returns its name for workbook rows. */
export const GROUP_1_NAME = "Boróka";
export const GROUP_1_ID = GROUP_1;
export { OTHER_ORGANIZATION, ORGANIZATION, uuid };
