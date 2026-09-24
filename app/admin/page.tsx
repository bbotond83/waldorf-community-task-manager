import { AsyncStatePanel } from "./_components/AsyncStatePanel.tsx";
import { resolveAdminFacade } from "./_lib/facade.ts";
import { resolveAdminSession } from "./_lib/session.ts";
import { terminalFailure } from "../../src/application/results.ts";

export default async function AdminDashboardPage() {
  const session = await resolveAdminSession();
  const facade = await resolveAdminFacade();
  if (session.state !== "success" || !facade) {
    return (
      <section className="admin-page admin-state">
        <h1>Hiba történt</h1>
        <p>Az adminisztráció nem tölthető be.</p>
      </section>
    );
  }
  const { applicationSession, scope } = session.data;
  const [dashboard, records, tasks, approvals] = await Promise.all([
    facade.getDashboard(applicationSession, scope),
    facade.listRecords(applicationSession, scope),
    facade.listTasks(applicationSession, scope),
    facade.listApprovals(applicationSession, scope),
  ]).catch(
    () => [terminalFailure(), terminalFailure(), terminalFailure(), terminalFailure()] as const,
  );

  return (
    <section className="admin-page" data-testid="admin-dashboard-page">
      <header>
        <p className="eyebrow">Adminisztráció</p>
        <h1 tabIndex={-1} autoFocus>
          Áttekintés
        </h1>
        <p>A kijelölt működési kör összefoglalója.</p>
      </header>
      <div className="admin-dashboard-grid">
        <DashboardPanel title="Nyitott jóváhagyások" testId="admin-dashboard-approvals">
          <AsyncStatePanel
            result={dashboard}
            testId="admin-dashboard-summary"
            emptyMessage="Nincs összesítő adat."
          >
            {(data) => <strong>{data.openApprovals}</strong>}
          </AsyncStatePanel>
        </DashboardPanel>
        <DashboardPanel title="Nyilvántartások" testId="admin-dashboard-records">
          <AsyncStatePanel
            result={records}
            testId="admin-dashboard-records-state"
            emptyMessage="Nincs nyilvántartás."
          >
            {(data) => <strong>{data.items.length}</strong>}
          </AsyncStatePanel>
        </DashboardPanel>
        <DashboardPanel title="Feladatok és események" testId="admin-dashboard-tasks">
          <AsyncStatePanel
            result={tasks}
            testId="admin-dashboard-tasks-state"
            emptyMessage="Nincs feladat vagy esemény."
          >
            {(data) => <strong>{data.items.length}</strong>}
          </AsyncStatePanel>
        </DashboardPanel>
        <DashboardPanel title="Függőben lévő kérelmek" testId="admin-dashboard-queue">
          <AsyncStatePanel
            result={approvals}
            testId="admin-dashboard-queue-state"
            emptyMessage="Nincs függőben lévő kérelem."
          >
            {(data) => (
              <strong>{data.items.filter((item) => item.state === "pending").length}</strong>
            )}
          </AsyncStatePanel>
        </DashboardPanel>
      </div>
    </section>
  );
}

function DashboardPanel({
  title,
  testId,
  children,
}: Readonly<{ title: string; testId: string; children: React.ReactNode }>) {
  return (
    <section className="admin-dashboard-panel" data-testid={testId}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
