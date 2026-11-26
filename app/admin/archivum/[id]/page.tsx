import { randomUUID } from "node:crypto";
import Link from "next/link";
import { AdminBackLink } from "../../_components/AdminBackLink.tsx";
import { AdminMutationForm } from "../../_components/AdminMutationForm.tsx";
import { AsyncStatePanel } from "../../_components/AsyncStatePanel.tsx";
import { restoreRecordAction } from "../../actions.ts";
import { resolveAdminFacade } from "../../_lib/facade.ts";
import { resolveAdminSession } from "../../_lib/session.ts";
import { terminalFailure } from "../../../../src/application/results.ts";
import { statusDisplay } from "../../../../src/application/status-labels.ts";
import { StatusBadge } from "../../../../src/runtime/StatusBadge.tsx";

/** The name the data-lifecycle run gives an anonymised family, which can no longer be restored. */
const ANONYMIZED_FAMILY = "Anonimizált család";

/**
 * What restoring a removed family brings back and what it does not (U14, W5, BR207.1). A closed sign-in account keeps
 * its address, so a new invitation cannot go to that address today, and the words say so.
 */
function FamilyRestoreSummary({ familyId }: Readonly<{ familyId: string }>) {
  return (
    <section data-testid="admin-family-restore-summary">
      <h3>Ami visszaáll:</h3>
      <ul>
        <li>a család, a szülők és a gyermekek;</li>
        <li>a névjegyzék bejegyzése, üres elérhetőségekkel és megosztás nélkül;</li>
        <li>a megmaradt beosztási helyek újra a családé.</li>
      </ul>
      <h3>Ami nem áll vissza:</h3>
      <ul>
        <li>
          a bejelentkezések – minden szülőnek új meghívó kell (akinek volt fiókja, annak a korábbi
          e-mail-címe jelenleg nem adható meg újra);
        </li>
        <li>a csoporttagságok és koordinátori szerepek;</li>
        <li>a vállalások, cserék, értesítések és a felszabadított helyek;</li>
        <li>a törölt saját szövegek;</li>
        <li>a korábban egyenként eltávolított szülő és a neve.</li>
      </ul>
      <Link
        className="admin-back-link"
        href={`/admin/nyilvantartasok/${familyId}/eltavolitas/eredmeny`}
      >
        Intézendő tételek megtekintése
      </Link>
    </section>
  );
}

export default async function ArchiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await resolveAdminSession();
  const facade = await resolveAdminFacade();
  const result =
    session.state === "success" && facade
      ? await facade.getArchived(session.data.applicationSession, session.data.scope, id)
      : terminalFailure();
  // Restoring a working group is a super admin's (BR2.5).
  const canRestore = session.state === "success" && session.data.groupIds.length === 0;
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
            {canRestore &&
              record.kind === "family" &&
              record.state === "archived" &&
              record.title !== ANONYMIZED_FAMILY && <FamilyRestoreSummary familyId={record.id} />}
            {canRestore && (
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
            )}
          </>
        )}
      </AsyncStatePanel>
    </section>
  );
}
