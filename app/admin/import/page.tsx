import { AdminAccessState } from "../_components/AdminAccessState.tsx";
import { ImportWorkflow } from "../_components/ImportWorkflow.tsx";
import { resolveAdminFacade } from "../_lib/facade.ts";
import { resolveAdminSession } from "../_lib/session.ts";
import {
  commitImportAction,
  createImportPreviewAction,
  recoverImportAction,
  resolveImportConflictAction,
} from "../advanced-actions.ts";

export default async function AdminImportPage() {
  const [session, facade] = await Promise.all([resolveAdminSession(), resolveAdminFacade()]);
  if (session.state !== "success" || !facade) return <AdminAccessState kind="denied" />;
  const result = await facade.import.status(session.data.applicationSession, session.data.scope);
  if (result.state === "denied" || result.state === "invalidated")
    return <AdminAccessState kind="denied" />;
  return (
    <section className="admin-page" data-testid="admin-import-page">
      <header>
        <p className="eyebrow">Adminisztráció · szintetikus folyamat</p>
        <h1 tabIndex={-1} autoFocus>
          Importálás
        </h1>
        <p>Hét ellenőrizhető lépés, változatlan ujjlenyomat és egyszeri atomikus mentés.</p>
      </header>
      <ImportWorkflow
        preview={result.state === "success" ? result.data : undefined}
        actions={{
          createPreview: createImportPreviewAction,
          resolveConflict: resolveImportConflictAction,
          commit: commitImportAction,
          recover: recoverImportAction,
        }}
      />
    </section>
  );
}
