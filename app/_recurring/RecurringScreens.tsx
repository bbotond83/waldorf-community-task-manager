import type { ReactNode } from "react";
import type {
  ApplicationResult,
  RecurringGroupListModel,
  RecurringItem,
  RecurringItemsModel,
  RecurringScheduleItem,
  RecurringScheduleListModel,
  RecurringScheduleModel,
  RotaDutyCardModel,
} from "../../src/application/index.ts";
import { budapestToday, formatLibraryDate } from "../../src/application/library-format.ts";
import {
  dueLine,
  formatMoment,
  intervalText,
  RECURRING_STATE_LABELS,
  recurringState,
  seasonText,
  type RecurringState,
} from "../../src/application/recurring-format.ts";
import { terminalFailure } from "../../src/application/results.ts";
import { STATUS_ICON_CHARACTERS, type StatusSymbol } from "../../src/application/status-labels.ts";
import { StatusBadge } from "../../src/runtime/StatusBadge.tsx";
import { ParentStatePanel } from "../szulo/_components/ParentStatePanel.tsx";
import { groupRecurringPath, type RecurringActor, type RecurringArea } from "./actor.ts";
import { resolveRecurringFacade } from "./facade.ts";
import {
  ActiveForm,
  BottleIntervalForm,
  DoneForm,
  ScheduleForm,
  SkipControl,
  UndoForm,
} from "./RecurringForms.tsx";

const symbol = (icon: keyof typeof STATUS_ICON_CHARACTERS): StatusSymbol => ({
  icon,
  character: STATUS_ICON_CHARACTERS[icon],
});

/** The symbol of each state; the word always stands beside it, so colour is never the only signal. */
const STATE_SYMBOL: Readonly<Record<RecurringState, StatusSymbol>> = {
  overdue: symbol("warning"),
  due: symbol("clock"),
  upcoming: symbol("calendar"),
  done: symbol("check"),
  skipped: symbol("block"),
};

/** The form pages are in the parent and the admin area; the teacher reads only. */
const FORM_BASE: Readonly<Record<"szulo" | "admin", string>> = {
  szulo: "/szulo/ismetlodo",
  admin: "/admin/ismetlodo",
};

const FORMER_MEMBER = "korábbi tag";

/* ---------- One occurrence ---------- */

/**
 * One occurrence as a card: its state in words and a symbol, the title and category, the due date or who did it and
 * when, or why it was skipped, and the buttons the database says the caller may use (a teacher has none).
 */
function ItemCard({
  item,
  groupId,
  today,
  now,
  showGroup = false,
  editHref,
  compact = false,
}: Readonly<{
  item: RecurringItem;
  groupId?: string | undefined;
  today: string;
  now: Date;
  showGroup?: boolean;
  /** Where a manager changes the schedule behind this occurrence. */
  editHref?: string | undefined;
  /** The bottle-cleaning line of a duty card: the title is the line's own heading. */
  compact?: boolean;
}>) {
  const state = recurringState(item, today);
  const Heading = compact ? "h2" : "h3";
  return (
    <li
      className={`recurring-card recurring-card-${state}`}
      data-testid={`recurring-item-${item.id}`}
      data-state={state}
    >
      <div className="recurring-card-head">
        <StatusBadge
          className={`recurring-status recurring-status-${state}`}
          label={RECURRING_STATE_LABELS[state]}
          symbol={STATE_SYMBOL[state]}
          testId={`recurring-status-${item.id}`}
        />
        {!compact && item.category && <span className="recurring-chip">{item.category}</span>}
        {editHref && (
          <a
            className="recurring-edit-link"
            href={editHref}
            aria-label={`Szerkesztés: ${item.title}`}
            data-testid={`recurring-edit-${item.id}`}
          >
            Szerkesztés
          </a>
        )}
      </div>
      <Heading className="recurring-title">{item.title}</Heading>
      {showGroup && item.groupName && <p className="recurring-meta">{item.groupName}</p>}
      {state === "done" && (
        <p className="recurring-done-line" data-testid={`recurring-done-by-${item.id}`}>
          Kész: <strong>{item.doneByDisplayName ?? FORMER_MEMBER}</strong>
          {item.doneAt && `, ${formatMoment(item.doneAt, now)}`}
        </p>
      )}
      {state === "skipped" && (
        <div className="recurring-skip-line" data-testid={`recurring-skipped-${item.id}`}>
          <p>
            Kihagyta: <strong>{item.skippedByDisplayName ?? FORMER_MEMBER}</strong>
          </p>
          {item.skippedReason && (
            <p className="recurring-reason">
              <span>Indoklás:</span> {item.skippedReason}
            </p>
          )}
        </div>
      )}
      {(state === "done" || state === "skipped") && (
        <p className="recurring-meta">Esedékes volt: {formatLibraryDate(item.dueDate)}</p>
      )}
      {(state === "due" || state === "overdue" || state === "upcoming") && (
        <p className="recurring-due" data-testid={`recurring-due-${item.id}`}>
          {dueLine(item.dueDate, today)}
        </p>
      )}
      {(item.canMarkDone || item.canUndo || item.canSkip) && (
        <div className="recurring-actions">
          {item.canMarkDone && <DoneForm item={item} groupId={groupId} />}
          {item.canUndo && <UndoForm item={item} groupId={groupId} />}
          {item.canSkip && <SkipControl item={item} groupId={groupId} />}
        </div>
      )}
    </li>
  );
}

/** A list of cards. The group of an occurrence comes from the occurrence itself, so the same list serves one group's page and the personal page. */
function ItemList({
  items,
  label,
  today,
  now,
  editFor,
}: Readonly<{
  items: readonly RecurringItem[];
  label: string;
  today: string;
  now: Date;
  editFor?: ((item: RecurringItem) => string) | undefined;
}>) {
  return (
    <ul className="recurring-list" aria-label={label}>
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          groupId={item.workingGroupId}
          today={today}
          now={now}
          editHref={editFor?.(item)}
        />
      ))}
    </ul>
  );
}

function Section({
  id,
  title,
  count,
  children,
}: Readonly<{ id: string; title: string; count?: string; children: ReactNode }>) {
  return (
    <section
      className="recurring-section"
      aria-labelledby={`recurring-${id}-title`}
      data-testid={`recurring-section-${id}`}
    >
      <div className="recurring-section-head">
        <h2 id={`recurring-${id}-title`}>{title}</h2>
        {count && <span className="recurring-count">{count}</span>}
      </div>
      {children}
    </section>
  );
}

const countOf = (n: number, one: string): string => `${n} ${one}`;

/* ---------- A working group's page ---------- */

function ScheduleRow({
  schedule,
  groupId,
  formBase,
}: Readonly<{ schedule: RecurringScheduleItem; groupId: string; formBase: string }>) {
  const season = seasonText(schedule);
  return (
    <li className="recurring-schedule" data-testid={`recurring-schedule-${schedule.id}`}>
      <div className="recurring-schedule-main">
        <p className="recurring-schedule-title">
          <strong>{schedule.title}</strong>
          <span
            className={`recurring-chip${schedule.isActive ? "" : " recurring-chip-off"}`}
            data-testid={`recurring-schedule-state-${schedule.id}`}
          >
            {schedule.isActive ? "Aktív" : "Kikapcsolva"}
          </span>
        </p>
        <p className="recurring-meta">
          {[schedule.category, intervalText(schedule), season].filter(Boolean).join(" • ")}
        </p>
      </div>
      <div className="recurring-schedule-actions">
        <a
          href={`${formBase}/${schedule.id}/szerkesztes`}
          aria-label={`Szerkesztés: ${schedule.title}`}
          data-testid={`recurring-schedule-edit-${schedule.id}`}
        >
          Szerkesztés
        </a>
        <ActiveForm schedule={schedule} groupId={groupId} />
      </div>
    </li>
  );
}

function GroupBody({
  model,
  area,
  today,
  now,
}: Readonly<{ model: RecurringGroupListModel; area: RecurringArea; today: string; now: Date }>) {
  const groupId = model.group.id;
  const formBase = FORM_BASE[area === "admin" ? "admin" : "szulo"];
  const manage = model.canManage && area !== "teacher";
  const due = model.items.filter(
    (item) => item.status === "open" && recurringState(item, today) !== "upcoming",
  );
  const upcoming = model.items.filter((item) => recurringState(item, today) === "upcoming");
  const done = model.items.filter((item) => item.status === "done");
  const skipped = model.items.filter((item) => item.status === "skipped");
  const editFor = manage
    ? (item: RecurringItem) => `${formBase}/${item.scheduleId}/szerkesztes`
    : undefined;
  const common = { today, now } as const;
  const nothing = model.items.length === 0 && model.history.length === 0;
  return (
    <>
      {manage && (
        <p className="recurring-new">
          <a
            className="button-link"
            href={`${formBase}/uj?csoport=${groupId}`}
            data-testid="recurring-new-link"
          >
            Új ismétlődő feladat
          </a>
        </p>
      )}
      {nothing && (
        <p className="recurring-empty" role="status" data-testid="recurring-empty">
          Ennek a csoportnak most nincs esedékes ismétlődő feladata.
        </p>
      )}
      {due.length > 0 && (
        <Section id="due" title="Esedékes és lejárt" count={countOf(due.length, "feladat")}>
          <ItemList
            items={due}
            label="Esedékes és lejárt feladatok"
            editFor={editFor}
            {...common}
          />
        </Section>
      )}
      {done.length > 0 && (
        <Section id="done" title="Kész" count={countOf(done.length, "elvégezve")}>
          <ItemList items={done} label="Elvégzett feladatok" {...common} />
        </Section>
      )}
      {skipped.length > 0 && (
        <Section id="skipped" title="Kihagyva" count={countOf(skipped.length, "bejegyzés")}>
          <ItemList items={skipped} label="Kihagyott feladatok" {...common} />
        </Section>
      )}
      {upcoming.length > 0 && (
        <Section id="upcoming" title="Következő esedékesek" count="következő 14 nap">
          <ItemList items={upcoming} label="Következő feladatok" editFor={editFor} {...common} />
        </Section>
      )}
      {manage && (
        <Section
          id="schedules"
          title="Ütemezések"
          count={countOf(model.schedules.length, "feladat")}
        >
          {model.schedules.length === 0 ? (
            <p className="recurring-empty" role="status" data-testid="recurring-schedules-empty">
              Még nincs ütemezett feladat.
            </p>
          ) : (
            <ul className="recurring-schedules" aria-label="Ütemezések">
              {model.schedules.map((schedule) => (
                <ScheduleRow
                  key={schedule.id}
                  schedule={schedule}
                  groupId={groupId}
                  formBase={formBase}
                />
              ))}
            </ul>
          )}
        </Section>
      )}
      {model.history.length > 0 && (
        <details className="recurring-history" data-testid="recurring-history">
          <summary>Korábbi bejegyzések ({model.history.length})</summary>
          <ul className="recurring-history-list">
            {model.history.map((item) => (
              <li key={item.id} data-testid={`recurring-history-${item.id}`}>
                <strong>{item.title}</strong> – {formatLibraryDate(item.dueDate)} –{" "}
                {item.status === "done"
                  ? `Kész: ${item.doneByDisplayName ?? FORMER_MEMBER}`
                  : item.status === "skipped"
                    ? "Kihagyva"
                    : "Lejárt"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

/**
 * A working group's recurring duties, shared by the parent, teacher and admin areas (BR150). The page is one read; the
 * empty text shows only after a successful read, and a refused or failed read shows its own state, never an empty list
 * (NFR4.9). A teacher has no buttons: the database gives a reader no right to act.
 */
export async function RecurringGroupScreen({
  actor,
  groupId,
}: Readonly<{ actor: RecurringActor; groupId: string }>) {
  const recurring = await resolveRecurringFacade();
  const result: ApplicationResult<RecurringGroupListModel> = recurring
    ? await recurring.groupList(actor.session, actor.scope, groupId)
    : terminalFailure();
  const now = new Date();
  const today = budapestToday(now);
  const groupPage = `/${actor.area}/munkacsoportok/${groupId}`;
  return (
    <section className="parent-page recurring-page" data-testid="recurring-group-page">
      <p className="parent-page-actions">
        <a href={groupPage} data-testid="recurring-back-link">
          Vissza a munkacsoporthoz
        </a>
      </p>
      <ParentStatePanel
        result={result}
        emptyMessage="Ez a munkacsoport nem érhető el."
        testId="recurring-group-state"
      >
        {(model) => (
          <>
            <header className="recurring-header">
              <p className="eyebrow">{model.group.name} munkacsoport</p>
              <h1 tabIndex={-1}>Ismétlődő feladatok</h1>
              <p className="recurring-intro">
                Rendszeres teendők ellenőrzése, elvégzése és ütemezése a csoportban.
              </p>
            </header>
            <GroupBody model={model} area={actor.area} today={today} now={now} />
          </>
        )}
      </ParentStatePanel>
    </section>
  );
}

/** The link of a group page to its recurring duties, for all three areas. */
export function GroupRecurringLink({
  area,
  groupId,
}: Readonly<{ area: RecurringArea; groupId: string }>) {
  return (
    <section
      className="recurring-group-link"
      aria-labelledby="recurring-group-link-title"
      data-testid="group-recurring"
    >
      <h2 id="recurring-group-link-title">Ismétlődő feladatok</h2>
      <p className="parent-page-actions">
        <a href={groupRecurringPath(area, groupId)} data-testid="group-recurring-link">
          Ismétlődő feladatok megnyitása
        </a>
      </p>
    </section>
  );
}

/* ---------- The form ---------- */

function FormState({ children, testId }: Readonly<{ children: ReactNode; testId: string }>) {
  return (
    <section className="parent-state" role="alert" data-testid={testId}>
      <h2>Hiba történt</h2>
      <p>{children}</p>
    </section>
  );
}

/**
 * The form that adds a group's schedule (with the group in the address) or changes one (with its id). Only a person
 * who may manage the group sees the form; anyone else reads one plain refusal, the same for a made-up address.
 */
export async function RecurringFormScreen({
  actor,
  groupId,
  scheduleId,
}: Readonly<{
  actor: RecurringActor;
  groupId?: string | undefined;
  scheduleId?: string | undefined;
}>) {
  const recurring = await resolveRecurringFacade();
  let schedule: RecurringScheduleItem | undefined;
  let owner = groupId;
  let failed = recurring === undefined;
  let refused = false;
  if (recurring && scheduleId) {
    const found: ApplicationResult<RecurringScheduleModel> = await recurring.scheduleGet(
      actor.session,
      actor.scope,
      scheduleId,
    );
    if (found.state === "success" || found.state === "recovery") {
      schedule = found.data.schedule;
      owner = schedule.workingGroupId;
      refused = !found.data.canManage || schedule.ownerKind !== "group";
    } else {
      failed = found.state !== "denied" && found.state !== "invalidated" && found.state !== "empty";
      refused = !failed;
    }
  }
  const group =
    recurring && owner && !refused && !failed
      ? await recurring.groupList(actor.session, actor.scope, owner)
      : undefined;
  const loaded = group && (group.state === "success" || group.state === "recovery");
  const model: RecurringGroupListModel | undefined = loaded ? group.data : undefined;
  // A group that could not be read for a reason other than a refusal is an error, not a refusal.
  const groupFailed =
    group !== undefined && !loaded && group.state !== "denied" && group.state !== "invalidated";
  const backHref = owner
    ? groupRecurringPath(actor.area, owner)
    : `/${actor.area === "admin" ? "admin" : "szulo"}/munkacsoportok`;
  return (
    <section className="parent-page recurring-page" data-testid="recurring-form-page">
      <p className="parent-page-actions">
        <a href={backHref} data-testid="recurring-form-back-link">
          Vissza az ismétlődő feladatokhoz
        </a>
      </p>
      {failed || groupFailed ? (
        <FormState testId="recurring-form-state-error">
          A feladat most nem tölthető be. Próbáld meg később.
        </FormState>
      ) : refused || !owner || !model || !model.canManage ? (
        <FormState testId="recurring-form-state-denied">
          Ezt a feladatot nem szerkesztheted.
        </FormState>
      ) : (
        <>
          <header className="recurring-header">
            <p className="eyebrow">{model.group.name} munkacsoport</p>
            <h1 tabIndex={-1}>
              {schedule ? "Ismétlődő feladat szerkesztése" : "Új ismétlődő feladat"}
            </h1>
            <p className="recurring-intro">
              Rendszeresen visszatérő teendő ütemezése és beállításai.
            </p>
          </header>
          {schedule && (
            <p className="recurring-note" role="note" data-testid="recurring-edit-note">
              A mentés után a későbbi, még nem jelzett esedékességek az új szabály szerint jönnek
              létre.
            </p>
          )}
          <ScheduleForm
            groupId={owner}
            groupName={model.group.name}
            {...(schedule ? { schedule } : {})}
            today={budapestToday()}
            backHref={backHref}
          />
        </>
      )}
    </section>
  );
}

/* ---------- My recurring duties ---------- */

function MineBody({
  model,
  today,
  now,
}: Readonly<{ model: RecurringItemsModel; today: string; now: Date }>) {
  const own = model.items.filter((item) => item.ownerKind !== "group");
  const byGroup = new Map<string, RecurringItem[]>();
  for (const item of model.items.filter((entry) => entry.ownerKind === "group")) {
    const key = item.groupName ?? "Munkacsoport";
    byGroup.set(key, [...(byGroup.get(key) ?? []), item]);
  }
  if (model.items.length === 0) {
    return (
      <p className="recurring-empty" role="status" data-testid="recurring-mine-empty">
        Nincs esedékes ismétlődő feladatod.
      </p>
    );
  }
  return (
    <>
      <Section id="family" title="A családunk feladatai">
        {own.length === 0 ? (
          <p className="recurring-empty" role="status" data-testid="recurring-family-empty">
            Nincs esedékes feladat.
          </p>
        ) : (
          <ItemList items={own} label="A család feladatai" today={today} now={now} />
        )}
      </Section>
      {byGroup.size > 0 && (
        <Section id="groups" title="Munkacsoportjaink feladatai">
          {[...byGroup.entries()].map(([name, items]) => (
            <div key={name} className="recurring-group-block" data-testid="recurring-group-block">
              <h3 className="recurring-group-name">{name}</h3>
              <ItemList items={items} label={`${name} feladatai`} today={today} now={now} />
            </div>
          ))}
        </Section>
      )}
    </>
  );
}

/** The caller's own recurring duties: the family's and rota weeks' and the groups' (BR150.1). */
export async function RecurringMineScreen({ actor }: Readonly<{ actor: RecurringActor }>) {
  const recurring = await resolveRecurringFacade();
  const result = recurring ? await recurring.mine(actor.session, actor.scope) : terminalFailure();
  const now = new Date();
  const today = budapestToday(now);
  return (
    <section className="parent-page recurring-page" data-testid="recurring-mine-page">
      <header className="recurring-header">
        <p className="eyebrow">Szülői nézet</p>
        <h1 tabIndex={-1}>Ismétlődő feladataim</h1>
        <p className="recurring-intro">
          A családodhoz rendelt és a munkacsoportjaid rendszeresen visszatérő teendői.
        </p>
      </header>
      <ParentStatePanel
        result={result}
        emptyMessage="Nincs esedékes ismétlődő feladatod."
        testId="recurring-mine-state"
      >
        {(model) => <MineBody model={model} today={today} now={now} />}
      </ParentStatePanel>
    </section>
  );
}

/* ---------- The bottle-cleaning line of a duty card ---------- */

/**
 * Reads the bottle-cleaning line for the card of a water week, once the card itself has loaded. Any other card, or one
 * that did not load, has no line and costs no read.
 */
export async function loadBottleLine(
  actor: RecurringActor,
  card: ApplicationResult<RotaDutyCardModel>,
  dutyId: string,
): Promise<ApplicationResult<RecurringItemsModel> | undefined> {
  const loaded = card.state === "success" || card.state === "recovery";
  if (!loaded || card.data.job !== "water_carrying") return undefined;
  const recurring = await resolveRecurringFacade();
  return recurring ? recurring.bottle(actor.session, actor.scope, dutyId) : terminalFailure();
}

/**
 * The "Palackok tisztítása" line on the card of a water week: the occurrence of that week with Kész when it is due,
 * and who did it and when with Mégsem when it is done. A week with no occurrence shows nothing; a read that fails
 * says so, and a refused one shows nothing (the card itself is then refused too).
 */
export function BottleLine({
  result,
}: Readonly<{ result: ApplicationResult<RecurringItemsModel> }>) {
  const now = new Date();
  const today = budapestToday(now);
  if (result.state === "success" || result.state === "recovery") {
    if (result.data.items.length === 0) return null;
    return (
      <section
        className="recurring-bottle"
        aria-label="Palackok tisztítása"
        data-testid="recurring-bottle-line"
      >
        <ul className="recurring-list">
          {result.data.items.map((item) => (
            <ItemCard key={item.id} item={item} today={today} now={now} compact />
          ))}
        </ul>
      </section>
    );
  }
  if (result.state === "denied" || result.state === "invalidated" || result.state === "empty") {
    return null;
  }
  return (
    <p className="recurring-empty" role="alert" data-testid="recurring-bottle-error">
      A palackok tisztításának állapota most nem tölthető be.
    </p>
  );
}

/* ---------- The bottle interval on the school calendar page ---------- */

/**
 * The one number of the school calendar page: every how-manieth water week the bottles are cleaned. The schedule is
 * the community's rota-week schedule of the water job; a failed read says so and an empty one says there is none, and
 * only a successful read may say that (NFR4.9).
 */
export function BottleIntervalPanel({
  result,
}: Readonly<{ result: ApplicationResult<RecurringScheduleListModel> }>) {
  const ok = result.state === "success" || result.state === "recovery";
  const schedule = ok
    ? result.data.items.find(
        (item) => item.ownerKind === "rota_week" && item.rotaJob === "water_carrying",
      )
    : undefined;
  return (
    <section
      className="admin-rota-panel recurring-bottle-panel"
      data-testid="admin-bottle-interval"
    >
      <h2>Palackok tisztítása</h2>
      {schedule ? (
        <BottleIntervalForm schedule={schedule} />
      ) : ok ? (
        <p data-testid="admin-bottle-interval-empty">Még nincs palacktisztítási ütemezés.</p>
      ) : (
        <p role="alert" data-testid="admin-bottle-interval-error">
          A palackok tisztításának beállítása most nem tölthető be. Próbáld meg később.
        </p>
      )}
    </section>
  );
}
