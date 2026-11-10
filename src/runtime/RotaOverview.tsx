import type {
  ApplicationResult,
  RotaDutyCardModel,
  RotaOverviewItem,
  RotaOverviewModel,
} from "../application/index.ts";
import {
  formatLongDay,
  formatWeekRange,
  INDOOR_CLEANING_CARD_TEXT,
  weekdayName,
  weekPhase,
} from "../application/rota-format.ts";
import { StatusBadge } from "./StatusBadge.tsx";

type Base = Readonly<{
  /** The link target of a week held by the caller's own family; the teacher's overview has none. */
  cardHref: (dutyId: string) => string;
  today: string;
  /** The family filter value from the address: empty, `sajat` or a family id. */
  filter?: string;
  /** The address the filter form sends to. */
  action: string;
}>;

const ICON = (icon: "calendar" | "clock" | "pause" | "arrow" | "warning") => ({
  icon,
  character: "",
});

function RotaState({ result }: Readonly<{ result: ApplicationResult<unknown> }>) {
  const refused = result.state === "denied" || result.state === "invalidated";
  return (
    <section
      className="parent-state"
      role="alert"
      data-testid={refused ? "rota-denied" : "rota-error"}
    >
      <h2>{refused ? "Nincs jogosultság" : "Hiba történt"}</h2>
      <p>
        {refused
          ? "A kért tartalom nem érhető el."
          : "A beosztás most nem tölthető be. Próbálja meg később."}
      </p>
    </section>
  );
}

function PhaseBadge({ weekStart, today }: Readonly<{ weekStart: string; today: string }>) {
  const phase = weekPhase(weekStart, today);
  if (phase === "other") return null;
  return (
    <StatusBadge
      className="parent-rota-phase"
      label={phase === "current" ? "Ez a hét" : "Következő hét"}
      symbol={ICON("clock")}
    />
  );
}

function matches(item: RotaOverviewItem, filter: string): boolean {
  if (!filter) return true;
  if (filter === "sajat") return item.isOwn;
  return item.familyId === filter;
}

function WeekCard({ item, today, cardHref }: Readonly<{ item: RotaOverviewItem } & Base>) {
  const body = item.isBreak ? (
    <>
      <p className="parent-rota-job">Tanítás nélküli hét</p>
      <p className="parent-rota-family">Nincs kijelölt család erre a hétre.</p>
    </>
  ) : (
    <>
      <p className="parent-rota-job">Benti takarítás</p>
      <p className="parent-rota-family">
        {item.familyDisplayName ?? "Nincs kijelölt család"}
        {item.isOwn && <strong className="parent-rota-own"> Ti</strong>}
      </p>
    </>
  );
  return (
    <li
      className={`parent-rota-week${item.isOwn ? " parent-rota-week-own" : ""}${item.isBreak ? " parent-rota-week-break" : ""}`}
      data-testid={`rota-week-${item.weekStart}`}
    >
      <p className="parent-rota-dates">
        <strong>{formatWeekRange(item.weekStart)}</strong>
        {item.isBreak ? (
          <StatusBadge className="parent-rota-phase" label="Szünet" symbol={ICON("pause")} />
        ) : (
          <PhaseBadge weekStart={item.weekStart} today={today} />
        )}
      </p>
      {body}
      {item.isOwn && item.dutyId && !item.isBreak && (
        <a className="button-link" href={cardHref(item.dutyId)}>
          Feladatlap megnyitása
        </a>
      )}
    </li>
  );
}

function WeekTable({
  items,
  today,
  cardHref,
}: Readonly<{ items: readonly RotaOverviewItem[]; today: string; cardHref: Base["cardHref"] }>) {
  return (
    <div className="parent-rota-table-wrapper">
      <table className="parent-rota-table" data-testid="rota-table">
        <caption>Benti takarítás hetekre bontva</caption>
        <thead>
          <tr>
            <th scope="col">Hét</th>
            <th scope="col">Család</th>
            <th scope="col">Állapot</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.weekStart}
              className={item.isOwn ? "parent-rota-row-own" : undefined}
              data-testid={`rota-row-${item.weekStart}`}
            >
              <th scope="row">{formatWeekRange(item.weekStart)}</th>
              <td>
                {item.isBreak ? (
                  "Nincs teendő"
                ) : item.isOwn && item.dutyId ? (
                  <a href={cardHref(item.dutyId)}>
                    <strong>{item.familyDisplayName} (Ti)</strong>
                  </a>
                ) : (
                  (item.familyDisplayName ?? "Nincs kijelölt család")
                )}
              </td>
              <td>
                {item.isBreak ? (
                  <StatusBadge label="Szünet" symbol={ICON("pause")} />
                ) : (
                  <PhaseBadge weekStart={item.weekStart} today={today} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Filter({
  items,
  filter,
  action,
}: Readonly<{ items: readonly RotaOverviewItem[]; filter: string; action: string }>) {
  const families = new Map<string, string>();
  for (const item of items)
    if (item.familyId && item.familyDisplayName)
      families.set(item.familyId, item.familyDisplayName);
  const hasOwn = items.some((item) => item.isOwn);
  return (
    <form className="parent-filter" action={action} data-testid="rota-filter-form">
      <div className="filter-field">
        <label htmlFor="csalad">Család</label>
        <select id="csalad" name="csalad" defaultValue={filter} data-testid="rota-filter-select">
          <option value="">Minden család</option>
          {hasOwn && <option value="sajat">Saját családom</option>}
          {[...families.entries()]
            .toSorted((a, b) => a[1].localeCompare(b[1], "hu"))
            .map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
        </select>
      </div>
      <div className="filter-actions">
        <button type="submit" data-testid="rota-filter-submit-button">
          Szűrés
        </button>
      </div>
    </form>
  );
}

/**
 * The published rota as every signed-in role reads it (W6). Phone: week cards; computer: a table. While nothing is
 * published it says so; a refused or failed read shows the denied or error state, never the empty one.
 */
export function RotaOverview({
  result,
  today,
  filter = "",
  action,
  cardHref,
}: Readonly<{ result: ApplicationResult<RotaOverviewModel> } & Base>) {
  const model: RotaOverviewModel | undefined =
    result.state === "success" || result.state === "recovery" ? result.data : undefined;
  return (
    <section className="parent-page parent-rota-page" data-testid="rota-overview-page">
      <header>
        <p className="eyebrow">Takarítás{model?.schoolYear ? ` · ${model.schoolYear.name}` : ""}</p>
        <h1 tabIndex={-1} autoFocus>
          Beosztás
        </h1>
        <p>A benti takarítás családonkénti heti rendje.</p>
      </header>
      {!model && <RotaState result={result} />}
      {model && model.overviewState === "nothing_published" && (
        <p className="parent-empty" role="status" data-testid="rota-empty">
          Még nincs közzétett beosztás.
        </p>
      )}
      {model && model.overviewState === "published" && (
        <RotaWeeks
          model={model}
          today={today}
          filter={filter}
          action={action}
          cardHref={cardHref}
        />
      )}
    </section>
  );
}

function RotaWeeks({
  model,
  today,
  filter,
  action,
  cardHref,
}: Readonly<{ model: RotaOverviewModel } & Base>) {
  const shown = model.items.filter((item) => matches(item, filter ?? ""));
  return (
    <>
      <Filter items={model.items} filter={filter ?? ""} action={action} />
      {shown.length === 0 ? (
        <p className="parent-empty" role="status" data-testid="rota-filter-empty">
          Nincs találat.
        </p>
      ) : (
        <>
          <ul className="parent-rota-list" data-testid="rota-week-list">
            {shown.map((item) => (
              <WeekCard
                key={item.weekStart}
                item={item}
                today={today}
                cardHref={cardHref}
                action={action}
              />
            ))}
          </ul>
          <WeekTable items={shown} today={today} cardHref={cardHref} />
        </>
      )}
    </>
  );
}

/** The duty card of one indoor-cleaning week (W7): family, week, fixed text, no fixed day, break warning. */
export function RotaDutyCard({
  result,
  backHref,
}: Readonly<{ result: ApplicationResult<RotaDutyCardModel>; backHref: string }>) {
  const card = result.state === "success" || result.state === "recovery" ? result.data : undefined;
  return (
    <section className="parent-page parent-rota-card-page" data-testid="rota-card-page">
      <a className="parent-back-link" href={backHref}>
        ← Vissza a beosztáshoz
      </a>
      {!card && <RotaState result={result} />}
      {card && (
        <>
          <header className="parent-detail-header">
            <p className="eyebrow">{INDOOR_CLEANING_CARD_TEXT.jobLabel}</p>
            <h1 tabIndex={-1} autoFocus>
              {card.title}
            </h1>
            <p>{INDOOR_CLEANING_CARD_TEXT.instruction}</p>
          </header>
          <dl className="parent-detail-grid" data-testid="rota-card-details">
            <div>
              <dt>Család</dt>
              <dd>{card.familyDisplayName}</dd>
            </div>
            <div>
              <dt>Hét</dt>
              <dd>
                {formatLongDay(card.weekStart)} ({weekdayName(card.weekStart)}) –{" "}
                {formatLongDay(card.weekEnd)} ({weekdayName(card.weekEnd)})
              </dd>
            </div>
          </dl>
          {card.isBreakWeek && (
            <p
              className="parent-notice parent-rota-warning"
              role="alert"
              data-testid="rota-card-break"
            >
              {INDOOR_CLEANING_CARD_TEXT.breakWarning}
            </p>
          )}
          <p className="parent-notice" data-testid="rota-card-no-fixed-day">
            {INDOOR_CLEANING_CARD_TEXT.noFixedDay}
          </p>
        </>
      )}
    </section>
  );
}
