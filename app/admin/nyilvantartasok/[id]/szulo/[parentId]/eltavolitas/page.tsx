import { randomUUID } from "node:crypto";
import Link from "next/link";
import { terminalFailure } from "../../../../../../../src/application/results.ts";
import { AdminMutationForm } from "../../../../../_components/AdminMutationForm.tsx";
import { AsyncStatePanel } from "../../../../../_components/AsyncStatePanel.tsx";
import { resolveAdminFacade } from "../../../../../_lib/facade.ts";
import { resolveAdminSession } from "../../../../../_lib/session.ts";
import { removeParentAction } from "../../../../../parent-actions.ts";

/**
 * The confirmation before a parent is removed (US3.6, W7). It names the parent and says what happens; the only parent
 * of a family gets the refusal and the way to the family instead of a button.
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
                  archiváld a családot a családi adatlapon.
                </p>
              </section>
            );
          }
          return (
            <div className="admin-detail-grid">
              <section data-testid="admin-parent-remove-summary">
                <h2>{parent.displayName} eltávolítása</h2>
                <p>Az eltávolítás után:</p>
                <ul>
                  <li>a szülő bejelentkezése megszűnik, és minden munkamenete véget ér;</li>
                  <li>a telefonszáma, az e-mail-címe és a megosztott adatai törlődnek;</li>
                  <li>a nyitott meghívója érvénytelenné válik;</li>
                  <li>
                    a szülő eltűnik a névsorból, a korábbi bejegyzéseknél „korábbi tag” néven
                    szerepel.
                  </li>
                </ul>
              </section>
              <AdminMutationForm
                action={removeParentAction}
                submitLabel="Szülő eltávolítása"
                testId="admin-parent-remove-form"
                successLink={{ href: `/admin/nyilvantartasok/${id}`, label: "Vissza a családhoz" }}
                longForm
              >
                <input type="hidden" name="parentId" value={parent.id} />
                <input type="hidden" name="familyId" value={id} />
                <input type="hidden" name="expectedVersion" value={parent.version} />
                <input
                  type="hidden"
                  name="idempotencyKey"
                  value={`remove:${parent.id.slice(0, 8)}:${randomUUID()}`}
                />
              </AdminMutationForm>
            </div>
          );
        }}
      </AsyncStatePanel>
    </section>
  );
}
