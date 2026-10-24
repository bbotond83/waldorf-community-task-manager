import Link from "next/link";
import type { ImportPreviewModel } from "../../../src/application/index.ts";
import type { AdminAction } from "../actions.ts";
import { AdminFileField, AdminMutationForm } from "./AdminMutationForm.tsx";
import { DeveloperDetails } from "./DeveloperDetails.tsx";

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
  createPreview: AdminAction;
  resolveConflict: AdminAction;
  commit: AdminAction;
  recover: AdminAction;
  /** Production mode: the workbook upload and the cancel of an open run. */
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
 * The import screen. In the synthetic mode it is the demo workflow it always was. In the production mode
 * (the real import, BR42.2) it differs in exactly these places: a file chooser replaces the demo workbook
 * select, the forms send the real run id and run version and a fresh idempotency key for every attempt, the
 * confirmation and the result show the real counts, the source line shows the file name, there are no
 * scenario selects, an open run can be cancelled, and the result step links to a new upload.
 */
export function ImportWorkflow({
  preview,
  actions,
  mode = "synthetic",
}: Readonly<{
  preview?: ImportPreviewModel;
  actions: ImportWorkflowActions;
  mode?: "synthetic" | "production";
}>) {
  const production = mode === "production";
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
      {!preview && production && actions.upload && (
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
      {!preview && !production && (
        <AdminMutationForm
          action={actions.createPreview}
          submitLabel="Ellenőrzés és előnézet"
          testId="admin-import-preview-form"
        >
          <label htmlFor="fixtureId">Szintetikus munkafüzet</label>
          <select
            id="fixtureId"
            name="fixtureId"
            defaultValue="workbook-waldorf-v1"
            data-testid="admin-import-fixture-select"
          >
            <option value="workbook-waldorf-v1">Waldorf 30 család — v1</option>
          </select>
          <input type="hidden" name="idempotencyKey" value="import-preview-waldorf-v1" />
          <p className="form-hint">
            A fájl legfeljebb 5 MB lehet; a kötelező lapokat és fejléceket a szerver ellenőrzi.
          </p>
        </AdminMutationForm>
      )}
      {preview && <PreviewDetails preview={preview} actions={actions} production={production} />}
      {!production && (
        <DeveloperDetails>
          {!preview && (
            <div>
              <label htmlFor="scenario">Ellenőrzési forgatókönyv</label>
              <select
                id="scenario"
                name="scenario"
                form="admin-import-preview-form"
                defaultValue="valid"
                data-testid="admin-import-scenario-select"
              >
                <option value="valid">Érvényes</option>
                <option value="malformed">Sérült fájl</option>
                <option value="oversized">Túl nagy fájl</option>
                <option value="missing-sheet">Hiányzó munkalap</option>
                <option value="missing-header">Hiányzó oszlop</option>
              </select>
            </div>
          )}
          {preview &&
            preview.conflicts.every((conflict) => conflict.resolution) &&
            preview.state !== "committed" && (
              <div>
                <label htmlFor="commitScenario">Mentési forgatókönyv</label>
                <select
                  id="commitScenario"
                  name="scenario"
                  form="admin-import-commit-form"
                  defaultValue="success"
                >
                  <option value="success">Sikeres</option>
                  <option value="interrupted">Megszakított</option>
                  <option value="retryable">Átmeneti hiba</option>
                  <option value="terminal">Végleges hiba</option>
                </select>
              </div>
            )}
          {preview &&
            !(preview.conflicts.every((c) => c.resolution) && preview.state !== "committed") && (
              <p>Nincs módosítható beállítás ebben a lépésben.</p>
            )}
        </DeveloperDetails>
      )}
    </div>
  );
}

/** The text above the confirmation: the real size of the run in production, the demo sentence otherwise. */
function confirmText(preview: ImportPreviewModel, production: boolean): string {
  if (!production) {
    return "A mentés 3 engedélyezett változást hajt végre. A művelet ismétlése nem hoz létre másolatot.";
  }
  return `A mentés a munkafüzet ${preview.totalRows} sorát dolgozza fel (${preview.conflicts.length} feloldott ütközéssel). A művelet ismétlése nem hoz létre másolatot.`;
}

function PreviewDetails({
  preview,
  actions,
  production,
}: Readonly<{
  preview: ImportPreviewModel;
  actions: ImportWorkflowActions;
  production: boolean;
}>) {
  const unresolved = preview.conflicts.filter((conflict) => !conflict.resolution);
  const finished = preview.state === "committed" || (production && preview.state === "recovered");
  const interrupted = production && preview.state === "interrupted";
  const runId = production ? (preview.runId ?? preview.id) : preview.id;
  const version = production ? String(preview.runVersion ?? 1) : "1";
  return (
    <>
      <section className="advanced-panel" data-testid="admin-import-preview">
        <h2>Adatvédelmi szempontból szűkített előnézet</h2>
        <dl className="advanced-details">
          <div>
            <dt>Forrás</dt>
            <dd data-testid="admin-import-source">{preview.fileName ?? preview.fixtureId}</dd>
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
          longForm={production}
        >
          <h2>{conflict.rowLabel}</h2>
          <p>{conflict.message}</p>
          <fieldset>
            <legend>Feloldás</legend>
            <label>
              <input type="radio" name="resolution" value="keep-existing" /> Meglévő adat megtartása
            </label>
            {!(production && conflict.skipOnly) && (
              <label>
                <input type="radio" name="resolution" value="use-import" /> Importált adat
                használata
              </label>
            )}
          </fieldset>
          <input type="hidden" name="previewId" value={runId} />
          <input type="hidden" name="conflictId" value={conflict.id} />
          <input type="hidden" name="expectedVersion" value={version} />
          <input
            type="hidden"
            name="idempotencyKey"
            value={
              production ? `import-resolve:${conflict.id}` : `import-resolution-${conflict.id}`
            }
          />
        </AdminMutationForm>
      ))}
      {unresolved.length === 0 && !finished && !interrupted && (
        <AdminMutationForm
          action={actions.commit}
          submitLabel="Import véglegesítése"
          testId="admin-import-commit-form"
          longForm={production}
        >
          <h2>Megerősítés</h2>
          <p data-testid="admin-import-confirm-text">{confirmText(preview, production)}</p>
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
          <input
            type="hidden"
            name="idempotencyKey"
            value={production ? "import-commit:run" : "import-commit-waldorf-v1"}
          />
        </AdminMutationForm>
      )}
      {preview.step === 6 && (!production || !finished) && (
        <AdminMutationForm
          action={actions.recover}
          submitLabel="Helyreállítás folytatása"
          testId="admin-import-recovery-form"
          longForm={production}
        >
          <p>A mentés megszakadt, részleges közzététel nem történt.</p>
          <input type="hidden" name="runId" value={production ? runId : "run-waldorf-v1"} />
          <input
            type="hidden"
            name="idempotencyKey"
            value={production ? "import-recover:run" : "import-recover-waldorf-v1"}
          />
        </AdminMutationForm>
      )}
      {production && !finished && actions.cancel && (
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
          {production ? (
            <>
              <p data-testid="admin-import-outcome-counts">
                {preview.importedRows ?? 0} elem jött létre vagy módosult,{" "}
                {preview.skippedRows ?? 0} sor változatlan maradt vagy archívumként lett
                megszámolva.
              </p>
              <p>
                <Link href={newUploadHref(runId)} data-testid="admin-import-new-upload-link">
                  Új feltöltés
                </Link>
              </p>
            </>
          ) : (
            <p>
              3 elem módosult, 1 sor változatlan maradt. Szimulált adatbázishatás;
              Supabase-tranzakció: OUTSTANDING.
            </p>
          )}
        </section>
      )}
    </>
  );
}
