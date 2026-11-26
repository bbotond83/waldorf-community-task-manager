import { randomUUID } from "node:crypto";
import Link from "next/link";
import { terminalFailure } from "../../../../../../../src/application/results.ts";
import { DIRECTORY_REFUSAL_MESSAGES } from "../../../../../../../src/data/copy.ts";
import { AsyncStatePanel } from "../../../../../_components/AsyncStatePanel.tsx";
import { RemovalForm } from "../../../../../_components/RemovalForm.tsx";
import {
  RemovalConsequences,
  RemovalCounts,
  RemovalGroupsWarning,
} from "../../../../../_components/RemovalPreview.tsx";
import { resolveAdminFacade } from "../../../../../_lib/facade.ts";
import { readRemovalPreview } from "../../../../../_lib/removal-reads.ts";
import { resolveAdminSession } from "../../../../../_lib/session.ts";
import { removeParentAction } from "../../../../../parent-actions.ts";

/**
 * The confirmation before a parent is removed (US3.6, W7; U14 W1 and W6). It names the parent, says what happens and
 * how many records it touches; the only parent of a family gets the refusal and the way to remove the family instead
 * of a button.
 */
export default async function RemoveParentPage({
  params,
}: {
  params: Promise<{ id: string; parentId: string }>;
}) {
  const { id, parentId } = await params;
  const session = await resolveAdminSession();
  const facade = await resolveAdminFacade();
  const result =
    session.state === "success" && facade
      ? await facade.getRecord(session.data.applicationSession, session.data.scope, "record", id)
      : terminalFailure();
  const preview = await readRemovalPreview({ kind: "parent", id: parentId });
  return (
    <section className="admin-page" data-testid="admin-parent-remove-page">
      <header>
        <Link className="admin-back-link" href={`/admin/nyilvantartasok/${id}`}>
          Vissza a családhoz
        </Link>
        <p className="eyebrow">Nyilvántartások</p>
        <h1 tabIndex={-1}>Szülő eltávolítása</h1>
      </header>
      <AsyncStatePanel
        result={result}
        testId="admin-parent-remove-state"
        emptyMessage="A család nem található."
      >
        {(record) => {
          const parents = record.details?.parents ?? [];
          const parent = parents.find((entry) => entry.id === parentId);
          if (!parent) {
            return (
              <p role="status" data-testid="admin-parent-remove-missing">
                Ez a szülő már nem szerepel a családban.
              </p>
            );
          }
          if (parents.length <= 1) {
            return (
              <section
                className="admin-action-state admin-action-state-conflict"
                role="alert"
                data-testid="admin-parent-remove-last"
              >
                <h2>{parent.displayName} a család egyetlen szülője</h2>
                <p>
                  Az utolsó szülő nem távolítható el. Ha az egész családot el szeretnéd távolítani,
                  távolítsd el a családot.
                </p>
                <Link className="admin-back-link" href={`/admin/nyilvantartasok/${id}/eltavolitas`}>
                  Család eltávolítása
                </Link>
              </section>
            );
          }
          return (
            <AsyncStatePanel
              result={preview}
              testId="admin-parent-remove-preview"
              emptyMessage="A szülő nem található."
            >
              {(data) => (
                <div className="admin-detail-grid">
                  <section data-testid="admin-parent-remove-summary">
                    <h2>{parent.displayName} eltávolítása</h2>
                    {data.refusal ? (
                      <p
                        className="admin-action-state admin-action-state-conflict"
                        role="alert"
                        data-testid="admin-parent-remove-refusal"
                      >
                        {DIRECTORY_REFUSAL_MESSAGES[data.refusal]}
                      </p>
                    ) : (
                      <>
                        <RemovalConsequences kind="parent" />
                        <RemovalCounts preview={data} />
                        <RemovalGroupsWarning groups={data.groupsLeftWithoutCoordinator} />
                      </>
                    )}
                  </section>
                  {!data.refusal && (
                    <RemovalForm
                      action={removeParentAction}
                      submitLabel="Szülő eltávolítása"
                      testId="admin-parent-remove-form"
                      cancelHref={`/admin/nyilvantartasok/${id}`}
                    >
                      <input type="hidden" name="parentId" value={parent.id} />
                      <input type="hidden" name="familyId" value={id} />
                      <input type="hidden" name="expectedVersion" value={data.version} />
                      <input
                        type="hidden"
                        name="idempotencyKey"
                        value={`remove:${parent.id.slice(0, 8)}:${randomUUID()}`}
                      />
                    </RemovalForm>
                  )}
                </div>
              )}
            </AsyncStatePanel>
          );
        }}
      </AsyncStatePanel>
    </section>
  );
}
