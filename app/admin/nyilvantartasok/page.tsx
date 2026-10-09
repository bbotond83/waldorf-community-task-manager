import Link from "next/link";
import { AdminFilterBar } from "../_components/AdminFilterBar.tsx";
import { listReturnQuery } from "../_components/AdminBackLink.tsx";
import { resolveListStatus } from "../../../src/application/status-labels.ts";
import { AdminPagination } from "../_components/AdminPagination.tsx";
import { AsyncStatePanel } from "../_components/AsyncStatePanel.tsx";
import { ResponsiveCollection } from "../_components/ResponsiveCollection.tsx";
import { resolveAdminFacade } from "../_lib/facade.ts";
import { resolveAdminSession } from "../_lib/session.ts";
import { terminalFailure } from "../../../src/application/results.ts";

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q : "";
  const { state, unknown } = resolveListStatus(
    "records",
    typeof query.state === "string" ? query.state : "",
  );
  const session = await resolveAdminSession();
  const facade = await resolveAdminFacade();
  const result =
    session.state === "success" && facade
      ? await facade.listRecords(session.data.applicationSession, session.data.scope, { q, state })
      : terminalFailure();
  return (
    <section className="admin-page" data-testid="admin-records-page">
      <header>
        <p className="eyebrow">Adminisztráció</p>
        <h1 tabIndex={-1}>Nyilvántartások</h1>
        <p>Családok, gyermekek, csoportok és nevelési évek a jogosult működési körben.</p>
      </header>
      <div className="admin-page-actions">
        <Link
          href="/admin/nyilvantartasok/uj"
          className="button-link"
          data-testid="admin-records-create-link"
        >
          Új elem
        </Link>
      </div>
      <AdminFilterBar
        action="/admin/nyilvantartasok"
        list="records"
        query={q}
        state={state}
        unknownState={unknown}
      />
      <AsyncStatePanel
        result={result}
        testId="admin-records-state"
        emptyMessage="A szűrésnek nincs találata."
      >
        {(data) => (
          <>
            <ResponsiveCollection
              items={data.items}
              basePath="/admin/nyilvantartasok"
              testId="admin-records-list"
              returnQuery={listReturnQuery({ q, state })}
            />
            <AdminPagination />
          </>
        )}
      </AsyncStatePanel>
    </section>
  );
}
