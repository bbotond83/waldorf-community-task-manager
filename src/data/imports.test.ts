import assert from "node:assert/strict";
import test from "node:test";
import type { Scope } from "../access/index.ts";
import { WorkbookUpload, type AdminOperation, type DomainOutcome } from "../application/index.ts";
import type { ParseResult, WorkbookParser } from "../import-parser/types.ts";
import { buildWorkbook } from "../../tests/support/workbook.ts";
import { parseWorkbook } from "../import-parser/workbook.ts";
import {
  envelope,
  failure,
  fakeData,
  type FakeHandlers,
  type FakeResponse,
} from "../../tests/support/data-fakes.ts";
import { createAdminPort, DATABASE_ADMIN_OPERATIONS } from "./admin-port.ts";
import { RetryableDataFailure, TerminalDataFailure } from "./errors.ts";

const ORG = "aaaaaaaa-0000-4000-8000-000000000001";
const SCOPE: Scope = { id: ORG, type: "organization", organizationId: ORG };
const RUN = "dddddddd-0000-4000-8000-000000000001";
const CONFLICT_1 = "dddddddd-0000-4000-8000-000000000011";
const CONFLICT_2 = "dddddddd-0000-4000-8000-000000000012";
const FINGERPRINT = "ab".repeat(32);
const COMMIT = { id: RUN, expectedVersion: 1, fingerprint: FINGERPRINT, confirmed: "yes" };

/** The run model of the database (`import_run_model`), with the fields a test changes. */
const model = (over: Record<string, unknown> = {}) => ({
  run_id: RUN,
  version: 1,
  workbook_name: "tavaszi-feladatok.xlsx",
  fingerprint: FINGERPRINT,
  step: 4,
  model_state: "conflicts",
  run_status: "previewed",
  total_rows: 5,
  imported_rows: 0,
  skipped_rows: 0,
  warning_count: 1,
  changed_rows: ["Boróka csoport: 2 módosítás"],
  conflicts: [
    {
      id: CONFLICT_1,
      row_label: "Kinti - benti takarítás 2025-26 · 3. sor",
      message: "Ismeretlen család.",
      resolution: null,
      skip_only: true,
    },
    {
      id: CONFLICT_2,
      row_label: "Szülők elérhetősége · 2. sor",
      message: "Az elem már létezik.",
      resolution: "keep_existing",
      skip_only: false,
    },
  ],
  open_conflicts: 1,
  ...over,
});

const PARSED: ParseResult = {
  ok: true,
  rows: [
    { sheet: "Szülők elérhetősége", row: 2, values: { Csoport: "Boróka", Család: "Mézes család" } },
    { sheet: "ÁLLATOK", row: 1 },
  ],
  warnings: 0,
  droppedPhones: 0,
  droppedProfiles: 0,
};

function port(handlers: FakeHandlers, parser: WorkbookParser | null = () => PARSED) {
  const fake = fakeData(handlers);
  const adapter = createAdminPort(fake.database, parser ? { parseWorkbook: parser } : {});
  const run = (operation: AdminOperation, payload: Record<string, unknown> = {}, key?: string) =>
    adapter.execute<unknown>({
      actorId: "ignored",
      operation,
      scope: SCOPE,
      payload,
      ...(key !== undefined ? { idempotencyKey: key } : {}),
    });
  return { fake, run };
}

const upload = (name = "tavaszi-feladatok.xlsx") =>
  new WorkbookUpload(name, new Uint8Array([80, 75, 3, 4]));
const names = (fake: ReturnType<typeof fakeData>) => fake.rpcCalls.map((call) => call.name);
const success = <T>(outcome: DomainOutcome<T>): T => {
  assert.equal(outcome.state, "success", JSON.stringify(outcome));
  return (outcome as Extract<DomainOutcome<T>, { state: "success" }>).data;
};

test("an upload is parsed from its bytes, staged with its rows, and answered with the run id, version and file name (BR42.1)", async () => {
  const seen: Uint8Array[] = [];
  const { fake, run } = port({ rpc: () => envelope("success", null, model(), RUN) }, (bytes) => {
    seen.push(bytes);
    return PARSED;
  });
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const preview = success(
    await run(
      "import.preview",
      { workbook: new WorkbookUpload("tavasz.xlsx", bytes) },
      "imp-key-0001",
    ),
  ) as Record<string, unknown>;
  assert.deepEqual(seen, [bytes], "the parser got the uploaded bytes and nothing else");
  assert.deepEqual(fake.rpcCalls, [
    {
      name: "import_preview_create",
      args: {
        p_idempotency_key: "imp-key-0001",
        p_workbook_name: "tavasz.xlsx",
        p_rows: PARSED.ok ? PARSED.rows : [],
      },
    },
  ]);
  assert.equal(preview.runId, RUN);
  assert.equal(preview.id, RUN);
  assert.equal(preview.runVersion, 1);
  assert.equal(preview.fileName, "tavaszi-feladatok.xlsx");
  assert.equal(preview.fileName, "tavaszi-feladatok.xlsx");
  assert.equal(preview.state, "conflicts");
  assert.equal(preview.step, 4);
  assert.equal(preview.warningCount, 1);
  assert.equal(preview.importedRows, 0);
  assert.equal(preview.skippedRows, 0);
  assert.deepEqual(preview.changedRows, ["Boróka csoport: 2 módosítás"]);
  assert.deepEqual(preview.conflicts, [
    {
      id: CONFLICT_1,
      rowLabel: "Kinti - benti takarítás 2025-26 · 3. sor",
      message: "Ismeretlen család.",
      skipOnly: true,
    },
    {
      id: CONFLICT_2,
      rowLabel: "Szülők elérhetősége · 2. sor",
      message: "Az elem már létezik.",
      resolution: "keep-existing",
      skipOnly: false,
    },
  ]);
});

test("each parser refusal is the conflict code of BR42.3 and no database call is made (BR41.2, BR42.3)", async () => {
  for (const code of [
    "IMPORT_MALFORMED",
    "IMPORT_OVERSIZED",
    "IMPORT_MISSING_SHEET",
    "IMPORT_MISSING_HEADER",
    "IMPORT_UNSAFE_CELL",
  ] as const) {
    const { fake, run } = port({}, () => ({ ok: false, code, detail: "fixed words" }));
    const outcome = await run("import.preview", { workbook: upload() }, "imp-key-0002");
    assert.deepEqual(outcome, { state: "conflict", code }, code);
    assert.deepEqual(fake.rpcCalls, [], "nothing is staged");
  }
});

test("a repeated preview key whose run was cancelled or has expired meanwhile reads as a stale preview, not as a malformed answer", async () => {
  for (const modelState of ["cancelled", "expired"]) {
    const { run } = port({
      rpc: () =>
        envelope(
          "success",
          "replayed",
          model({ model_state: modelState, run_status: modelState }),
          RUN,
        ),
    });
    assert.deepEqual(
      await run("import.preview", { workbook: upload() }, "imp-key-0009"),
      { state: "invalidated", code: "IMPORT_PREVIEW_STALE" },
      modelState,
    );
  }
  // A replay of a live run is still the preview of that run.
  const { run } = port({ rpc: () => envelope("success", "replayed", model(), RUN) });
  assert.equal(
    success(await run("import.preview", { workbook: upload() }, "imp-key-0010")) !== null,
    true,
  );
});

test("a missing file is a validation result, no parser configured is denied, and a path in the name is cut off (BR41.2)", async () => {
  const { fake, run } = port({ rpc: () => envelope("success", null, model(), RUN) });
  const missing = await run("import.preview", { workbook: "not-a-file" }, "imp-key-0003");
  assert.equal(missing.state, "validation");
  assert.equal(fake.rpcCalls.length, 0);

  const noParser = port({}, null);
  assert.deepEqual(await noParser.run("import.preview", { workbook: upload() }, "imp-key-0004"), {
    state: "denied",
  });

  await run(
    "import.preview",
    { workbook: upload("C:\\Users\\Valaki\\Dokumentumok\\adat.xlsx") },
    "imp-key-0005",
  );
  await run("import.preview", { workbook: upload("/home/valaki/adat2.xlsx") }, "imp-key-0006");
  assert.deepEqual(
    fake.rpcCalls.map((call) => call.args.p_workbook_name),
    ["adat.xlsx", "adat2.xlsx"],
    "the file name is only a label",
  );
});

test("a real workbook goes through the real parser into the rows the function takes, with the fresh key of each attempt (NFR2.26)", async () => {
  const { fake, run } = port({ rpc: () => envelope("success", null, model(), RUN) }, parseWorkbook);
  const bytes = buildWorkbook();
  await run(
    "import.preview",
    { workbook: new WorkbookUpload("minta.xlsx", bytes) },
    "imp-attempt-1",
  );
  await run(
    "import.preview",
    { workbook: new WorkbookUpload("minta.xlsx", bytes) },
    "imp-attempt-2",
  );
  assert.deepEqual(
    fake.rpcCalls.map((call) => call.args.p_idempotency_key),
    ["imp-attempt-1", "imp-attempt-2"],
    "every attempt carries its own key",
  );
  const rows = fake.rpcCalls[0]!.args.p_rows as { sheet: string; row: number; values?: unknown }[];
  assert.ok(rows.length > 10);
  assert.ok(rows.some((row) => row.sheet === "Szülők elérhetősége" && row.values !== undefined));
  assert.ok(rows.some((row) => row.sheet === "ÁLLATOK" && !("values" in row)));
});

test("an upload without a key reaches the function as an empty key, which it refuses with a validation result (BR42.3)", async () => {
  const { fake, run } = port({ rpc: () => envelope("validation", "idempotency_key_invalid") });
  const outcome = await run("import.preview", { workbook: upload() });
  assert.equal(fake.rpcCalls[0]!.args.p_idempotency_key, "");
  assert.deepEqual(outcome, {
    state: "validation",
    fieldErrors: { idempotencyKey: "VAL-IDEMPOTENCY-KEY" },
    code: "idempotency_key_invalid",
  });
});

test("the status is the empty state without a run, the latest run's model with one, and denied for others (BR41.13)", async () => {
  const none = port({ rpc: () => envelope("success", null, { run: null }) });
  assert.deepEqual(await none.run("import.status"), { state: "empty" });
  assert.deepEqual(names(none.fake), ["import_status"]);

  const committed = port({
    rpc: () =>
      envelope("success", null, {
        run: model({
          model_state: "committed",
          step: 7,
          imported_rows: 8,
          skipped_rows: 5,
          conflicts: [],
          open_conflicts: 0,
        }),
      }),
  });
  const preview = success(await committed.run("import.status")) as Record<string, unknown>;
  assert.equal(preview.state, "committed");
  assert.equal(preview.step, 7);
  assert.equal(preview.runVersion, 1);

  const denied = port({ rpc: () => envelope("denied", "authorization_denied") });
  assert.deepEqual(await denied.run("import.status"), { state: "denied" });
});

test("two conflicts resolve in sequence: each answer's version is the next call's expected version (BR41.5, BR42.1)", async () => {
  let version = 3;
  const { fake, run } = port({
    rpc: (_, args) => {
      assert.equal(args.p_expected_run_version, version, "the call carries the current version");
      version += 1;
      return envelope(
        "success",
        null,
        model({
          version,
          conflicts: [],
          open_conflicts: version === 5 ? 0 : 1,
          model_state: version === 5 ? "confirmed" : "conflicts",
        }),
        RUN,
      );
    },
  });
  const first = success(
    await run(
      "import.resolve",
      { id: RUN, expectedVersion: 3, conflictId: CONFLICT_1, resolution: "keep-existing" },
      "res-key-0001",
    ),
  ) as { runVersion: number };
  assert.equal(first.runVersion, 4);
  const second = success(
    await run(
      "import.resolve",
      {
        id: RUN,
        expectedVersion: first.runVersion,
        conflictId: CONFLICT_2,
        resolution: "use-import",
      },
      "res-key-0002",
    ),
  ) as { runVersion: number; state: string };
  assert.equal(second.runVersion, 5);
  assert.equal(second.state, "confirmed");
  assert.deepEqual(
    fake.rpcCalls.map((call) => [
      call.args.p_run_id,
      call.args.p_conflict_id,
      call.args.p_resolution,
      call.args.p_idempotency_key,
    ]),
    [
      [RUN, CONFLICT_1, "keep-existing", "res-key-0001"],
      [RUN, CONFLICT_2, "use-import", "res-key-0002"],
    ],
  );
});

test("a stale run, an unknown conflict and ids that name nothing give the codes of the table (BR42.3)", async () => {
  const resolve = {
    id: RUN,
    expectedVersion: 1,
    conflictId: CONFLICT_1,
    resolution: "keep-existing",
  };
  const stale = port({ rpc: () => envelope("invalidated", "IMPORT_PREVIEW_STALE") });
  assert.deepEqual(await stale.run("import.resolve", resolve, "res-key-0003"), {
    state: "invalidated",
    code: "IMPORT_PREVIEW_STALE",
  });
  const unresolved = port({ rpc: () => envelope("conflict", "IMPORT_CONFLICT_UNRESOLVED") });
  assert.deepEqual(
    await unresolved.run(
      "import.resolve",
      { ...resolve, resolution: "use-import" },
      "res-key-0004",
    ),
    { state: "conflict", code: "IMPORT_CONFLICT_UNRESOLVED" },
  );
  const offline = port({});
  assert.deepEqual(
    await offline.run("import.resolve", { ...resolve, id: "not-a-uuid" }, "res-key-0005"),
    { state: "invalidated", code: "IMPORT_PREVIEW_STALE" },
  );
  assert.deepEqual(
    await offline.run("import.resolve", { ...resolve, conflictId: "x" }, "res-key-0006"),
    { state: "conflict", code: "IMPORT_CONFLICT_UNRESOLVED" },
  );
  assert.deepEqual(offline.fake.rpcCalls, [], "no call for an id that names nothing");
});

test("a commit sends the run id, the fingerprint and the confirmation with a fresh key, and reports the real counts (BR41.6)", async () => {
  const { fake, run } = port({
    rpc: () =>
      envelope(
        "success",
        null,
        model({
          model_state: "committed",
          step: 7,
          imported_rows: 8,
          skipped_rows: 5,
          version: 6,
          conflicts: [],
          open_conflicts: 0,
          created_rows: 5,
          updated_rows: 3,
          archived_rows: 3,
        }),
        RUN,
      ),
  });
  const outcome = success(await run("import.commit", COMMIT, "commit-key-1"));
  assert.deepEqual(outcome, {
    runId: RUN,
    importedRows: 8,
    skippedRows: 5,
    fingerprint: FINGERPRINT,
    state: "committed",
    runVersion: 6,
    createdRows: 5,
    updatedRows: 3,
    archivedRows: 3,
  });
  await run("import.commit", { ...COMMIT, confirmed: "" }, "commit-key-2");
  await run(
    "import.commit",
    { id: RUN, expectedVersion: 1, fingerprint: FINGERPRINT },
    "commit-key-3",
  );
  assert.deepEqual(
    fake.rpcCalls.map((call) => [
      call.args.p_idempotency_key,
      call.args.p_confirmation,
      call.args.p_fingerprint,
    ]),
    [
      ["commit-key-1", "yes", FINGERPRINT],
      ["commit-key-2", null, FINGERPRINT],
      ["commit-key-3", null, FINGERPRINT],
    ],
    "only an explicit yes confirms; the function refuses the rest",
  );
});

test("every commit refusal is mapped code by code to its result state (BR42.3)", async () => {
  const table: [string, string][] = [
    ["conflict", "IMPORT_FINGERPRINT_CHANGED"],
    ["conflict", "IMPORT_CONFLICT_UNRESOLVED"],
    ["conflict", "IMPORT_CONFIRMATION_REQUIRED"],
    ["conflict", "IMPORT_MATCH_CHANGED"],
    ["invalidated", "IMPORT_PREVIEW_STALE"],
  ];
  for (const [state, code] of table) {
    const { run } = port({ rpc: () => envelope(state, code, model(), RUN) });
    assert.deepEqual(await run("import.commit", COMMIT, "commit-key-4"), { state, code }, code);
  }
  const offline = port({});
  assert.deepEqual(await offline.run("import.commit", { ...COMMIT, id: "nope" }, "commit-key-5"), {
    state: "invalidated",
    code: "IMPORT_PREVIEW_STALE",
  });
});

test("a retryable commit failure marks the run interrupted and is raised as retryable; a failed marking changes nothing else (BR41.9)", async () => {
  const marked = port({
    rpc: (name) =>
      name === "import_commit"
        ? failure("08006")
        : envelope("success", null, model({ model_state: "interrupted" }), RUN),
  });
  await assert.rejects(marked.run("import.commit", COMMIT, "commit-key-6"), RetryableDataFailure);
  assert.deepEqual(names(marked.fake), ["import_commit", "import_mark_interrupted"]);
  assert.deepEqual(marked.fake.rpcCalls[1]!.args, {
    p_run_id: RUN,
    p_fingerprint: FINGERPRINT,
    p_confirmation: "yes",
  });

  const markingFails = port({ rpc: () => failure("08006") });
  await assert.rejects(
    markingFails.run("import.commit", COMMIT, "commit-key-7"),
    RetryableDataFailure,
    "the original failure is what the caller sees",
  );
  assert.deepEqual(names(markingFails.fake), ["import_commit", "import_mark_interrupted"]);

  for (const response of [
    failure("XX000"),
    envelope("denied", "authorization_denied"),
  ] as FakeResponse[]) {
    const other = port({ rpc: () => response });
    try {
      await other.run("import.commit", COMMIT, "commit-key-8");
    } catch (error) {
      assert.ok(error instanceof TerminalDataFailure);
    }
    assert.deepEqual(
      names(other.fake),
      ["import_commit"],
      "a terminal failure or a refusal marks nothing",
    );
  }
});

test("recovery resumes with the action 'resume' and maps its two codes (BR41.9, BR42.3)", async () => {
  const { fake, run } = port({
    rpc: () =>
      envelope(
        "success",
        null,
        model({
          model_state: "recovered",
          step: 7,
          imported_rows: 8,
          skipped_rows: 5,
          conflicts: [],
          open_conflicts: 0,
        }),
        RUN,
      ),
  });
  const outcome = success(
    await run("import.recover", { id: RUN, expectedVersion: 1, action: "resume" }, "rec-key-0001"),
  ) as { state: string; importedRows: number };
  assert.deepEqual([outcome.state, outcome.importedRows], ["recovered", 8]);
  assert.deepEqual(fake.rpcCalls[0], {
    name: "import_recover",
    args: { p_idempotency_key: "rec-key-0001", p_run_id: RUN, p_action: "resume" },
  });
  for (const code of ["IMPORT_RECOVERY_NOT_AVAILABLE", "IMPORT_RECOVERY_ACTION_INVALID"]) {
    const refused = port({ rpc: () => envelope("conflict", code) });
    assert.deepEqual(
      await refused.run(
        "import.recover",
        { id: RUN, expectedVersion: 1, action: "other" },
        "rec-key-0002",
      ),
      { state: "conflict", code },
    );
  }
  const offline = port({});
  assert.deepEqual(
    await offline.run(
      "import.recover",
      { id: "nope", expectedVersion: 1, action: "resume" },
      "rec-key-0003",
    ),
    { state: "conflict", code: "IMPORT_RECOVERY_NOT_AVAILABLE" },
  );
});

test("a cancel names the run and answers its id; a stale run reads as stale (BR41.8)", async () => {
  const { fake, run } = port({
    rpc: () => envelope("success", null, model({ model_state: "cancelled" }), RUN),
  });
  assert.deepEqual(
    success(await run("import.cancel", { id: RUN, expectedVersion: 1 }, "cancel-key-1")),
    {
      runId: RUN,
    },
  );
  assert.deepEqual(fake.rpcCalls[0], { name: "import_cancel", args: { p_run_id: RUN } });
  const stale = port({ rpc: () => envelope("invalidated", "IMPORT_PREVIEW_STALE") });
  assert.deepEqual(
    await stale.run("import.cancel", { id: RUN, expectedVersion: 1 }, "cancel-key-2"),
    {
      state: "invalidated",
      code: "IMPORT_PREVIEW_STALE",
    },
  );
  assert.deepEqual(
    await port({}).run("import.cancel", { id: "x", expectedVersion: 1 }, "cancel-key-3"),
    {
      state: "invalidated",
      code: "IMPORT_PREVIEW_STALE",
    },
  );
});

test("a response the adapter does not know is a terminal failure, never a guessed value (BR32.4)", async () => {
  for (const bad of [
    model({ model_state: "exploded" }),
    model({ step: 9 }),
    model({ conflicts: [{ id: CONFLICT_1, row_label: "x", message: "y", resolution: "maybe" }] }),
    model({ changed_rows: [1, 2] }),
  ]) {
    const { run } = port({ rpc: () => envelope("success", null, { run: bad }) });
    await assert.rejects(run("import.status"), TerminalDataFailure);
  }
  const unknownState = port({ rpc: () => envelope("surprise", null, model(), RUN) });
  await assert.rejects(
    unknownState.run(
      "import.resolve",
      { id: RUN, expectedVersion: 1, conflictId: CONFLICT_1, resolution: "keep-existing" },
      "res-key-0009",
    ),
    TerminalDataFailure,
  );
});

test("the adapter answers every import and reminder operation the admin facade names", () => {
  for (const operation of [
    "import.preview",
    "import.status",
    "import.resolve",
    "import.commit",
    "import.recover",
    "import.cancel",
    "reminders.list",
    "reminders.retry",
  ] as const) {
    assert.ok(DATABASE_ADMIN_OPERATIONS.includes(operation), operation);
  }
});
