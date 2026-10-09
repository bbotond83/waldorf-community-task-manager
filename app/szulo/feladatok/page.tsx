import {
  DUTY_STATE_LABELS,
  dutyStateDisplay,
  dutyStateOptionText,
} from "../../../src/application/status-labels.ts";
import { StatusBadge } from "../../../src/runtime/StatusBadge.tsx";
import { ParentStatePanel } from "../_components/ParentStatePanel.tsx";
import { resolveParentFacade } from "../_lib/facade.ts";
import { resolveParentSession } from "../_lib/session.ts";

export default async function ParentDutiesPage({
  searchParams,
}: {
  searchParams: Promise<{ allapot?: string }>;
}) {
  const session = await resolveParentSession();
  const facade = await resolveParentFacade();
  if (session.state !== "success" || !facade) return null;
  const result = await facade.listDuties(session.data.applicationSession, {
    familyScope: session.data.familyScope,
    familyId: session.data.familyId,
  });
  const { allapot = "" } = await searchParams;

  return (
    <section className="parent-page" data-testid="parent-duties-page">
      <header>
        <p className="eyebrow">Szülői felület</p>
        <h1 tabIndex={-1} autoFocus>
          Családi feladatok
        </h1>
        <p>Csak a kapcsolt, kitalált család számára engedélyezett feladatok láthatók.</p>
      </header>
      <form className="parent-filter" action="/szulo/feladatok" data-testid="duty-filter-form">
        <div className="filter-field">
          <label htmlFor="allapot">Állapot</label>
          <select
            id="allapot"
            name="allapot"
            defaultValue={allapot}
            data-testid="duty-filter-select"
          >
            <option value="">Minden állapot</option>
            {Object.keys(DUTY_STATE_LABELS).map((value) => (
              <option key={value} value={value}>
                {dutyStateOptionText(value)}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-actions">
          <button type="submit" data-testid="duty-filter-submit-button">
            Szűrés
          </button>
        </div>
      </form>
      <ParentStatePanel result={result} emptyMessage="Nincs kapcsolt feladat." testId="duties">
        {(model) => {
          const duties = model.duties.filter((duty) => !allapot || duty.state === allapot);
          if (!duties.length) return <p data-testid="duties-filter-empty">Nincs találat.</p>;
          return (
            <ul className="parent-collection" data-testid="duty-list">
              {duties.map((duty) => (
                <li className="parent-card" key={duty.id} data-testid={`duty-card-${duty.id}`}>
                  <a
                    className="parent-card-link"
                    href={`/szulo/feladatok/${duty.id}${allapot ? `?allapot=${encodeURIComponent(allapot)}` : ""}`}
                    data-testid={`duty-open-${duty.id}`}
                  >
                    <h2>{duty.title}</h2>
                    <p>{formatBudapestDate(duty.dueAt)}</p>
                    <StatusBadge
                      as="strong"
                      className="parent-state-badge"
                      {...dutyStateDisplay(duty.state)}
                    />
                  </a>
                </li>
              ))}
            </ul>
          );
        }}
      </ParentStatePanel>
    </section>
  );
}

export function formatBudapestDate(value: string): string {
  return new Intl.DateTimeFormat("hu-HU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Budapest",
  }).format(new Date(value));
}
