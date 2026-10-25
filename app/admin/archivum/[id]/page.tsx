import { randomUUID } from "node:crypto";
import { AdminBackLink } from "../../_components/AdminBackLink.tsx";
import { AdminMutationForm } from "../../_components/AdminMutationForm.tsx";
import { AsyncStatePanel } from "../../_components/AsyncStatePanel.tsx";
import { restoreRecordAction } from "../../actions.ts";
import { resolveAdminFacade } from "../../_lib/facade.ts";
import { resolveAdminSession } from "../../_lib/session.ts";
import { terminalFailure } from "../../../../src/application/results.ts";
import { statusDisplay } from "../../../../src/application/status-labels.ts";
import { StatusBadge } from "../../../../src/runtime/StatusBadge.tsx";

export default async function ArchiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveAdminSession();
  const facade = await resolveAdminFacade();
  const result =
    session.state === "success" && facade
      ? await facade.getRecord(session.data.applicationSession, session.data.scope, "record", id)
      : terminalFailure();
  return (
    <section className="admin-page" data-testid="admin-archive-detail-page">
      <header>
        <AdminBackLink list="archive" />
        <p className="eyebrow">Archívum</p>
        <h1 tabIndex={-1}>Archivált elem</h1>
      </header>
      <AsyncStatePanel
        result={result}
        testId="admin-archive-detail-state"
        emptyMessage="Az elem nem található."
      >
        {(record) => (
          <>
            <h2>{record.title}</h2>
            <p>
              Állapot: <StatusBadge {...statusDisplay(record.state)} />
            </p>
            <AdminMutationForm
              action={restoreRecordAction}
              submitLabel="Visszaállítás"
              testId="admin-record-restore-form"
            >
              <input type="hidden" name="id" value={record.id} />
              <input type="hidden" name="expectedVersion" value={record.version ?? 1} />
              <input
                type="hidden"
                name="idempotencyKey"
                value={`record:restore:${record.id}:${randomUUID()}`}
              />
            </AdminMutationForm>
          </>
        )}
      </AsyncStatePanel>
    </section>
  );
}
