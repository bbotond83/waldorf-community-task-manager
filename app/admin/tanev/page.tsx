import type { SchoolCalendarModel } from "../../../src/application/index.ts";
import { formatShortDay, formatWeekRange } from "../../../src/application/rota-format.ts";
import { resolveRotaFacade } from "../../_identity/rota-facade.ts";
import { AdminAccessState } from "../_components/AdminAccessState.tsx";
import { AdminMutationForm, AdminTextField } from "../_components/AdminMutationForm.tsx";
import { resolveAdminSession } from "../_lib/session.ts";
import {
  addBreakWeekAction,
  removeBreakWeekAction,
  saveSchoolYearAction,
} from "../rota-actions.ts";
import { YearSwitcher } from "../_components/RotaParts.tsx";

export default async function SchoolYearPage({
  searchParams,
}: {
  searchParams: Promise<{ tanev?: string }>;
}) {
  const [session, rota, { tanev }] = await Promise.all([
    resolveAdminSession(),
    resolveRotaFacade(),
    searchParams,
  ]);
  if (session.state !== "success" || !rota) return <AdminAccessState kind="denied" embedded />;
  const result = await rota.getCalendar(
    session.data.applicationSession,
    session.data.scope,
    tanev || undefined,
  );
  if (result.state === "denied" || result.state === "invalidated") {
    return <AdminAccessState kind="denied" embedded />;
  }
  if (result.state !== "success" && result.state !== "recovery") {
    return (
      <section className="admin-page" data-testid="admin-school-year-page">
        <header>
          <p className="eyebrow">Adminisztráció</p>
          <h1 tabIndex={-1}>Tanév</h1>
        </header>
        <div className="admin-rota-state" role="alert" data-testid="admin-school-year-error">
          <h2>Hiba történt</h2>
          <p>A tanév adatai most nem tölthetők be. Próbálja meg később.</p>
        </div>
      </section>
    );
  }
  return <SchoolYearScreen model={result.data} />;
}

function SchoolYearScreen({ model }: Readonly<{ model: SchoolCalendarModel }>) {
  const year = model.schoolYear;
  return (
    <section className="admin-page admin-rota-page" data-testid="admin-school-year-page">
      <header>
        <p className="eyebrow">Adminisztráció</p>
        <h1 tabIndex={-1} autoFocus>
          Tanév
        </h1>
        <p>
          A tanév időszaka, az évváltás napja és a szünetek. A beosztás ezek alapján számolja a
          tanítási heteket.
        </p>
      </header>
      {!year && (
        <p className="parent-empty" role="status" data-testid="admin-school-year-empty">
          Még nincs tanév. Vegyen fel egyet a Nyilvántartások oldalon.
        </p>
      )}
      {year && (
        <>
          <YearSwitcher years={model.schoolYears} selectedId={year.id} action="/admin/tanev" />
          {model.warnings.length > 0 && (
            <section
              className="admin-rota-warning"
              role="alert"
              data-testid="admin-school-year-warnings"
            >
              <h2>Ütközés a beosztásban</h2>
              <ul>
                {model.warnings.map((warning) => (
                  <li key={warning.weekStart}>
                    {formatWeekRange(warning.weekStart)} szünet, de a(z) {warning.familyDisplayName}{" "}
                    beosztása szerepel rajta.
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="admin-rota-grid">
            <section className="admin-rota-panel" data-testid="admin-school-year-form-panel">
              <h2>Tanév adatai</h2>
              <AdminMutationForm
                action={saveSchoolYearAction}
                submitLabel="Tanév mentése"
                testId="admin-school-year-form"
                longForm
              >
                <input type="hidden" name="id" value={year.id} />
                <input type="hidden" name="expectedVersion" value={year.version ?? 1} />
                <input type="hidden" name="idempotencyKey" value={`year:${year.id}`} />
                <AdminTextField
                  id="name"
                  name="name"
                  label="Tanév megnevezése"
                  defaultValue={year.name}
                  required
                  maxLength={100}
                  testId="admin-school-year-name"
                />
                <AdminTextField
                  id="startsOn"
                  name="startsOn"
                  type="date"
                  label="Tanév kezdete"
                  defaultValue={year.startsOn}
                  required
                  testId="admin-school-year-starts"
                />
                <AdminTextField
                  id="endsOn"
                  name="endsOn"
                  type="date"
                  label="Tanév vége"
                  defaultValue={year.endsOn}
                  required
                  testId="admin-school-year-ends"
                />
                <AdminTextField
                  id="changeoverDate"
                  name="changeoverDate"
                  type="date"
                  label="Évváltás napja"
                  defaultValue={year.changeoverDate}
                  hint="Nem lehet a tanév kezdete előtt. Ha nem módosítja, július 1. marad."
                  testId="admin-school-year-changeover"
                />
              </AdminMutationForm>
              {model.hasPlan && (
                <p className="form-hint" data-testid="admin-school-year-plan-note">
                  A tanévhez már van beosztás, ezért a tanév kezdete és vége addig nem módosítható,
                  amíg a tervezetet el nem veti.
                </p>
              )}
            </section>
            <BreakWeeks model={model} schoolYearId={year.id} />
          </div>
          <WeekTable model={model} />
        </>
      )}
    </section>
  );
}

function BreakWeeks({
  model,
  schoolYearId,
}: Readonly<{ model: SchoolCalendarModel; schoolYearId: string }>) {
  const breaks = model.weeks.filter((week) => week.isBreak);
  return (
    <section className="admin-rota-panel" data-testid="admin-break-weeks">
      <h2>Szünetek</h2>
      {breaks.length === 0 ? (
        <p data-testid="admin-break-weeks-empty">Nincs szünet felvéve.</p>
      ) : (
        <ul className="admin-rota-breaks">
          {breaks.map((week) => (
            <li key={week.weekStart} data-testid={`admin-break-week-${week.weekStart}`}>
              <div>
                <strong>{formatWeekRange(week.weekStart)}</strong>
                {week.label && <span className="form-hint"> {week.label}</span>}
              </div>
              {week.breakWeekId && (
                <AdminMutationForm
                  action={removeBreakWeekAction}
                  submitLabel="Törlés"
                  testId={`admin-break-remove-${week.weekStart}`}
                >
                  <input type="hidden" name="breakWeekId" value={week.breakWeekId} />
                  <input type="hidden" name="expectedVersion" value={week.version ?? 1} />
                  <input
                    type="hidden"
                    name="idempotencyKey"
                    value={`bw-remove:${week.breakWeekId}:v${week.version ?? 1}`}
                  />
                </AdminMutationForm>
              )}
            </li>
          ))}
        </ul>
      )}
      <h3>Szünet hozzáadása</h3>
      <AdminMutationForm
        action={addBreakWeekAction}
        submitLabel="Hozzáadás"
        testId="admin-break-add-form"
        longForm
        clearOnSuccess
      >
        <input type="hidden" name="schoolYearId" value={schoolYearId} />
        <input type="hidden" name="idempotencyKey" value="bw-add:new" />
        <AdminTextField
          id="weekStart"
          name="weekStart"
          type="date"
          label="Hétfői kezdőnap"
          hint="Csak hétfő választható."
          required
          testId="admin-break-add-start"
        />
        <AdminTextField
          id="label"
          name="label"
          label="Szünet megnevezése (nem kötelező)"
          maxLength={100}
          testId="admin-break-add-label"
        />
      </AdminMutationForm>
    </section>
  );
}

function WeekTable({ model }: Readonly<{ model: SchoolCalendarModel }>) {
  return (
    <section className="admin-rota-panel" data-testid="admin-school-weeks">
      <h2>Tanítási hetek</h2>
      <p className="form-hint">Összesen: {model.weeks.length} hét.</p>
      <div className="admin-rota-table-wrapper">
        <table className="admin-rota-table">
          <thead>
            <tr>
              <th scope="col">Hét</th>
              <th scope="col">Hétfő</th>
              <th scope="col">Jelleg</th>
            </tr>
          </thead>
          <tbody>
            {model.weeks.map((week, index) => (
              <tr
                key={week.weekStart}
                className={week.isBreak ? "admin-rota-row-break" : undefined}
                data-testid={`admin-school-week-${week.weekStart}`}
              >
                <td>{index + 1}. hét</td>
                <td>{formatShortDay(week.weekStart)}</td>
                <td>
                  {week.isBreak ? `Szünet${week.label ? `: ${week.label}` : ""}` : "Tanítási hét"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
