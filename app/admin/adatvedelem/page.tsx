import { AdminAccessState } from "../_components/AdminAccessState.tsx";
import { AdminMutationForm } from "../_components/AdminMutationForm.tsx";
import { runLifecycleAction } from "../advanced-actions.ts";
import { resolveAdminFacade } from "../_lib/facade.ts";
import { resolveAdminSession } from "../_lib/session.ts";

export default async function PrivacyLifecyclePage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ eligibility?: string }> }>) {
  const [session, facade, query] = await Promise.all([
    resolveAdminSession(),
    resolveAdminFacade(),
    searchParams,
  ]);
  if (session.state !== "success" || !facade) return <AdminAccessState kind="denied" />;
  const result = await facade.lifecycle.list(session.data.applicationSession, session.data.scope, {
    eligibility: query.eligibility,
  });
  if (result.state === "denied" || result.state === "invalidated")
    return <AdminAccessState kind="denied" />;
  return (
    <section className="admin-page" data-testid="admin-lifecycle-page">
      <header>
        <p className="eyebrow">Adminisztráció · adatvédelem</p>
        <h1 tabIndex={-1} autoFocus>
          Adat-életciklus
        </h1>
        <p>A jogosultság és a megőrzési feltételek minden futtatáskor újraellenőrződnek.</p>
      </header>
      {result.state === "success" ? (
        <ul className="advanced-collection" data-testid="admin-lifecycle-list">
          {result.data.candidates.map((candidate) => (
            <li
              className="advanced-panel"
              key={candidate.id}
              data-testid={`admin-lifecycle-${candidate.id}`}
            >
              <h2>{candidate.label}</h2>
              <p>
                Állapot: <strong>{candidate.eligibility}</strong>
              </p>
              {candidate.blockerSummary && (
                <p className="blocked-panel">Blokkoló: {candidate.blockerSummary}</p>
              )}
              {candidate.eligibility !== "blocked" && (
                <AdminMutationForm
                  action={runLifecycleAction}
                  submitLabel={
                    candidate.eligibility === "eligible-delete"
                      ? "Törlés végrehajtása"
                      : "Anonimizálás végrehajtása"
                  }
                  testId={`admin-lifecycle-run-${candidate.id}`}
                >
                  <label>
                    <input type="checkbox" name="confirmed" value="yes" /> Megerősítem a
                    visszafordíthatatlan következményt
                  </label>
                  <label htmlFor={`scenario-${candidate.id}`}>Forgatókönyv</label>
                  <select id={`scenario-${candidate.id}`} name="scenario" defaultValue="success">
                    <option value="success">Sikeres</option>
                    <option value="retryable">Átmeneti hiba</option>
                    <option value="terminal">Végleges hiba</option>
                  </select>
                  <input type="hidden" name="familyId" value={candidate.id} />
                  <input type="hidden" name="expectedVersion" value={candidate.version} />
                  <input
                    type="hidden"
                    name="idempotencyKey"
                    value={`lifecycle-${candidate.id}-v${candidate.version}`}
                  />
                </AdminMutationForm>
              )}
            </li>
          ))}
        </ul>
      ) : result.state === "empty" ? (
        <p>Nincs életciklus-jelölt.</p>
      ) : (
        <p role="alert">Hiba történt.</p>
      )}
    </section>
  );
}
