import {
  WorkbookUpload,
  type DomainOutcome,
  type ImportCancelOutcome,
  type ImportOutcome,
  type ImportPreviewModel,
} from "../application/index.ts";
import type { WorkbookParser } from "../import-parser/types.ts";
import { malformedResponse, RetryableDataFailure } from "./errors.ts";
import type { DataGateway } from "./gateway.ts";
import { payloadFlag, payloadNumber, payloadText, type Payload } from "./payload.ts";
import { refused, toOutcome } from "./results.ts";
import { asRow, asRows, integer, isUuid, oneOf, optionalText, text, type Row } from "./values.ts";

/**
 * The Excel import on the real database (BR41, BR42.1, BR42.3): the upload is parsed here, on the server, from
 * its bytes; the parsed rows go to `import_preview_create`; every later call sends the run id and the run
 * version the previous answer carried, and each attempt carries the idempotency key its form made for it.
 * The database answers the result states and the IMPORT_* codes the screens already map.
 */

export type ImportCall = Readonly<{ payload: Payload; idempotencyKey?: string }>;

const MODEL_STATES = [
  "preview",
  "conflicts",
  "confirmed",
  "committed",
  "interrupted",
  "recovered",
] as const;
const COMMIT_STATES = ["committed", "interrupted", "recovered"] as const;

/** A run id that is not a uuid cannot be a current run: it reads like a stale one, as the function would say. */
const stale = <T>(): DomainOutcome<T> => ({ state: "invalidated", code: "IMPORT_PREVIEW_STALE" });
const NO_KEY = "";

function strings(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw malformedResponse();
  }
  return value as string[];
}

const RESOLUTIONS: Readonly<Record<string, "keep-existing" | "use-import">> = Object.freeze({
  keep_existing: "keep-existing",
  use_import: "use-import",
});

/** The run model of the database (`import_run_model`) as the preview model of the screens. */
function toPreview(row: Row): ImportPreviewModel {
  const state = oneOf(row, "model_state", MODEL_STATES);
  const step = integer(row, "step");
  if (step < 1 || step > 7) throw malformedResponse();
  const fileName = text(row, "workbook_name");
  const runId = text(row, "run_id");
  const version = integer(row, "version");
  return Object.freeze({
    id: runId,
    fingerprint: text(row, "fingerprint"),
    changedRows: Object.freeze([...strings(row.changed_rows)]),
    conflicts: Object.freeze(
      asRows(row.conflicts).map((conflict) => {
        const resolution = optionalText(conflict, "resolution");
        const mapped = resolution === undefined ? undefined : RESOLUTIONS[resolution];
        if (resolution !== undefined && mapped === undefined) throw malformedResponse();
        return Object.freeze({
          id: text(conflict, "id"),
          rowLabel: text(conflict, "row_label"),
          message: text(conflict, "message"),
          ...(mapped !== undefined ? { resolution: mapped } : {}),
          skipOnly: conflict.skip_only === true,
        });
      }),
    ),
    step: step as ImportPreviewModel["step"],
    fixtureId: fileName,
    totalRows: integer(row, "total_rows"),
    state,
    runId,
    runVersion: version,
    fileName,
    warningCount: integer(row, "warning_count"),
    importedRows: integer(row, "imported_rows"),
    skippedRows: integer(row, "skipped_rows"),
  });
}

/** What a commit or a recovery reports: the run's real counts. A repeated key answers with the run alone. */
function toOutcomeModel(row: Row): ImportOutcome {
  const created = typeof row.created_rows === "number" ? row.created_rows : undefined;
  const updated = typeof row.updated_rows === "number" ? row.updated_rows : undefined;
  const archived = typeof row.archived_rows === "number" ? row.archived_rows : undefined;
  return Object.freeze({
    runId: text(row, "run_id"),
    importedRows: integer(row, "imported_rows"),
    skippedRows: integer(row, "skipped_rows"),
    fingerprint: text(row, "fingerprint"),
    state: oneOf(row, "model_state", COMMIT_STATES),
    runVersion: integer(row, "version"),
    ...(created !== undefined ? { createdRows: created } : {}),
    ...(updated !== undefined ? { updatedRows: updated } : {}),
    ...(archived !== undefined ? { archivedRows: archived } : {}),
  });
}

/** The name of the file as a label: whatever path a browser or a caller may have added is cut off. */
function labelOf(fileName: string): string {
  return fileName.replace(/^.*[\\/]/, "").trim();
}

/**
 * import.preview: parse the uploaded bytes, then stage them. The parser's refusals are the conflict results of
 * BR42.3 and create no run. The file name is kept only as a label.
 */
export async function previewImport(
  gateway: DataGateway,
  parseWorkbook: WorkbookParser,
  call: ImportCall,
): Promise<DomainOutcome<ImportPreviewModel>> {
  const upload = call.payload.workbook;
  if (!(upload instanceof WorkbookUpload)) return refused({ workbook: "VAL-REQUIRED" });
  const parsed = parseWorkbook(upload.bytes);
  if (!parsed.ok) return { state: "conflict", code: parsed.code };
  const key = call.idempotencyKey ?? NO_KEY;
  const envelope = await gateway.call(
    "import_preview_create",
    {
      p_idempotency_key: key,
      p_workbook_name: labelOf(upload.fileName),
      p_rows: parsed.rows,
    },
    key,
  );
  // A repeated key returns the run it created. If that run was cancelled or has expired meanwhile, it is no
  // preview any more: the person reads the stale message and uploads again, not a malformed-response error.
  if (
    envelope.state === "success" &&
    (envelope.model_state === "cancelled" || envelope.model_state === "expired")
  ) {
    return stale();
  }
  return toOutcome(envelope, toPreview);
}

/** import.status: the starting super admin's latest run; none means the upload form (the empty state). */
export async function importStatus(
  gateway: DataGateway,
): Promise<DomainOutcome<ImportPreviewModel>> {
  const envelope = await gateway.call("import_status", {});
  const outcome = toOutcome(envelope, (current) =>
    current.run === null || current.run === undefined ? undefined : toPreview(asRow(current.run)),
  );
  if (outcome.state !== "success") return outcome as DomainOutcome<ImportPreviewModel>;
  return outcome.data === undefined ? { state: "empty" } : { state: "success", data: outcome.data };
}

/** import.resolve: one conflict, on the run version the last answer carried; the answer carries the next one. */
export async function resolveImport(
  gateway: DataGateway,
  call: ImportCall,
): Promise<DomainOutcome<ImportPreviewModel>> {
  const runId = payloadText(call.payload, "id");
  if (runId === undefined || !isUuid(runId)) return stale();
  const conflictId = payloadText(call.payload, "conflictId");
  if (conflictId === undefined || !isUuid(conflictId)) {
    return { state: "conflict", code: "IMPORT_CONFLICT_UNRESOLVED" };
  }
  const key = call.idempotencyKey ?? NO_KEY;
  const envelope = await gateway.call(
    "import_conflict_resolve",
    {
      p_idempotency_key: key,
      p_run_id: runId,
      p_expected_run_version: payloadNumber(call.payload, "expectedVersion") ?? null,
      p_conflict_id: conflictId,
      p_resolution: payloadText(call.payload, "resolution") ?? null,
    },
    key,
  );
  return toOutcome(envelope, toPreview);
}

/**
 * Tells the database that a commit which failed with a retryable failure was interrupted. The failed commit
 * rolled back, so the run is exactly as it was; this small call of its own only changes its label (BR41.9). If
 * this call fails too, nothing is lost: the run stays previewed or confirmed and the commit can be repeated.
 */
async function markInterrupted(
  gateway: DataGateway,
  runId: string,
  fingerprint: string | null,
  confirmation: string | null,
): Promise<void> {
  try {
    // The marking carries the fingerprint and the confirmation of the commit that failed: the database makes the
    // commit's own checks before it labels the run, so a run cannot be recovered without them.
    await gateway.call("import_mark_interrupted", {
      p_run_id: runId,
      p_fingerprint: fingerprint,
      p_confirmation: confirmation,
    });
  } catch {
    // The run stays as it was; the commit is idempotent and can simply be run again.
  }
}

/** import.commit: bound to the run's fingerprint; one transaction, or nothing. */
export async function commitImport(
  gateway: DataGateway,
  call: ImportCall,
): Promise<DomainOutcome<ImportOutcome>> {
  const runId = payloadText(call.payload, "id");
  if (runId === undefined || !isUuid(runId)) return stale();
  const key = call.idempotencyKey ?? NO_KEY;
  const confirmed =
    payloadFlag(call.payload, "confirmed") === true || call.payload.confirmed === "yes";
  const fingerprint = payloadText(call.payload, "fingerprint") ?? null;
  const confirmation = confirmed ? "yes" : null;
  let envelope;
  try {
    envelope = await gateway.call(
      "import_commit",
      {
        p_idempotency_key: key,
        p_run_id: runId,
        p_fingerprint: fingerprint,
        p_confirmation: confirmation,
      },
      key,
    );
  } catch (error) {
    if (error instanceof RetryableDataFailure) {
      await markInterrupted(gateway, runId, fingerprint, confirmation);
    }
    throw error;
  }
  return toOutcome(envelope, toOutcomeModel);
}

/** import.recover: the only action is 'resume'; the commit runs again from the staged rows. */
export async function recoverImport(
  gateway: DataGateway,
  call: ImportCall,
): Promise<DomainOutcome<ImportOutcome>> {
  const runId = payloadText(call.payload, "id");
  if (runId === undefined || !isUuid(runId)) {
    return { state: "conflict", code: "IMPORT_RECOVERY_NOT_AVAILABLE" };
  }
  const key = call.idempotencyKey ?? NO_KEY;
  const envelope = await gateway.call(
    "import_recover",
    {
      p_idempotency_key: key,
      p_run_id: runId,
      p_action: payloadText(call.payload, "action") ?? null,
    },
    key,
  );
  return toOutcome(envelope, toOutcomeModel);
}

/** import.cancel: ends the open run and deletes its staged rows. */
export async function cancelImport(
  gateway: DataGateway,
  call: ImportCall,
): Promise<DomainOutcome<ImportCancelOutcome>> {
  const runId = payloadText(call.payload, "id");
  if (runId === undefined || !isUuid(runId)) return stale();
  const envelope = await gateway.call("import_cancel", { p_run_id: runId });
  return toOutcome(envelope, (current) => Object.freeze({ runId: current.reference ?? runId }));
}
