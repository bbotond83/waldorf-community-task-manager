import { AdminAccessState } from "../_components/AdminAccessState.tsx";
import { ImportWorkflow } from "../_components/ImportWorkflow.tsx";
import { resolveAdminFacade } from "../_lib/facade.ts";
import { resolveAdminSession } from "../_lib/session.ts";
import {
  cancelImportAction,
  commitImportAction,
  recoverImportAction,
  resolveImportConflictAction,
  uploadImportWorkbookAction,
} from "../advanced-actions.ts";

export default async function AdminImportPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Readonly<Record<string, string | string[] | undefined>>> }>) {
  const [session, facade, query] = await Promise.all([
    resolveAdminSession(),
    resolveAdminFacade(),
    searchParams ?? Promise.resolve({}),
  ]);
  if (session.state !== "success" || !facade) return <AdminAccessState kind="denied" />;
  const result = await facade.import.status(session.data.applicationSession, session.data.scope);
  if (result.state === "denied" || result.state === "invalidated")
    return <AdminAccessState kind="denied" />;
  // The "new upload" link of a finished run asks for the upload form again (BR41.13). The address names that
  // run, so it only applies while that run is the latest one: once the new upload has made a newer run, that
  // run is what shows, and later its own result.
  const newUpload =
    result.state === "success" &&
    (result.data.state === "committed" || result.data.state === "recovered") &&
    (query as Record<string, unknown>).uj === (result.data.runId ?? result.data.id);
  return (
    <section className="admin-page" data-testid="admin-import-page">
      <header>
        <p className="eyebrow">Adminisztráció · Import</p>
        <h1 tabIndex={-1} autoFocus>
          Importálás
        </h1>
        <p>Hét ellenőrizhető lépés, változatlan ujjlenyomat és egyszeri atomikus mentés.</p>
      </header>
      <ImportWorkflow
        preview={result.state === "success" && !newUpload ? result.data : undefined}
        actions={{
          resolveConflict: resolveImportConflictAction,
          commit: commitImportAction,
          recover: recoverImportAction,
          upload: uploadImportWorkbookAction,
          cancel: cancelImportAction,
        }}
      />
    </section>
  );
}
