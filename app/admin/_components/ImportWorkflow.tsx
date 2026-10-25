import Link from "next/link";
import type { ImportPreviewModel } from "../../../src/application/index.ts";
import type { AdminAction } from "../actions.ts";
import { AdminFileField, AdminMutationForm } from "./AdminMutationForm.tsx";

const STEPS = [
  "Kiválasztás",
  "Ellenőrzés",
  "Előnézet",
  "Ütközések",
  "Megerősítés",
  "Mentés",
  "Eredmény",
];

export type ImportWorkflowActions = Readonly<{
  resolveConflict: AdminAction;
  commit: AdminAction;
  recover: AdminAction;
  /** The workbook upload and the cancel of an open run. */
  upload?: AdminAction;
  cancel?: AdminAction;
}>;

/**
 * Where the "new upload" link of the result step leads: the same screen, asking for a new file. The address
 * names the finished run it was asked from, so it only holds while that run is the latest one: the new upload
 * makes a newer run, and the address then no longer matches (the new run, and later its result, show).
 */
export const newUploadHref = (runId: string): string =>
  `/admin/import?uj=${encodeURIComponent(runId)}`;

/**
 * The import screen (the real import, BR42.2): a file chooser, forms that send the real run id and run version
 * and a fresh idempotency key for every attempt, a confirmation and a result that show the real counts, the
 * source line with the file name, a cancel for an open run, and a link to a new upload at the result step.
 */
export function ImportWorkflow({
  preview,
  actions,
}: Readonly<{
  preview?: ImportPreviewModel;
  actions: ImportWorkflowActions;
}>) {
  const current = preview?.step ?? 1;
  return (
    <div className="advanced-stack" data-testid="admin-import-workflow">
      <ol
        className="import-stepper"
        aria-label="Importálás lépései"
        data-testid="admin-import-stepper"
      >
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={current === index + 1 ? "step" : undefined}
            className={current >= index + 1 ? "completed" : ""}
          >
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {!preview && actions.upload && (
        <AdminMutationForm
          action={actions.upload}
          submitLabel="Ellenőrzés és előnézet"
          testId="admin-import-preview-form"
        >
          <AdminFileField
            id="workbook"
            name="workbook"
            label="Munkafüzet (.xlsx)"
            accept=".xlsx"
            testId="admin-import-file-input"
            hint="A fájl legfeljebb 5 MB lehet; a kötelező lapokat és fejléceket a szerver ellenőrzi."
          />
        </AdminMutationForm>
      )}
      {preview && <PreviewDetails preview={preview} actions={actions} />}
    </div>
  );
}

/** The text above the confirmation: the real size of the run. */
function confirmText(preview: ImportPreviewModel): string {
  return `A mentés a munkafüzet ${preview.totalRows} sorát dolgozza fel (${preview.conflicts.length} feloldott ütközéssel). A művelet ismétlése nem hoz létre másolatot.`;
}

function PreviewDetails({
  preview,
  actions,
}: Readonly<{
  preview: ImportPreviewModel;
  actions: ImportWorkflowActions;
}>) {
  const unresolved = preview.conflicts.filter((conflict) => !conflict.resolution);
  const finished = preview.state === "committed" || preview.state === "recovered";
  const interrupted = preview.state === "interrupted";
  const runId = preview.runId ?? preview.id;
  const version = String(preview.runVersion ?? 1);
  return (
    <>
      <section className="advanced-panel" data-testid="admin-import-preview">
        <h2>Adatvédelmi szempontból szűkített előnézet</h2>
        <dl className="advanced-details">
          <div>
            <dt>Forrás</dt>
            <dd data-testid="admin-import-source">{preview.fileName}</dd>
          </div>
          <div>
            <dt>Sorok</dt>
            <dd>{preview.totalRows}</dd>
          </div>
          <div>
            <dt>Ujjlenyomat</dt>
            <dd>
              <code>{preview.fingerprint}</code>
            </dd>
          </div>
        </dl>
        <ul>
          {preview.changedRows.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      </section>
      {unresolved.map((conflict) => (
        <AdminMutationForm
          key={conflict.id}
          action={actions.resolveConflict}
          submitLabel="Ütközés feloldása"
          testId="admin-import-conflict-form"
          longForm
        >
          <h2>{conflict.rowLabel}</h2>
          <p>{conflict.message}</p>
          <fieldset>
            <legend>Feloldás</legend>
            <label>
              <input type="radio" name="resolution" value="keep-existing" /> Meglévő adat megtartása
            </label>
            {!conflict.skipOnly && (
              <label>
                <input type="radio" name="resolution" value="use-import" /> Importált adat
                használata
              </label>
            )}
          </fieldset>
          <input type="hidden" name="previewId" value={runId} />
          <input type="hidden" name="conflictId" value={conflict.id} />
          <input type="hidden" name="expectedVersion" value={version} />
          <input type="hidden" name="idempotencyKey" value={`import-resolve:${conflict.id}`} />
        </AdminMutationForm>
      ))}
      {unresolved.length === 0 && !finished && !interrupted && (
        <AdminMutationForm
          action={actions.commit}
          submitLabel="Import véglegesítése"
          testId="admin-import-commit-form"
          longForm
        >
          <h2>Megerősítés</h2>
          <p data-testid="admin-import-confirm-text">{confirmText(preview)}</p>
          <label>
            <input
              type="checkbox"
              name="confirmed"
              value="yes"
              data-testid="admin-import-confirm-checkbox"
            />{" "}
            Megerősítem a következményeket
          </label>
          <input type="hidden" name="previewId" value={runId} />
          <input type="hidden" name="fingerprint" value={preview.fingerprint} />
          <input type="hidden" name="expectedVersion" value={version} />
          <input type="hidden" name="idempotencyKey" value="import-commit:run" />
        </AdminMutationForm>
      )}
      {preview.step === 6 && !finished && (
        <AdminMutationForm
          action={actions.recover}
          submitLabel="Helyreállítás folytatása"
          testId="admin-import-recovery-form"
          longForm
        >
          <p>A mentés megszakadt, részleges közzététel nem történt.</p>
          <input type="hidden" name="runId" value={runId} />
          <input type="hidden" name="idempotencyKey" value="import-recover:run" />
        </AdminMutationForm>
      )}
      {!finished && actions.cancel && (
        <AdminMutationForm
          action={actions.cancel}
          submitLabel="Import megszakítása"
          testId="admin-import-cancel-form"
          longForm
        >
          <p>
            A megszakítás törli a feltöltött sorokat, és új munkafüzetet lehet feltölteni. A már
            elmentett adatokat nem érinti.
          </p>
          <input type="hidden" name="runId" value={runId} />
          <input type="hidden" name="expectedVersion" value={version} />
          <input type="hidden" name="idempotencyKey" value="import-cancel:run" />
        </AdminMutationForm>
      )}
      {finished && (
        <section
          className="advanced-panel success-panel"
          role="status"
          data-testid="admin-import-outcome"
        >
          <h2 tabIndex={-1}>Importálás lezárva</h2>
          <p data-testid="admin-import-outcome-counts">
            {preview.importedRows ?? 0} elem jött létre vagy módosult, {preview.skippedRows ?? 0}{" "}
            sor változatlan maradt vagy archívumként lett megszámolva.
          </p>
          <p>
            <Link href={newUploadHref(runId)} data-testid="admin-import-new-upload-link">
              Új feltöltés
            </Link>
          </p>
        </section>
      )}
    </>
  );
}
