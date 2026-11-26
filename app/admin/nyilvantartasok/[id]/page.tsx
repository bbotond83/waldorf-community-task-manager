import { randomUUID } from "node:crypto";
import Link from "next/link";
import { AdminBackLink } from "../../_components/AdminBackLink.tsx";
import { AdminMutationForm, AdminTextField } from "../../_components/AdminMutationForm.tsx";
import { AsyncStatePanel } from "../../_components/AsyncStatePanel.tsx";
import { DeveloperDetails } from "../../_components/DeveloperDetails.tsx";
import { ParentInvitations } from "../../_components/ParentInvitations.tsx";
import { RecordFields } from "../../_components/RecordFields.tsx";
import { resolveAdminLookups } from "../../_lib/request-lookups.ts";
import { archiveRecordAction, saveRecordAction } from "../../actions.ts";
import { resolveAdminFacade } from "../../_lib/facade.ts";
import { resolveAdminSession } from "../../_lib/session.ts";
import { terminalFailure } from "../../../../src/application/results.ts";
import { statusDisplay } from "../../../../src/application/status-labels.ts";
import { StatusBadge } from "../../../../src/runtime/StatusBadge.tsx";

export default async function RecordDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await resolveAdminSession();
  const facade = await resolveAdminFacade();
  const lookups = await resolveAdminLookups();
  const result =
    session.state === "success" && facade
      ? await facade.getRecord(session.data.applicationSession, session.data.scope, "record", id)
      : terminalFailure();
  return (
    <section className="admin-page" data-testid="admin-record-detail-page">
      <header>
        <AdminBackLink
          list="records"
          returnQuery={typeof query.vissza === "string" ? query.vissza : undefined}
        />
        <p className="eyebrow">Nyilvántartások</p>
        <h1 tabIndex={-1}>Elem részletei</h1>
      </header>
      <AsyncStatePanel
        result={result}
        testId="admin-record-detail-state"
        emptyMessage="Az elem nem található."
      >
        {(record) => (
          <div className="admin-detail-grid">
            <section>
              <h2>{record.title}</h2>
              <p>
                Állapot: <StatusBadge {...statusDisplay(record.state)} />
              </p>
            </section>
            {record.kind === "family" && record.details?.parents && (
              <ParentInvitations familyId={record.id} parents={record.details.parents} />
            )}
            <AdminMutationForm
              action={saveRecordAction}
              submitLabel="Módosítás mentése"
              testId="admin-record-edit-form"
              longForm={record.kind !== undefined}
            >
              <input type="hidden" name="id" value={record.id} />
              <input type="hidden" name="expectedVersion" value={record.version ?? 1} />
              <input
                type="hidden"
                name="idempotencyKey"
                value={`record:save:${record.id}:${randomUUID()}`}
              />
              {record.kind !== undefined && record.kind !== "event" && record.kind !== "task" ? (
                <RecordFields
                  mode="edit"
                  kind={record.kind}
                  title={record.title}
                  details={record.details}
                  lookups={lookups}
                />
              ) : (
                <>
                  <input type="hidden" name="kind" value="record" />
                  <AdminTextField
                    id="title"
                    name="title"
                    label="Megnevezés"
                    defaultValue={record.title}
                    required
                    testId="admin-record-title-input"
                  />
                </>
              )}
            </AdminMutationForm>
            {record.kind === "family" ? (
              // Archiving a family is its removal, so it goes through the confirmation page (U14).
              record.state !== "archived" && (
                <Link
                  className="button-link button-link-secondary admin-removal-start"
                  href={`/admin/nyilvantartasok/${record.id}/eltavolitas`}
                  data-testid="admin-family-remove-link"
                >
                  Család eltávolítása
                </Link>
              )
            ) : (
              <AdminMutationForm
                action={archiveRecordAction}
                submitLabel="Archiválás"
                testId="admin-record-archive-form"
              >
                <input type="hidden" name="id" value={record.id} />
                <input type="hidden" name="expectedVersion" value={record.version ?? 1} />
                <input
                  type="hidden"
                  name="idempotencyKey"
                  value={`record:archive:${record.id}:${randomUUID()}`}
                />
              </AdminMutationForm>
            )}
            <DeveloperDetails>
              <p>Verzió: {record.version}</p>
            </DeveloperDetails>
          </div>
        )}
      </AsyncStatePanel>
    </section>
  );
}
