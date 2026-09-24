import Link from "next/link";
import { AdminFilterBar } from "../_components/AdminFilterBar.tsx";
import { AdminPagination } from "../_components/AdminPagination.tsx";
import { AsyncStatePanel } from "../_components/AsyncStatePanel.tsx";
import { ResponsiveCollection } from "../_components/ResponsiveCollection.tsx";
import { resolveAdminFacade } from "../_lib/facade.ts";
import { resolveAdminSession } from "../_lib/session.ts";
import { terminalFailure } from "../../../src/application/results.ts";

export default async function TasksEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q : "";
  const state = typeof query.state === "string" ? query.state : "";
  const session = await resolveAdminSession();
  const facade = await resolveAdminFacade();
  const result =
    session.state === "success" && facade
      ? await facade.listTasks(session.data.applicationSession, session.data.scope, { q, state })
      : terminalFailure();
  return (
    <section className="admin-page" data-testid="admin-tasks-page">
      <header>
        <p className="eyebrow">Adminisztráció</p>
        <h1 tabIndex={-1}>Feladatok és események</h1>
        <p>Ütemezés és hozzárendelés a jogosult működési körben.</p>
      </header>
      <div className="admin-page-actions">
        <Link href="/admin/feladatok/uj" data-testid="admin-task-create-link">
          Új feladat vagy esemény
        </Link>
      </div>
      <AdminFilterBar action="/admin/feladatok" query={q} state={state} />
      <AsyncStatePanel
        result={result}
        testId="admin-tasks-state"
        emptyMessage="A szűrésnek nincs találata."
      >
        {(data) => (
          <>
            <ResponsiveCollection
              items={data.items}
              basePath="/admin/feladatok"
              testId="admin-tasks-list"
            />
            <AdminPagination />
          </>
        )}
      </AsyncStatePanel>
    </section>
  );
}
