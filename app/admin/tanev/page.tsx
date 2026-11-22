import type {
  ApplicationResult,
  RecurringScheduleListModel,
  SchoolCalendarModel,
} from "../../../src/application/index.ts";
import { terminalFailure } from "../../../src/application/results.ts";
import {
  formatLongDay,
  formatShortDay,
  formatWeekRange,
  HOLD_REASON_TEXT,
  STANDING_LABELS,
} from "../../../src/application/rota-format.ts";
import { StatusBadge } from "../../../src/runtime/StatusBadge.tsx";
import { resolveRotaFacade } from "../../_identity/rota-facade.ts";
import { resolveRecurringFacade } from "../../_recurring/facade.ts";
import { BottleIntervalPanel } from "../../_recurring/RecurringScreens.tsx";
import { AdminAccessState } from "../_components/AdminAccessState.tsx";
import { AdminMutationForm, AdminTextField } from "../_components/AdminMutationForm.tsx";
import { resolveAdminSession } from "../_lib/session.ts";
import {
  addBreakWeekAction,
  removeBreakWeekAction,
  saveSchoolYearAction,
  setStandingAction,
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
  const [result, recurring] = await Promise.all([
    rota.getCalendar(session.data.applicationSession, session.data.scope, tanev || undefined),
    resolveRecurringFacade(),
  ]);
  // The bottle-cleaning interval is one more read; a failed one shows its own message in its own panel.
  const bottle = recurring
    ? await recurring.adminList(session.data.applicationSession, session.data.scope)
    : terminalFailure<RecurringScheduleListModel>();
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
  return <SchoolYearScreen model={result.data} bottle={bottle} />;
}

function SchoolYearScreen({
  model,
  bottle,
}: Readonly<{
  model: SchoolCalendarModel;
  bottle: ApplicationResult<RecurringScheduleListModel>;
}>) {
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
          <BottleIntervalPanel result={bottle} />
          <StandingsPanel model={model} schoolYearId={year.id} />
          <FlaggedDuties model={model} />
          <WeekTable model={model} />
        </>
      )}
    </section>
  );
}

const STANDING_ICON = { staying: "check", leaving: "arrow", new: "arrow" } as const;

/**
 * The families' standings in the year (BR60.1): who stays, who leaves after the changeover date and who joins from
 * it. A week is judged by its Monday (BR60.3). One small form per family; a family with no standing yet shows
 * Marad, which is what the database counts it as.
 */
function StandingsPanel({
  model,
  schoolYearId,
}: Readonly<{ model: SchoolCalendarModel; schoolYearId: string }>) {
  const counts = { staying: 0, leaving: 0, new: 0 };
  for (const item of model.standings) counts[item.standing] += 1;
  return (
    <section className="admin-rota-panel" data-testid="admin-standings">
      <h2>Családok helyzete</h2>
      <p className="admin-standings-summary" data-testid="admin-standings-summary">
        Összesen: {model.standings.length} család · {counts.staying} {STANDING_LABELS.staying},{" "}
        {counts.leaving} {STANDING_LABELS.leaving}, {counts.new} {STANDING_LABELS.new}
      </p>
      {model.standings.length === 0 ? (
        <p data-testid="admin-standings-empty">Nincs aktív család.</p>
      ) : (
        <div className="admin-rota-table-wrapper">
          <table className="admin-rota-table admin-standings-table">
            <thead>
              <tr>
                <th scope="col">Család</th>
                <th scope="col">Helyzet</th>
                <th scope="col">Módosítás</th>
              </tr>
            </thead>
            <tbody>
              {model.standings.map((item) => (
                <tr key={item.familyId} data-testid={`admin-standing-${item.familyId}`}>
                  <th scope="row">{item.displayName}</th>
                  <td>
                    <StatusBadge
                      className={`admin-standing-${item.standing}`}
                      label={STANDING_LABELS[item.standing]}
                      symbol={{ icon: STANDING_ICON[item.standing], character: "" }}
                    />
                  </td>
                  <td>
                    <AdminMutationForm
                      action={setStandingAction}
                      submitLabel="Mentés"
                      testId={`admin-standing-form-${item.familyId}`}
                    >
                      <input type="hidden" name="familyId" value={item.familyId} />
                      <input type="hidden" name="schoolYearId" value={schoolYearId} />
                      <input type="hidden" name="expectedVersion" value={item.version} />
                      <input
                        type="hidden"
                        name="idempotencyKey"
                        value={`standing:${item.familyId}:v${item.version}`}
                      />
                      <label className="visually-hidden" htmlFor={`standing-${item.familyId}`}>
                        Helyzet: {item.displayName}
                      </label>
                      <select
                        id={`standing-${item.familyId}`}
                        name="standing"
                        defaultValue={item.standing}
                        data-testid={`admin-standing-select-${item.familyId}`}
                      >
                        {(Object.keys(STANDING_LABELS) as (keyof typeof STANDING_LABELS)[]).map(
                          (value) => (
                            <option key={value} value={value}>
                              {STANDING_LABELS[value]}
                            </option>
                          ),
                        )}
                      </select>
                    </AdminMutationForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="admin-rota-note" data-testid="admin-standings-note">
        {model.schoolYear?.changeoverDate
          ? `Az évváltás napja: ${formatLongDay(model.schoolYear.changeoverDate)}. `
          : ""}
        Az elmenő család az évváltás napjától nem kap új feladatot; az érkező család az évváltás
        napjától kap. A beosztás a hét hétfői napja szerint veszi figyelembe.
      </p>
    </section>
  );
}

/** Duties held by a family that may not hold them on that day (BR60.5), listed so the administrator can move them. */
function FlaggedDuties({ model }: Readonly<{ model: SchoolCalendarModel }>) {
  if (model.flaggedDuties.length === 0) return null;
  return (
    <section className="admin-rota-warning" role="alert" data-testid="admin-flagged-duties">
      <h2>Átnézendő feladatok</h2>
      <p>Ezeket a feladatokat olyan család viszi, amely aznap már nem (vagy még nem) vállalhat.</p>
      <ul>
        {model.flaggedDuties.map((duty) => (
          <li key={`${duty.source}:${duty.familyId}:${duty.onDate}`}>
            {formatLongDay(duty.onDate)}: {duty.title} – {duty.familyDisplayName} (
            {HOLD_REASON_TEXT[duty.reason]})
          </li>
        ))}
      </ul>
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
