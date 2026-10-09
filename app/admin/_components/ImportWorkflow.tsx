import type { ImportPreviewModel } from "../../../src/application/index.ts";
import type { AdminAction } from "../actions.ts";
import { AdminMutationForm } from "./AdminMutationForm.tsx";
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
}>;

export function ImportWorkflow({
  preview,
  actions,
}: Readonly<{ preview?: ImportPreviewModel; actions: ImportWorkflowActions }>) {
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
      {!preview && (
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
      {preview && <PreviewDetails preview={preview} actions={actions} />}
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
    </div>
  );
}

function PreviewDetails({
  preview,
  actions,
}: Readonly<{ preview: ImportPreviewModel; actions: ImportWorkflowActions }>) {
  const unresolved = preview.conflicts.filter((conflict) => !conflict.resolution);
  return (
    <>
      <section className="advanced-panel" data-testid="admin-import-preview">
        <h2>Adatvédelmi szempontból szűkített előnézet</h2>
        <dl className="advanced-details">
          <div>
            <dt>Forrás</dt>
            <dd>{preview.fixtureId}</dd>
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
        >
          <h2>{conflict.rowLabel}</h2>
          <p>{conflict.message}</p>
          <fieldset>
            <legend>Feloldás</legend>
            <label>
              <input type="radio" name="resolution" value="keep-existing" /> Meglévő adat megtartása
            </label>
            <label>
              <input type="radio" name="resolution" value="use-import" /> Importált adat használata
            </label>
          </fieldset>
          <input type="hidden" name="previewId" value={preview.id} />
          <input type="hidden" name="conflictId" value={conflict.id} />
          <input type="hidden" name="expectedVersion" value="1" />
          <input type="hidden" name="idempotencyKey" value={`import-resolution-${conflict.id}`} />
        </AdminMutationForm>
      ))}
      {unresolved.length === 0 && preview.state !== "committed" && (
        <AdminMutationForm
          action={actions.commit}
          submitLabel="Import véglegesítése"
          testId="admin-import-commit-form"
        >
          <h2>Megerősítés</h2>
          <p>
            A mentés 3 engedélyezett változást hajt végre. A művelet ismétlése nem hoz létre
            másolatot.
          </p>
          <label>
            <input
              type="checkbox"
              name="confirmed"
              value="yes"
              data-testid="admin-import-confirm-checkbox"
            />{" "}
            Megerősítem a következményeket
          </label>
          <input type="hidden" name="previewId" value={preview.id} />
          <input type="hidden" name="fingerprint" value={preview.fingerprint} />
          <input type="hidden" name="expectedVersion" value="1" />
          <input type="hidden" name="idempotencyKey" value="import-commit-waldorf-v1" />
        </AdminMutationForm>
      )}
      {preview.step === 6 && (
        <AdminMutationForm
          action={actions.recover}
          submitLabel="Helyreállítás folytatása"
          testId="admin-import-recovery-form"
        >
          <p>A mentés megszakadt, részleges közzététel nem történt.</p>
          <input type="hidden" name="runId" value="run-waldorf-v1" />
          <input type="hidden" name="idempotencyKey" value="import-recover-waldorf-v1" />
        </AdminMutationForm>
      )}
      {preview.state === "committed" && (
        <section
          className="advanced-panel success-panel"
          role="status"
          data-testid="admin-import-outcome"
        >
          <h2 tabIndex={-1}>Importálás lezárva</h2>
          <p>
            3 rekord módosult, 1 sor változatlan maradt. Szimulált adatbázishatás;
            Supabase-tranzakció: OUTSTANDING.
          </p>
        </section>
      )}
    </>
  );
}
