import { randomUUID } from "node:crypto";
import Link from "next/link";
import { terminalFailure } from "../../../../../src/application/results.ts";
import { DIRECTORY_REFUSAL_MESSAGES } from "../../../../../src/data/copy.ts";
import { AsyncStatePanel } from "../../../_components/AsyncStatePanel.tsx";
import { RemovalForm } from "../../../_components/RemovalForm.tsx";
import {
  RemovalConsequences,
  RemovalCounts,
  RemovalGroupsWarning,
} from "../../../_components/RemovalPreview.tsx";
import { resolveAdminFacade } from "../../../_lib/facade.ts";
import { readRemovalPreview } from "../../../_lib/removal-reads.ts";
import { resolveAdminSession } from "../../../_lib/session.ts";
import { archiveRecordAction } from "../../../actions.ts";

/**
 * The confirmation before a family is removed (U14, W2 and W6). Archiving a family is its removal, so this page takes
 * the place of the one-click archive on the family record: it says what happens and how many records it touches.
 */
export default async function RemoveFamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveAdminSession();
  const facade = await resolveAdminFacade();
  const result =
    session.state === "success" && facade
      ? await facade.getRecord(session.data.applicationSession, session.data.scope, "record", id)
      : terminalFailure();
  const preview = await readRemovalPreview({ kind: "family", id });
  return (
    <section className="admin-page" data-testid="admin-family-remove-page">
      <header>
        <Link className="admin-back-link" href={`/admin/nyilvantartasok/${id}`}>
          Vissza a családhoz
        </Link>
        <p className="eyebrow">Nyilvántartások</p>
        <h1 tabIndex={-1}>Család eltávolítása</h1>
      </header>
      <AsyncStatePanel
        result={result}
        testId="admin-family-remove-state"
        emptyMessage="A család nem található."
      >
        {(record) =>
          record.kind !== "family" ? (
            <p role="status" data-testid="admin-family-remove-not-family">
              Ez az elem nem család.
            </p>
          ) : (
            <AsyncStatePanel
              result={preview}
              testId="admin-family-remove-preview"
              emptyMessage="A család nem található."
            >
              {(data) => {
                if (data.refusal === "VERSION_CONFLICT") {
                  return (
                    <div className="admin-detail-grid">
                      <p
                        className="admin-action-state"
                        role="status"
                        data-testid="admin-family-remove-done"
                      >
                        Ez a család már el lett távolítva.
                      </p>
                      <Link
                        className="admin-back-link"
                        href={`/admin/nyilvantartasok/${id}/eltavolitas/eredmeny`}
                      >
                        Intézendő tételek megtekintése
                      </Link>
                    </div>
                  );
                }
                return (
                  <div className="admin-detail-grid">
                    <section data-testid="admin-family-remove-summary">
                      <h2>{record.title} eltávolítása</h2>
                      {data.refusal ? (
                        <p
                          className="admin-action-state admin-action-state-conflict"
                          role="alert"
                          data-testid="admin-family-remove-refusal"
                        >
                          {DIRECTORY_REFUSAL_MESSAGES[data.refusal]}
                        </p>
                      ) : (
                        <>
                          <RemovalConsequences kind="family" />
                          <RemovalCounts preview={data} />
                          <RemovalGroupsWarning groups={data.groupsLeftWithoutCoordinator} />
                        </>
                      )}
                    </section>
                    {!data.refusal && (
                      <RemovalForm
                        action={archiveRecordAction}
                        submitLabel="Család eltávolítása"
                        testId="admin-family-remove-form"
                        cancelHref={`/admin/nyilvantartasok/${id}`}
                      >
                        <input type="hidden" name="id" value={record.id} />
                        <input type="hidden" name="kind" value="family" />
                        <input type="hidden" name="expectedVersion" value={data.version} />
                        <input
                          type="hidden"
                          name="idempotencyKey"
                          value={`remove:${record.id.slice(0, 8)}:${randomUUID()}`}
                        />
                      </RemovalForm>
                    )}
                  </div>
                );
              }}
            </AsyncStatePanel>
          )
        }
      </AsyncStatePanel>
    </section>
  );
}
