import { AdminAccessState } from "../_components/AdminAccessState.tsx";
import { AdminMutationForm } from "../_components/AdminMutationForm.tsx";
import { retryReminderAction } from "../advanced-actions.ts";
import { resolveAdminFacade } from "../_lib/facade.ts";
import { resolveAdminSession } from "../_lib/session.ts";

export default async function ReminderMonitorPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ status?: string }> }>) {
  const [session, facade, query] = await Promise.all([
    resolveAdminSession(),
    resolveAdminFacade(),
    searchParams,
  ]);
  if (session.state !== "success" || !facade) return <AdminAccessState kind="denied" />;
  const result = await facade.reminders.list(session.data.applicationSession, session.data.scope, {
    status: query.status,
  });
  if (result.state === "denied" || result.state === "invalidated")
    return <AdminAccessState kind="denied" />;
  return (
    <section className="admin-page" data-testid="admin-reminder-page">
      <header>
        <p className="eyebrow">Adminisztráció · szimulált szolgáltató</p>
        <h1 tabIndex={-1} autoFocus>
          Emlékeztetők felügyelete
        </h1>
        <p>
          Csak állapot, kísérletszám és adatvédelmi szempontból szűkített címzetti összesítő jelenik
          meg.
        </p>
      </header>
      <form className="advanced-filter" method="get" data-testid="admin-reminder-filter">
        <label htmlFor="status">Állapot</label>
        <select id="status" name="status" defaultValue={query.status ?? ""}>
          <option value="">Mind</option>
          <option value="retryable">Újrapróbálható</option>
          <option value="sent">Elküldve</option>
          <option value="stale">Elavult</option>
        </select>
        <button type="submit" data-testid="admin-reminder-filter-submit">
          Szűrés
        </button>
      </form>
      {result.state === "empty" ? (
        <p>Nincs a szűrésnek megfelelő feladat.</p>
      ) : result.state === "success" ? (
        <ul className="advanced-collection" data-testid="admin-reminder-list">
          {result.data.jobs.map((job) => (
            <li className="advanced-panel" key={job.id} data-testid={`admin-reminder-${job.id}`}>
              <h2>{job.title}</h2>
              <dl className="advanced-details">
                <div>
                  <dt>Állapot</dt>
                  <dd>{job.status}</dd>
                </div>
                <div>
                  <dt>Kísérlet</dt>
                  <dd>{job.attempt}</dd>
                </div>
                <div>
                  <dt>Korreláció</dt>
                  <dd>{job.correlationId}</dd>
                </div>
                <div>
                  <dt>Címzettek</dt>
                  <dd>{job.recipientSummary}</dd>
                </div>
              </dl>
              <p className="synthetic-label">
                {job.providerLabel}; valódi szolgáltatói kézbesítés: OUTSTANDING.
              </p>
              {job.status === "retryable" && (
                <AdminMutationForm
                  action={retryReminderAction}
                  submitLabel="Újrapróbálás"
                  testId={`admin-reminder-retry-${job.id}`}
                >
                  <input type="hidden" name="jobId" value={job.id} />
                  <input type="hidden" name="expectedVersion" value={job.version} />
                  <input type="hidden" name="correlationId" value={job.correlationId} />
                </AdminMutationForm>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p role="alert">Hiba történt.</p>
      )}
    </section>
  );
}
