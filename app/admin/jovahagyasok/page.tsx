import { AdminFilterBar } from "../_components/AdminFilterBar.tsx";
import { AdminPagination } from "../_components/AdminPagination.tsx";
import { AsyncStatePanel } from "../_components/AsyncStatePanel.tsx";
import { ResponsiveCollection } from "../_components/ResponsiveCollection.tsx";
import { resolveAdminFacade } from "../_lib/facade.ts";
import { resolveAdminSession } from "../_lib/session.ts";
import { terminalFailure } from "../../../src/application/results.ts";

export default async function ApprovalsPage({
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
      ? await facade.listApprovals(session.data.applicationSession, session.data.scope, {
          q,
          state,
        })
      : terminalFailure();
  return (
    <section className="admin-page" data-testid="admin-approvals-page">
      <header>
        <p className="eyebrow">Adminisztráció</p>
        <h1 tabIndex={-1}>Jóváhagyások</h1>
        <p>
          A jogosult működési kör kérelmei. A védett indokok csak külön mezőengedéllyel jelennének
          meg.
        </p>
      </header>
      <AdminFilterBar action="/admin/jovahagyasok" query={q} state={state} />
      <AsyncStatePanel
        result={result}
        testId="admin-approvals-state"
        emptyMessage="Nincs a szűrésnek megfelelő kérelem."
      >
        {(data) => (
          <>
            <ResponsiveCollection
              items={data.items}
              basePath="/admin/jovahagyasok"
              testId="admin-approvals-list"
            />
            <AdminPagination />
          </>
        )}
      </AsyncStatePanel>
    </section>
  );
}
