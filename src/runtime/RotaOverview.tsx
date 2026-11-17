import type { ReactNode } from "react";
import type {
  ApplicationResult,
  RotaDutyCardModel,
  RotaJob,
  RotaOverviewItem,
  RotaOverviewModel,
  WeekendOverviewItem,
  WeekendOwnPickModel,
} from "../application/index.ts";
import {
  DUTY_CARD_TEXT,
  formatLongDay,
  formatWeekRange,
  INDOOR_CLEANING_CARD_TEXT,
  PICK_STATE_TEXT,
  ROTA_JOB_LABELS,
  WEEKEND_PICKER_TEXT,
  WEEKEND_SLOT_LABELS,
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

/** The jobs in the order the screens list them. */
const JOBS = Object.keys(ROTA_JOB_LABELS) as RotaJob[];

/** The indoor cleaning keeps the names the first rota screen gave it; the other rotas add their job to them. */
function testPrefix(job: RotaJob): string {
  return job === "indoor_cleaning" ? "rota" : `rota-${job}`;
}

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

function matches(item: { isOwn: boolean; familyId?: string }, filter: string): boolean {
  if (!filter) return true;
  if (filter === "sajat") return item.isOwn;
  return item.familyId === filter;
}

function WeekCard({
  item,
  today,
  cardHref,
}: Readonly<{ item: RotaOverviewItem; today: string; cardHref: Base["cardHref"] }>) {
  const body = item.isBreak ? (
    <>
      <p className="parent-rota-job">Tanítás nélküli hét</p>
      <p className="parent-rota-family">Nincs kijelölt család erre a hétre.</p>
    </>
  ) : (
    <>
      <p className="parent-rota-job">
        {item.job === "indoor_cleaning" ? "Benti takarítás" : ROTA_JOB_LABELS[item.job]}
      </p>
      <p className="parent-rota-family">
        {item.familyDisplayName ?? "Nincs kijelölt család"}
        {item.isOwn && <strong className="parent-rota-own"> Ti</strong>}
      </p>
    </>
  );
  return (
    <li
      className={`parent-rota-week${item.isOwn ? " parent-rota-week-own" : ""}${item.isBreak ? " parent-rota-week-break" : ""}`}
      data-testid={`${testPrefix(item.job)}-week-${item.weekStart}`}
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
  job,
  items,
  today,
  cardHref,
}: Readonly<{
  job: RotaJob;
  items: readonly RotaOverviewItem[];
  today: string;
  cardHref: Base["cardHref"];
}>) {
  return (
    <div className="parent-rota-table-wrapper">
      <table
        className="parent-rota-table"
        data-testid={job === "indoor_cleaning" ? "rota-table" : `rota-table-${job}`}
      >
        <caption>
          {job === "indoor_cleaning" ? "Benti takarítás" : ROTA_JOB_LABELS[job]} hetekre bontva
        </caption>
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
              data-testid={`${testPrefix(job)}-row-${item.weekStart}`}
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
  families,
  hasOwn,
  filter,
  action,
}: Readonly<{
  families: ReadonlyMap<string, string>;
  hasOwn: boolean;
  filter: string;
  action: string;
}>) {
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
 * The published rota as every signed-in role reads it (W6). Phone: week cards; computer: a table. The four rotas
 * follow each other, then the weekend duties of each week. While nothing is published it says so; a refused or
 * failed read shows the denied or error state, never the empty one.
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
        <p className="eyebrow">Beosztás{model?.schoolYear ? ` · ${model.schoolYear.name}` : ""}</p>
        <h1 tabIndex={-1} autoFocus>
          Beosztás
        </h1>
        <p>
          A belső takarítás, az előkert, a vízhordás és a hétvégi állatgondozás családonkénti heti
          rendje.
        </p>
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
  const current = filter ?? "";
  const families = new Map<string, string>();
  for (const item of [...model.items, ...model.weekendItems])
    if (item.familyId && item.familyDisplayName)
      families.set(item.familyId, item.familyDisplayName);
  const hasOwn = [...model.items, ...model.weekendItems].some((item) => item.isOwn);
  const weekend = model.weekendItems.filter((item) => matches(item, current));
  const byJob = JOBS.map((job) => ({
    job,
    items: model.items.filter((item) => item.job === job && matches(item, current)),
  })).filter((entry) => entry.items.length > 0);
  return (
    <>
      <Filter families={families} hasOwn={hasOwn} filter={current} action={action} />
      {byJob.length === 0 && weekend.length === 0 ? (
        <p className="parent-empty" role="status" data-testid="rota-filter-empty">
          Nincs találat.
        </p>
      ) : (
        <>
          {byJob.map(({ job, items }) => (
            <section
              key={job}
              className="parent-rota-job-section"
              aria-labelledby={`rota-job-${job}`}
              data-testid={`rota-job-${job}`}
            >
              <h2 id={`rota-job-${job}`}>{ROTA_JOB_LABELS[job]}</h2>
              <ul
                className="parent-rota-list"
                data-testid={job === "indoor_cleaning" ? "rota-week-list" : `rota-week-list-${job}`}
              >
                {items.map((item) => (
                  <WeekCard key={item.weekStart} item={item} today={today} cardHref={cardHref} />
                ))}
              </ul>
              <WeekTable job={job} items={items} today={today} cardHref={cardHref} />
            </section>
          ))}
          <WeekendDuties items={weekend} today={today} cardHref={cardHref} />
        </>
      )}
    </>
  );
}

/** The five weekend duties of each week and who holds them (BR65.1): one block per week. */
function WeekendDuties({
  items,
  today,
  cardHref,
}: Readonly<{
  items: readonly WeekendOverviewItem[];
  today: string;
  cardHref: Base["cardHref"];
}>) {
  if (items.length === 0) return null;
  const weeks = new Map<string, WeekendOverviewItem[]>();
  for (const item of items) weeks.set(item.weekStart, [...(weeks.get(item.weekStart) ?? []), item]);
  return (
    <section
      className="parent-rota-job-section"
      aria-labelledby="rota-weekend-heading"
      data-testid="rota-weekend"
    >
      <h2 id="rota-weekend-heading">Hétvégi feladatok</h2>
      <ul className="parent-rota-weekend-list" data-testid="rota-weekend-list">
        {[...weeks.entries()].map(([weekStart, duties]) => (
          <li
            key={weekStart}
            className={`parent-rota-week${duties.some((duty) => duty.isOwn) ? " parent-rota-week-own" : ""}`}
            data-testid={`rota-weekend-${weekStart}`}
          >
            <p className="parent-rota-dates">
              <strong>{formatWeekRange(weekStart)}</strong>
              <PhaseBadge weekStart={weekStart} today={today} />
            </p>
            <ul className="parent-rota-slots">
              {duties.map((duty) => (
                <li key={duty.slot}>
                  <span className="parent-rota-job">{WEEKEND_SLOT_LABELS[duty.slot]}</span>{" "}
                  <span className="parent-rota-family">
                    {duty.familyDisplayName ?? "Nincs kijelölt család"}
                    {duty.isOwn && <strong className="parent-rota-own"> Ti</strong>}
                  </span>
                  {duty.isOwn && duty.dutyId && (
                    <>
                      {" "}
                      <a href={cardHref(duty.dutyId)}>Feladatlap megnyitása</a>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The fixed text of a card: the label, the sentence, and the lines that depend on the week. */
function cardText(card: RotaDutyCardModel): {
  jobLabel: string;
  instruction: string;
  lines: readonly string[];
} {
  if (card.job === "indoor_cleaning") {
    return {
      jobLabel: INDOOR_CLEANING_CARD_TEXT.jobLabel,
      instruction: INDOOR_CLEANING_CARD_TEXT.instruction,
      lines: [],
    };
  }
  if (card.job === "front_garden") {
    return {
      jobLabel: DUTY_CARD_TEXT.front_garden.jobLabel,
      instruction: DUTY_CARD_TEXT.front_garden.instruction,
      lines: card.includesWatering ? [DUTY_CARD_TEXT.front_garden.watering] : [],
    };
  }
  if (card.job === "water_carrying") {
    return {
      jobLabel: DUTY_CARD_TEXT.water_carrying.jobLabel,
      instruction: DUTY_CARD_TEXT.water_carrying.instruction,
      lines: card.bottlesAtWeekEnd ? [DUTY_CARD_TEXT.water_carrying.bottlesAtWeekEnd] : [],
    };
  }
  if (card.slot) {
    const when = [
      card.day ? DUTY_CARD_TEXT.weekend_slot.day[card.day] : undefined,
      card.partOfDay ? DUTY_CARD_TEXT.weekend_slot.partOfDay[card.partOfDay] : undefined,
    ].filter(Boolean);
    return {
      jobLabel: DUTY_CARD_TEXT.weekend_animal_care.jobLabel,
      instruction: DUTY_CARD_TEXT.weekend_slot.instruction,
      lines: when.length ? [when.join(" ")] : [],
    };
  }
  return {
    jobLabel: DUTY_CARD_TEXT.weekend_animal_care.jobLabel,
    instruction: DUTY_CARD_TEXT.weekend_animal_care.instruction,
    lines: [],
  };
}

/** What a picker shows when the family cannot choose any more (or need not): one plain sentence. */
function pickStateLine(own: WeekendOwnPickModel): string {
  if (own.state === "picked" && own.slot) {
    return `${PICK_STATE_TEXT.picked} ${WEEKEND_SLOT_LABELS[own.slot]}.`;
  }
  if (own.state === "open") return WEEKEND_PICKER_TEXT.closed;
  return PICK_STATE_TEXT[own.state];
}

/**
 * The duty card of one week (W7): the family, the week and the fixed text of its job. A weekly duty has no fixed day
 * and a weekend duty has its day and part of day. For a family that picks the weekend duty of its week the card
 * also carries the picker (`renderPicker`, given by the parent screen, which owns the pick command), and for the
 * week's families and a super admin the list of the weekend and who picked what (BR63.4, BR65.3).
 */
export function RotaDutyCard({
  result,
  backHref,
  renderPicker,
}: Readonly<{
  result: ApplicationResult<RotaDutyCardModel>;
  backHref: string;
  renderPicker?: (card: RotaDutyCardModel, own: WeekendOwnPickModel) => ReactNode;
}>) {
  const card = result.state === "success" || result.state === "recovery" ? result.data : undefined;
  const text = card ? cardText(card) : undefined;
  return (
    <section className="parent-page parent-rota-card-page" data-testid="rota-card-page">
      <a className="parent-back-link" href={backHref}>
        ← Vissza a beosztáshoz
      </a>
      {!card && <RotaState result={result} />}
      {card && text && (
        <>
          <header className="parent-detail-header">
            <p className="eyebrow">{text.jobLabel}</p>
            <h1 tabIndex={-1} autoFocus>
              {card.title}
            </h1>
            <p>{text.instruction}</p>
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
            {card.slot && text.lines.length > 0 && (
              <div>
                <dt>Időpont</dt>
                <dd data-testid="rota-card-when">{text.lines[0]}</dd>
              </div>
            )}
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
          {card.job !== "weekend_animal_care" && (
            <>
              {text.lines.map((line) => (
                <p className="parent-notice" key={line} data-testid="rota-card-extra">
                  {line}
                </p>
              ))}
              <p className="parent-notice" data-testid="rota-card-no-fixed-day">
                {INDOOR_CLEANING_CARD_TEXT.noFixedDay}
              </p>
            </>
          )}
          {card.ownPick && (
            <section
              className="parent-rota-picker"
              aria-labelledby="rota-picker-heading"
              data-testid="rota-picker"
            >
              <h2 id="rota-picker-heading">{WEEKEND_PICKER_TEXT.legend}</h2>
              <p className="form-hint">{WEEKEND_PICKER_TEXT.rule}</p>
              {card.ownPick.canPick && renderPicker ? (
                renderPicker(card, card.ownPick)
              ) : (
                <p className="parent-notice" data-testid="rota-picker-state">
                  {pickStateLine(card.ownPick)}
                </p>
              )}
            </section>
          )}
          {card.weekend && <WeekendState card={card} />}
        </>
      )}
    </section>
  );
}

/** The weekend of the card's week: who holds each of the five duties and who chose what (BR65.3). */
function WeekendState({ card }: Readonly<{ card: RotaDutyCardModel }>) {
  const weekend = card.weekend!;
  return (
    <section
      className="parent-rota-weekend"
      aria-labelledby="rota-weekend-state-heading"
      data-testid="rota-weekend-state"
    >
      <h2 id="rota-weekend-state-heading">{WEEKEND_PICKER_TEXT.weekendList}</h2>
      {weekend.weekendFamilyDisplayName && (
        <p>
          {WEEKEND_PICKER_TEXT.weekendFamily}: <strong>{weekend.weekendFamilyDisplayName}</strong>
        </p>
      )}
      <ul className="parent-rota-slots" data-testid="rota-weekend-slots">
        {weekend.slots.map((slot) => (
          <li key={slot.slot} data-testid={`rota-weekend-slot-${slot.slot}`}>
            <strong>{WEEKEND_SLOT_LABELS[slot.slot]}</strong>{" "}
            <span>
              {slot.heldByWeekendFamily
                ? `${WEEKEND_PICKER_TEXT.keptByWeekendFamily} (${slot.holderFamilyDisplayName ?? weekend.weekendFamilyDisplayName ?? ""})`
                : (slot.holderFamilyDisplayName ?? "")}
            </span>
          </li>
        ))}
      </ul>
      {weekend.pickers.length > 0 && (
        <>
          <h3>{WEEKEND_PICKER_TEXT.whoPicked}</h3>
          <ul className="parent-rota-pickers" data-testid="rota-weekend-pickers">
            {weekend.pickers.map((picker) => (
              <li key={picker.job}>
                <strong>{ROTA_JOB_LABELS[picker.job]}</strong>
                {picker.familyDisplayName ? `: ${picker.familyDisplayName}` : ""} –{" "}
                {picker.state === "picked" && picker.slot
                  ? `${PICK_STATE_TEXT.picked} ${WEEKEND_SLOT_LABELS[picker.slot]}.`
                  : PICK_STATE_TEXT[picker.state]}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
