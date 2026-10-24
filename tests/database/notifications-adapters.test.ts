import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  WorkbookUpload,
  retryableFailure,
  type AdminOperation,
  type DomainOutcome,
} from "../../src/application/index.ts";
import { createAdminPort, createParentPort, RetryableDataFailure } from "../../src/data/index.ts";
import { parseWorkbook } from "../../src/import-parser/workbook.ts";
import { createSignInService } from "../../src/identity/service.ts";
import { createDatabaseClient, type DatabaseClient } from "../../src/runtime/database/client.ts";
import {
  ADMIN_G1,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  GROUP_1,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_1,
  TASK_3,
} from "./directory-support.ts";
import { insertJob, insertNotification } from "./notifications-support.ts";
import { budapestText } from "./import-support.ts";
import { stackSettings } from "./stack-support.ts";
import {
  buildWorkbook,
  directoryRow,
  taskRow,
  zipBomb,
  type RowSpec,
} from "../support/workbook.ts";
import { DIRECTORY_SHEET } from "../../src/import-parser/template.ts";

const settings = stackSettings();
const apiUrl = settings.apiUrl.replace(/\/$/, "");
const SESSION_SECRET = `test-secret-${randomBytes(24).toString("hex")}`;
const PASSWORD = `Pw-${randomBytes(6).toString("hex")}-1`;
const TASK_SHEET = "Kinti - benti takarítás 2025-26";

const ACCOUNTS = {
  parent: PARENT_F1,
  parentOther: PARENT_F2,
  adminSame: ADMIN_G1,
  super: SUPER_ADMIN,
  outsider: OUTSIDER,
} as const;
type Who = keyof typeof ACCOUNTS;
type Result = DomainOutcome<unknown> & { code?: string };
type Preview = {
  id: string;
  runId: string;
  runVersion: number;
  fingerprint: string;
  fileName: string;
  state: string;
  step: number;
  totalRows: number;
  warningCount: number;
  conflicts: { id: string; message: string; skipOnly: boolean; resolution?: string }[];
};
type Committed = {
  runId: string;
  state: string;
  importedRows: number;
  skippedRows: number;
  createdRows?: number;
  updatedRows?: number;
  archivedRows?: number;
};

/** Every code of the table of BR42.3 that a test of this file has seen come back through the adapter. */
const TABLE_OF_BR42_3 = [
  "IMPORT_MALFORMED",
  "IMPORT_OVERSIZED",
  "IMPORT_MISSING_SHEET",
  "IMPORT_MISSING_HEADER",
  "IMPORT_UNSAFE_CELL",
  "IMPORT_FINGERPRINT_CHANGED",
  "IMPORT_CONFLICT_UNRESOLVED",
  "IMPORT_CONFIRMATION_REQUIRED",
  "IMPORT_MATCH_CHANGED",
  "IMPORT_RECOVERY_NOT_AVAILABLE",
  "IMPORT_RECOVERY_ACTION_INVALID",
  "IMPORT_PREVIEW_STALE",
  "REMINDER_NOT_RETRYABLE",
  "REMINDER_STALE",
] as const;

function must<T>(value: T | undefined | null, what: string): T {
  assert.ok(value !== undefined && value !== null, what);
  return value;
}

/** The fictitious workbook of these tests: one new family, a task for it, and a row naming a family that exists nowhere. */
function workbookBytes(extraDirectory: RowSpec[] = []): Uint8Array {
  const start = budapestText(20, 10);
  const end = budapestText(20, 12);
  return buildWorkbook({
    rows: {
      [DIRECTORY_SHEET]: [
        directoryRow({
          Csoport: "Boróka",
          Család: "Mézes család",
          "Szülő neve": "Mézes Márta",
          "E-mail": "marta@example.test",
          Telefon: "+36 20 333 4444",
        }),
        directoryRow({ Csoport: "Boróka", Család: "Mézes család", "Gyermek neve": "Mézes Máté" }),
        ...extraDirectory,
      ],
      [TASK_SHEET]: [
        taskRow({
          Csoport: "Boróka",
          Esemény: "Tavaszi nagytakarítás",
          Feladat: "Ablakmosás",
          Kezdés: start,
          Befejezés: end,
          Létszám: 2,
          Család: "Mézes család",
        }),
        taskRow({
          Csoport: "Boróka",
          Esemény: "Tavaszi nagytakarítás",
          Feladat: "Ablakmosás",
          Kezdés: start,
          Befejezés: end,
          Létszám: 2,
          Család: "Hiányzó család",
        }),
      ],
    },
  });
}

/**
 * The notification, reminder and import adapters against the real local stack, with real sign-in tokens
 * (NFR2.26, NFR6.23, NFR6.20): every operation, the parser in front of the import, the interruption of a commit
 * with an injected failure, and a code-by-code contract test of the table of BR42.3. Nothing is mocked: the
 * data API, the row-level policies, the functions and the sign-in service are the stack's own.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`notification, reminder and import adapters in ${schema}`, () => {
    let db: pg.Client;
    const database = createDatabaseClient({
      url: apiUrl,
      publicKey: settings.publicKey,
      sessionSecret: SESSION_SECRET,
      schema,
    });
    const service = createSignInService({ url: apiUrl, publicKey: settings.publicKey });
    const tokens = new Map<string, string>();
    const seen = new Set<string>();

    async function asPerson(who: Who): Promise<DatabaseClient> {
      const account = ACCOUNTS[who];
      let token = tokens.get(account);
      if (!token) {
        // Bare seeded identities get the service's instance and a password hash by SQL (the service's own
        // password change would end the sessions other test files hold for the same shared identities).
        await db.query(
          `update auth.users set instance_id = '00000000-0000-0000-0000-000000000000',
                  encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')),
                  email_confirmed_at = coalesce(email_confirmed_at, now()),
                  confirmation_token = coalesce(confirmation_token, ''),
                  recovery_token = coalesce(recovery_token, ''),
                  email_change_token_new = coalesce(email_change_token_new, ''),
                  email_change = coalesce(email_change, ''),
                  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb),
                  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
            where id = $1`,
          [account, PASSWORD],
        );
        const signedIn = await service.passwordSignIn(`identity.${account}@example.test`, PASSWORD);
        assert.ok(signedIn.ok, `the sign-in service accepts ${who}`);
        token = signedIn.value.accessToken;
        tokens.set(account, token);
      }
      return database.forSession(token);
    }

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedCoordinationWorld(db, schema);
      await db.query(
        "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3), ($1, $4, $3)",
        [ORGANIZATION, FAMILY_2, GROUP_1, FAMILY_NO_GROUP],
      );
    });

    const admin = async (
      who: Who,
      operation: AdminOperation,
      payload: Record<string, unknown> = {},
      key = nextKey("adm"),
      client?: DatabaseClient,
    ) => {
      const port = createAdminPort(client ?? (await asPerson(who)), { parseWorkbook });
      const result = (await port.execute<unknown>({
        actorId: ACCOUNTS[who],
        operation,
        scope: { id: ORGANIZATION, type: "organization", organizationId: ORGANIZATION },
        payload,
        idempotencyKey: key,
      })) as Result;
      if ("code" in result && typeof result.code === "string") seen.add(result.code);
      return result;
    };
    const parent = async (who: Who) => createParentPort(await asPerson(who));
    const data = <T>(result: Result): T => {
      assert.equal(result.state, "success", JSON.stringify(result));
      return (result as { data: T }).data;
    };
    const upload = (bytes: Uint8Array, name = "tavaszi-feladatok.xlsx") =>
      new WorkbookUpload(name, bytes);
    const previewOf = async (bytes = workbookBytes()) =>
      data<Preview>(await admin("super", "import.preview", { workbook: upload(bytes) }));
    const resolveAll = async (model: Preview) => {
      let current = model;
      for (const conflict of model.conflicts) {
        current = data<Preview>(
          await admin("super", "import.resolve", {
            id: current.runId,
            expectedVersion: current.runVersion,
            conflictId: conflict.id,
            resolution: "keep-existing",
          }),
        );
      }
      return current;
    };
    const commitPayload = (model: Preview, over: Record<string, unknown> = {}) => ({
      id: model.runId,
      expectedVersion: model.runVersion,
      fingerprint: model.fingerprint,
      confirmed: "yes",
      ...over,
    });
    const count = async (sql: string, values: unknown[] = []) =>
      (await db.query(sql, values)).rows[0].n as number;

    it("lists only the signed-in parent's own notifications, newest first, with the display fields of the model (BR40.2)", async () => {
      await insertNotification(db, {
        parent: PARENT_ROW_F1,
        kind: "sign_up_confirmed",
        task: TASK_1,
        target: TASK_1,
        createdAt: new Date(Date.now() - 3_600_000).toISOString(),
      });
      await insertNotification(db, {
        parent: PARENT_ROW_F1,
        kind: "place_removed",
        task: TASK_1,
        target: TASK_1,
      });
      await insertNotification(db, {
        parent: PARENT_ROW_F2,
        kind: "sign_up_confirmed",
        task: TASK_3,
        target: TASK_3,
      });
      const own = data<{
        notifications: { title: string; isRead: boolean; link: string; providerStatus: string }[];
      }>((await (await parent("parent")).listNotifications({ actorId: "ignored" })) as Result);
      assert.equal(own.notifications.length, 2);
      assert.match(own.notifications[0]!.title, /^A helyed törölve: /, "newest first");
      assert.match(own.notifications[1]!.title, /^Jelentkezés megerősítve: /);
      assert.equal(own.notifications[0]!.isRead, false);
      assert.equal(own.notifications[0]!.providerStatus, "simulated-sent");
      assert.match(own.notifications[0]!.link, /^\/szulo\//);
      const other = data<{ notifications: unknown[] }>(
        (await (await parent("parentOther")).listNotifications({ actorId: "ignored" })) as Result,
      );
      assert.equal(other.notifications.length, 1, "each parent sees their own notices only");
    });

    it("answers the empty state to a parent with no notices and denied to a caller who is not a parent of the organization (BR40.2)", async () => {
      assert.deepEqual(await (await parent("parent")).listNotifications({ actorId: "ignored" }), {
        state: "empty",
      });
      const denied = await (await parent("outsider")).listNotifications({ actorId: "ignored" });
      assert.ok(
        ["empty", "denied"].includes(denied.state),
        "an account with no linked parent has nothing to list",
      );
    });

    it("runs the lazy tick when the list opens: a due reminder job becomes the parent's notice, once (BR40.6)", async () => {
      const job = await insertJob(db, { task: TASK_3, threshold: "7d" });
      // The task's own start, to the microsecond (a JavaScript date would round it and make the job stale).
      await db.query(
        "update reminder_jobs set task_starts_at = (select starts_at from tasks where id = $2) where id = $1",
        [job, TASK_3],
      );
      await db.query(
        "insert into reminder_recipients (organization_id, reminder_job_id, family_id) values ($1, $2, $3)",
        [ORGANIZATION, job, FAMILY_2],
      );
      const port = await parent("parentOther");
      const first = data<{
        notifications: { title: string; timing: string; providerStatus: string }[];
      }>((await port.listNotifications({ actorId: "ignored" })) as Result);
      assert.equal(first.notifications.length, 1);
      assert.match(first.notifications[0]!.title, /^Egy hét múlva: Díszítés$/);
      assert.equal(first.notifications[0]!.timing, "7-day");
      assert.equal(first.notifications[0]!.providerStatus, "simulated-sent");
      assert.equal(
        (await db.query("select status from reminder_jobs where id = $1", [job])).rows[0].status,
        "sent",
      );
      const second = data<{ notifications: unknown[] }>(
        (await port.listNotifications({ actorId: "ignored" })) as Result,
      );
      assert.equal(second.notifications.length, 1, "the tick is idempotent: no duplicate notice");
    });

    it("marks a notice read once and again, and another parent's notice, an unknown one and a malformed id read as denied (BR40.3)", async () => {
      const mine = await insertNotification(db, {
        parent: PARENT_ROW_F1,
        task: TASK_1,
        target: TASK_1,
      });
      const theirs = await insertNotification(db, {
        parent: PARENT_ROW_F2,
        task: TASK_3,
        target: TASK_3,
      });
      const port = await parent("parent");
      const first = (await port.markNotificationRead({
        actorId: PARENT_F1,
        notificationId: mine,
      })) as Result;
      assert.match(data<{ link: string }>(first).link, /^\/szulo\//);
      const readAt = (await db.query("select read_at from notifications where id = $1", [mine]))
        .rows[0].read_at;
      assert.ok(readAt);
      await port.markNotificationRead({ actorId: PARENT_F1, notificationId: mine });
      assert.deepEqual(
        (await db.query("select read_at from notifications where id = $1", [mine])).rows[0].read_at,
        readAt,
        "the first time is kept",
      );
      for (const id of [theirs, "11111111-1111-4111-8111-111111111111", "../etc/passwd"]) {
        assert.deepEqual(
          await port.markNotificationRead({ actorId: PARENT_F1, notificationId: id }),
          { state: "denied" },
        );
      }
      assert.equal(
        (await db.query("select read_at from notifications where id = $1", [theirs])).rows[0]
          .read_at,
        null,
        "the other parent's notice is untouched",
      );
    });

    it("lists the reminder jobs an admin reaches with counts and no names, filters by status, and refuses other roles (BR40.8)", async () => {
      const startsAt = (await db.query("select starts_at from tasks where id = $1", [TASK_1]))
        .rows[0].starts_at;
      const retryable = await insertJob(db, {
        task: TASK_1,
        threshold: "24h",
        status: "retryable",
        attempt: 1,
        startsAt,
        scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
      });
      await db.query(
        "insert into reminder_recipients (organization_id, reminder_job_id, family_id) values ($1, $2, $3)",
        [ORGANIZATION, retryable, FAMILY_1],
      );
      const all = data<{
        jobs: { id: string; status: string; recipientSummary: string; providerLabel: string }[];
      }>(await admin("super", "reminders.list"));
      const row = must(
        all.jobs.find((job) => job.id === retryable),
        "the job is listed",
      );
      assert.equal(row.status, "retryable");
      assert.equal(row.recipientSummary, "1 kijelölt család");
      assert.equal(row.providerLabel, "Szimulált kézbesítés");
      assert.equal(JSON.stringify(all).includes("Fenyő"), false, "no family name in the list");
      const filtered = data<{ jobs: { status: string }[] }>(
        await admin("super", "reminders.list", { status: "retryable" }),
      );
      assert.ok(
        filtered.jobs.length >= 1 && filtered.jobs.every((job) => job.status === "retryable"),
      );
      assert.equal(
        (await admin("super", "reminders.list", { status: "nonsense" })).state,
        "validation",
      );
      assert.equal((await admin("outsider", "reminders.list")).state, "denied");
      assert.equal((await admin("parent", "reminders.list")).state, "denied");
    });

    it("retries a retryable job with the codes REMINDER_NOT_RETRYABLE and REMINDER_STALE, and a repeated key answers the same (BR40.7, BR42.3)", async () => {
      const startsAt = (await db.query("select starts_at from tasks where id = $1", [TASK_1]))
        .rows[0].starts_at;
      const job = await insertJob(db, {
        task: TASK_1,
        status: "retryable",
        attempt: 1,
        startsAt,
        scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
      });
      const version = (await db.query("select version from reminder_jobs where id = $1", [job]))
        .rows[0].version as number;
      const stale = await admin("super", "reminders.retry", {
        id: job,
        expectedVersion: version + 5,
      });
      assert.deepEqual([stale.state, stale.code], ["invalidated", "REMINDER_STALE"]);
      const key = nextKey("retry");
      const retried = data<{ jobId: string; status: string }>(
        await admin("super", "reminders.retry", { id: job, expectedVersion: version }, key),
      );
      assert.deepEqual(retried, { jobId: job, status: "retry-scheduled" });
      assert.equal(
        (await db.query("select status from reminder_jobs where id = $1", [job])).rows[0].status,
        "retrying",
      );
      const again = await admin(
        "super",
        "reminders.retry",
        { id: job, expectedVersion: version },
        key,
      );
      assert.equal(again.state, "success", "the same key answers the stored result");
      const notRetryable = await admin("super", "reminders.retry", {
        id: job,
        expectedVersion: version + 1,
      });
      assert.deepEqual(
        [notRetryable.state, notRetryable.code],
        ["conflict", "REMINDER_NOT_RETRYABLE"],
      );
      assert.deepEqual(
        await admin("super", "reminders.retry", { id: "nope", expectedVersion: 1 }),
        { state: "denied" },
      );
      assert.equal(
        (await admin("outsider", "reminders.retry", { id: job, expectedVersion: 1 })).state,
        "denied",
      );
    });

    it("runs an import end to end through the adapter: upload, two conflicts' worth of resolution, commit with real counts, then a second upload (BR42.1, BR41.13)", async () => {
      const first = await previewOf();
      assert.equal(first.fileName, "tavaszi-feladatok.xlsx");
      assert.equal(first.step, 4);
      assert.deepEqual(
        first.conflicts.map((conflict) => [conflict.message, conflict.skipOnly]),
        [["Ismeretlen család.", true]],
        "the family the workbook creates resolves; the one that exists nowhere is a conflict",
      );
      assert.equal(data<Preview>(await admin("super", "import.status")).runId, first.runId);
      const resolved = await resolveAll(first);
      assert.equal(resolved.state, "confirmed");
      assert.equal(resolved.runVersion, first.runVersion + 1);

      const outcome = data<Committed>(
        await admin("super", "import.commit", commitPayload(resolved), nextKey("commit")),
      );
      assert.equal(outcome.state, "committed");
      assert.equal(outcome.createdRows, 3);
      assert.equal(outcome.archivedRows, 18);
      assert.equal(outcome.importedRows, 3);
      assert.equal(outcome.skippedRows, 19);
      assert.equal(
        await count("select count(*)::int as n from families where display_name = 'Mézes család'"),
        1,
      );
      assert.equal(
        await count("select count(*)::int as n from assignments where source = 'import'"),
        1,
      );
      assert.equal(
        await count("select count(*)::int as n from notifications"),
        0,
        "an import writes no notice",
      );

      const status = data<Preview & { state: string }>(await admin("super", "import.status"));
      assert.equal(status.state, "committed");
      const second = await previewOf();
      assert.notEqual(
        second.runId,
        first.runId,
        "a new upload supersedes the finished run on screen",
      );
      assert.equal(
        second.conflicts.length,
        1,
        "the same file again: nothing new to create, the unknown family conflicts again",
      );
    });

    it("refuses a file that is not a usable workbook with the parser's code and creates no run (BR41.2, BR42.3)", async () => {
      const before = await count("select count(*)::int as n from import_runs");
      const cases: [string, Uint8Array][] = [
        ["IMPORT_MALFORMED", new TextEncoder().encode("Csoport;Család\n")],
        ["IMPORT_OVERSIZED", zipBomb()],
        ["IMPORT_MISSING_SHEET", buildWorkbook({ omitSheets: ["Könyvtár"] })],
        ["IMPORT_MISSING_HEADER", buildWorkbook({ headers: { [TASK_SHEET]: ["Rossz"] } })],
        [
          "IMPORT_UNSAFE_CELL",
          buildWorkbook({
            rows: { [DIRECTORY_SHEET]: [directoryRow({ Csoport: "A", Család: "=1+1" })] },
          }),
        ],
      ];
      for (const [code, bytes] of cases) {
        const result = await admin("super", "import.preview", { workbook: upload(bytes) });
        assert.deepEqual([result.state, result.code], ["conflict", code], code);
      }
      assert.equal(
        await count("select count(*)::int as n from import_runs"),
        before,
        "no run was created",
      );
    });

    it("counts a dropped phone number as a warning of the preview and never stages the dropped text (BR41.2)", async () => {
      const model = await previewOf(
        workbookBytes([
          directoryRow({
            Csoport: "Boróka",
            Család: "Mézes család",
            "Szülő neve": "Mézes Mihály",
            Telefon: "nincs",
          }),
        ]),
      );
      assert.equal(model.warningCount, 1);
      assert.equal(
        await count(
          "select count(*)::int as n from import_staged_rows where payload::text like '%nincs%'",
        ),
        0,
      );
    });

    it("keeps the import to super admins: a group admin, a parent and an outsider are denied every operation (BR41.1)", async () => {
      const bytes = workbookBytes();
      for (const who of ["adminSame", "parent", "outsider"] as const) {
        const port = createAdminPort(await asPerson(who), { parseWorkbook });
        const scope = {
          id: ORGANIZATION,
          type: "organization" as const,
          organizationId: ORGANIZATION,
        };
        for (const [operation, payload] of [
          ["import.preview", { workbook: upload(bytes) }],
          ["import.status", {}],
        ] as const) {
          const result = await port.execute({
            actorId: ACCOUNTS[who],
            operation,
            scope,
            payload,
            idempotencyKey: nextKey("deny"),
          });
          assert.equal(result.state, "denied", `${who} ${operation}`);
        }
      }
      assert.equal(await count("select count(*)::int as n from import_runs"), 0);
    });

    it("answers each commit and resolve refusal with its code: stale, fingerprint, open conflict, confirmation, cancelled run (BR42.3)", async () => {
      const model = await previewOf();
      const wrongFingerprint = await admin(
        "super",
        "import.commit",
        commitPayload(model, { fingerprint: "0".repeat(64) }),
        nextKey("c"),
      );
      assert.deepEqual(
        [wrongFingerprint.state, wrongFingerprint.code],
        ["conflict", "IMPORT_FINGERPRINT_CHANGED"],
      );
      const open = await admin("super", "import.commit", commitPayload(model), nextKey("c"));
      assert.deepEqual([open.state, open.code], ["conflict", "IMPORT_CONFLICT_UNRESOLVED"]);
      const staleResolve = await admin("super", "import.resolve", {
        id: model.runId,
        expectedVersion: model.runVersion + 7,
        conflictId: model.conflicts[0]!.id,
        resolution: "keep-existing",
      });
      assert.deepEqual(
        [staleResolve.state, staleResolve.code],
        ["invalidated", "IMPORT_PREVIEW_STALE"],
      );
      const useImport = await admin("super", "import.resolve", {
        id: model.runId,
        expectedVersion: model.runVersion,
        conflictId: model.conflicts[0]!.id,
        resolution: "use-import",
      });
      assert.deepEqual(
        [useImport.state, useImport.code],
        ["conflict", "IMPORT_CONFLICT_UNRESOLVED"],
        "nothing to import into",
      );
      const resolved = await resolveAll(model);
      const unconfirmed = await admin(
        "super",
        "import.commit",
        commitPayload(resolved, { confirmed: "" }),
        nextKey("c"),
      );
      assert.deepEqual(
        [unconfirmed.state, unconfirmed.code],
        ["conflict", "IMPORT_CONFIRMATION_REQUIRED"],
      );
      const cancelled = data<{ runId: string }>(
        await admin(
          "super",
          "import.cancel",
          { id: resolved.runId, expectedVersion: resolved.runVersion },
          nextKey("x"),
        ),
      );
      assert.equal(cancelled.runId, resolved.runId);
      const afterCancel = await admin(
        "super",
        "import.commit",
        commitPayload(resolved),
        nextKey("c"),
      );
      assert.deepEqual(
        [afterCancel.state, afterCancel.code],
        ["invalidated", "IMPORT_PREVIEW_STALE"],
      );
      assert.equal(
        await count("select count(*)::int as n from import_staged_rows"),
        0,
        "a cancelled run keeps no staged row",
      );
      assert.deepEqual(await admin("super", "import.status"), { state: "empty" });
    });

    it("sends the match-changed code when a record changed between preview and commit, and the run returns to the preview (BR41.6)", async () => {
      const model = await previewOf();
      const resolved = await resolveAll(model);
      // Someone creates the family the workbook was going to create: the second matching sees it.
      await db.query(
        "with f as (insert into families (organization_id, display_name) values ($1, 'Mézes család') returning id) insert into group_memberships (organization_id, family_id, group_id) select $1, id, $2 from f",
        [ORGANIZATION, GROUP_1],
      );
      const result = await admin("super", "import.commit", commitPayload(resolved), nextKey("c"));
      assert.deepEqual([result.state, result.code], ["conflict", "IMPORT_MATCH_CHANGED"]);
      const status = data<Preview>(await admin("super", "import.status"));
      assert.equal(
        status.state,
        "conflicts",
        "back to the preview with the changed rows as new conflicts",
      );
      assert.equal(
        await count("select count(*)::int as n from assignments where source = 'import'"),
        0,
      );
    });

    it("interrupts a commit whose connection fails, leaves the data as it was, and resumes it with the recovery action (BR41.9, NFR6.20)", async () => {
      const model = await previewOf();
      const resolved = await resolveAll(model);
      const real = await asPerson("super");
      let armed = true;
      const flaky = new Proxy(real, {
        get(target, property) {
          if (property === "read") {
            return (run: never, meta: { action?: string }) =>
              armed && meta.action === "import_commit"
                ? Promise.resolve(
                    retryableFailure({ idempotencyKey: "x", action: "import_commit" } as never),
                  )
                : target.read(run, meta as never);
          }
          const value = Reflect.get(target, property);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }) as DatabaseClient;
      const familiesBefore = await count("select count(*)::int as n from families");
      await assert.rejects(
        admin("super", "import.commit", commitPayload(resolved), nextKey("c"), flaky),
        RetryableDataFailure,
      );
      armed = false;
      assert.equal(
        await count("select count(*)::int as n from families"),
        familiesBefore,
        "the data is as it was",
      );
      const status = data<Preview>(await admin("super", "import.status"));
      assert.deepEqual([status.state, status.step], ["interrupted", 6]);

      const invalidAction = await admin(
        "super",
        "import.recover",
        { id: status.runId, expectedVersion: 1, action: "retry" },
        nextKey("r"),
      );
      assert.deepEqual(
        [invalidAction.state, invalidAction.code],
        ["conflict", "IMPORT_RECOVERY_ACTION_INVALID"],
      );
      const recovered = data<Committed>(
        await admin(
          "super",
          "import.recover",
          { id: status.runId, expectedVersion: 1, action: "resume" },
          nextKey("r"),
        ),
      );
      assert.equal(recovered.state, "recovered");
      assert.equal(recovered.importedRows, 3);
      assert.equal(await count("select count(*)::int as n from families"), familiesBefore + 1);
      const notAvailable = await admin(
        "super",
        "import.recover",
        { id: status.runId, expectedVersion: 1, action: "resume" },
        nextKey("r"),
      );
      assert.deepEqual(
        [notAvailable.state, notAvailable.code],
        ["conflict", "IMPORT_RECOVERY_NOT_AVAILABLE"],
      );
    });

    it("answers a repeated upload key whose run was cancelled meanwhile with the stale-preview code, not a malformed response (BR42.3)", async () => {
      const key = nextKey("again");
      const first = data<Preview>(
        await admin("super", "import.preview", { workbook: upload(workbookBytes()) }, key),
      );
      // The same key while the run is open returns the same run.
      const repeat = data<Preview>(
        await admin("super", "import.preview", { workbook: upload(workbookBytes()) }, key),
      );
      assert.equal(repeat.runId, first.runId);
      data(await admin("super", "import.cancel", { id: first.runId }, nextKey("x")));
      const afterCancel = await admin(
        "super",
        "import.preview",
        { workbook: upload(workbookBytes()) },
        key,
      );
      assert.deepEqual(
        [afterCancel.state, afterCancel.code],
        ["invalidated", "IMPORT_PREVIEW_STALE"],
        "the person is told to upload again",
      );
    });

    it("produced every code of the table of BR42.3 through the adapter in this file, and no other code (BR42.3)", () => {
      const imports = [...seen].filter(
        (code) => code.startsWith("IMPORT_") || code.startsWith("REMINDER_"),
      );
      const missing = TABLE_OF_BR42_3.filter((code) => !imports.includes(code));
      assert.deepEqual(missing, [], "every code of the table was seen");
      assert.deepEqual(
        imports.filter((code) => !(TABLE_OF_BR42_3 as readonly string[]).includes(code)),
        [],
        "no code outside the table",
      );
    });
  });
}
