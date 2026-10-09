import { AsyncStatePanel } from "../_components/AsyncStatePanel.tsx";
import { ResponsiveCollection } from "../_components/ResponsiveCollection.tsx";
import { resolveAdminFacade } from "../_lib/facade.ts";
import { resolveAdminSession } from "../_lib/session.ts";
import { terminalFailure } from "../../../src/application/results.ts";

export default async function ArchivePage() {
  const session = await resolveAdminSession();
  const facade = await resolveAdminFacade();
  const result =
    session.state === "success" && facade
      ? await facade.listRecords(session.data.applicationSession, session.data.scope, {
          state: "archived",
        })
      : terminalFailure();
  return (
    <section className="admin-page" data-testid="admin-archive-page">
      <header>
        <p className="eyebrow">Adminisztráció</p>
        <h1 tabIndex={-1}>Archívum</h1>
      </header>
      <AsyncStatePanel
        result={result}
        testId="admin-archive-state"
        emptyMessage="Nincs archivált elem."
      >
        {(data) => (
          <ResponsiveCollection
            items={data.items}
            basePath="/admin/archivum"
            testId="admin-archive-list"
          />
        )}
      </AsyncStatePanel>
    </section>
  );
}
