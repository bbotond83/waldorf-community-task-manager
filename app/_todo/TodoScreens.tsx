import type { ReactNode } from "react";
import type {
  ApplicationResult,
  MyTasksModel,
  MyTasksRow,
  TodoCard,
  TodoDetailModel,
  TodoGroupListModel,
  TodoListFilters,
  TodoListModel,
  TodoStatus,
} from "../../src/application/index.ts";
import { TODO_STATUSES } from "../../src/application/contracts.ts";
import { formatLibraryDate } from "../../src/application/library-format.ts";
import { denied, terminalFailure } from "../../src/application/results.ts";
import { STATUS_ICON_CHARACTERS, type StatusSymbol } from "../../src/application/status-labels.ts";
import {
  deadlineText,
  eventLinkText,
  historyLine,
  notBeforeText,
  priorityText,
  TODO_STATUS_LABELS,
  todoNotes,
  todoState,
} from "../../src/application/todo-format.ts";
import { StatusBadge } from "../../src/runtime/StatusBadge.tsx";
import { GroupMembersSection } from "../../src/runtime/WorkingGroupDetail.tsx";
import { TemplateListTab } from "../_checklists/TemplateScreens.tsx";
import { EVENT_BASE_PATH } from "../_events/actor.ts";
import { resolveEventFacade } from "../_events/facade.ts";
import { RecurringGroupTab } from "../_recurring/RecurringScreens.tsx";
import { resolveWorkingGroupFacade } from "../teacher/_lib/facade.ts";
import { resolveAdminFacade } from "../admin/_lib/facade.ts";
import { isRecurringId } from "../_recurring/recurring-form.ts";
import { ParentStatePanel } from "../szulo/_components/ParentStatePanel.tsx";
import { groupManagePath, resolveTodoManager, TODO_BASE_PATH, type TodoActor } from "./actor.ts";
import { resolveTodoFacade } from "./facade.ts";
import { TodoStatusRegion } from "./TodoAnnouncer.tsx";
import {
  ClaimButton,
  DoneButton,
  FreeClaimButton,
  GiveBackButton,
  MyRecurringDoneButton,
  PullForm,
  TodoForm,
  UndoDoneButton,
  UpdateForm,
  type TodoPullRow,
} from "./TodoForms.tsx";

const symbol = (icon: keyof typeof STATUS_ICON_CHARACTERS): StatusSymbol => ({
  icon,
  character: STATUS_ICON_CHARACTERS[icon],
});

/** The status of a card in words and a symbol, so colour is never the only signal. */
function StateBadge({ card }: Readonly<{ card: Parameters<typeof todoState>[0] }>) {
  const state = todoState(card);
  return (
    <StatusBadge
      className={`todo-status todo-status-${state.key}`}
      label={state.label}
      symbol={symbol(state.icon)}
    />
  );
}

const metaLine = (card: TodoCard): string =>
  [priorityText(card.priority), deadlineText(card.deadline), notBeforeText(card.notBefore)]
    .filter(Boolean)
    .join(" • ");

/* ---------- Filters ---------- */

const UUID_FIELD = (value: string | undefined): string | undefined =>
  isRecurringId(value) ? value : undefined;

/** The filters of the list read from the address; every value is checked, so a made-up one narrows nothing. */
export function parseTodoFilters(
  search: Readonly<Record<string, string | string[] | undefined>>,
): TodoListFilters {
  const one = (key: string): string | undefined => {
    const value = search[key];
    return typeof value === "string" ? value : undefined;
  };
  const status = one("allapot");
  const priority = Number(one("fontossag"));
  const owner = UUID_FIELD(one("felelos"));
  return {
    ...(one("mind") === "1" ? { showHidden: true } : {}),
    ...(status && (TODO_STATUSES as readonly string[]).includes(status)
      ? { status: status as TodoStatus }
      : {}),
    ...(Number.isInteger(priority) && priority >= 1 && priority <= 3 ? { priority } : {}),
    ...(owner ? { owner } : {}),
    ...(one("figyelem") === "1" ? { attentionOnly: true } : {}),
  };
}

const hasFilters = (filters: TodoListFilters): boolean =>
  filters.status !== undefined ||
  filters.priority !== undefined ||
  filters.owner !== undefined ||
  filters.attentionOnly === true;

function FilterForm({
  filters,
  owners,
  canManage,
  base,
}: Readonly<{
  filters: TodoListFilters;
  owners: readonly { id: string; label: string }[];
  canManage: boolean;
  base: string;
}>) {
  return (
    <form method="get" action={base} className="todo-filters" data-testid="todo-filters">
      <div className="todo-filter">
        <label htmlFor="todo-filter-owner">Felelős</label>
        <select
          id="todo-filter-owner"
          name="felelos"
          defaultValue={filters.owner ?? ""}
          data-testid="todo-filter-owner"
        >
          <option value="">Mind</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.label}
            </option>
          ))}
        </select>
      </div>
      <div className="todo-filter">
        <label htmlFor="todo-filter-status">Állapot</label>
        <select
          id="todo-filter-status"
          name="allapot"
          defaultValue={filters.status ?? ""}
          data-testid="todo-filter-status"
        >
          <option value="">Mind</option>
          {TODO_STATUSES.map((status) => (
            <option key={status} value={status}>
              {TODO_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="todo-filter">
        <label htmlFor="todo-filter-priority">Prioritás</label>
        <select
          id="todo-filter-priority"
          name="fontossag"
          defaultValue={filters.priority === undefined ? "" : String(filters.priority)}
          data-testid="todo-filter-priority"
        >
          <option value="">Mind</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
      </div>
      <label className="todo-filter-check">
        <input
          type="checkbox"
          name="mind"
          value="1"
          defaultChecked={filters.showHidden === true}
          data-testid="todo-filter-hidden"
        />
        Elkészültek és későbbiek is
      </label>
      {canManage && (
        <label className="todo-filter-check">
          <input
            type="checkbox"
            name="figyelem"
            value="1"
            defaultChecked={filters.attentionOnly === true}
            data-testid="todo-filter-attention"
          />
          Csak figyelmet igénylők
        </label>
      )}
      <button type="submit" data-testid="todo-filter-submit">
        Szűrés
      </button>
    </form>
  );
}

/* ---------- The list ---------- */

function TodoRow({
  card,
  actor,
  canClaimTasks,
}: Readonly<{ card: TodoCard; actor: TodoActor; canClaimTasks: boolean }>) {
  const notes = todoNotes(card);
  const base = TODO_BASE_PATH[actor.area];
  const meta = metaLine(card);
  const buttons = actor.area !== "teacher";
  return (
    <li
      className={`todo-row todo-row-${todoState(card).key}`}
      data-testid={`todo-item-${card.id}`}
      data-state={todoState(card).key}
    >
      <div className="todo-row-head">
        <StateBadge card={card} />
        {notes.map((note) => (
          <span key={note} className="todo-chip">
            {note}
          </span>
        ))}
      </div>
      <h2 className="todo-title">
        <a href={`${base}/${card.id}`} data-testid={`todo-link-${card.id}`}>
          {card.topic}
        </a>
      </h2>
      <p className="todo-meta">{card.ownerLabel}</p>
      {meta && <p className="todo-meta">{meta}</p>}
      {buttons && (
        <div className="todo-actions">
          {canClaimTasks && card.canClaim && (
            <ClaimButton taskId={card.id} topic={card.topic} version={card.version} />
          )}
          {card.claimedByMe && !card.isDone && (
            <>
              <DoneButton taskId={card.id} topic={card.topic} version={card.version} />
              <GiveBackButton taskId={card.id} topic={card.topic} version={card.version} />
            </>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * The community's list (BR180, BR184). One read, and a second, wider one for the owner choices only when a filter
 * narrows the list; the empty texts show only after a successful read, a filter with no
 * match says so with a way back, and a refused or failed read shows its own state, never an empty list. A teacher has
 * no buttons.
 */
export async function TodoListScreen({
  actor,
  filters,
}: Readonly<{ actor: TodoActor; filters: TodoListFilters }>) {
  const todo = await resolveTodoFacade();
  const result: ApplicationResult<TodoListModel> = todo
    ? await todo.list(actor.session, actor.scope, filters)
    : terminalFailure();
  const base = TODO_BASE_PATH[actor.area];
  // The owner choices come from every task, not from the page: after choosing one owner the list shows only that
  // owner's tasks, and the choices must still offer the others.
  const narrowed = hasFilters(filters);
  const everyone =
    narrowed && todo ? await todo.list(actor.session, actor.scope, { showHidden: true }) : null;
  const everyoneItems =
    everyone && (everyone.state === "success" || everyone.state === "recovery")
      ? everyone.data.items
      : null;
  return (
    <section className="parent-page todo-page" data-testid="todo-list-page">
      <TodoStatusRegion />
      <header className="todo-header">
        <h1 tabIndex={-1}>Közös teendők</h1>
        {actor.area === "admin" && (
          <a className="button-link" href={`${base}/uj`} data-testid="todo-new-link">
            Új teendő
          </a>
        )}
      </header>
      <ParentStatePanel
        result={result}
        emptyMessage="Most nincs nyitott teendő."
        testId="todo-list-state"
      >
        {(model) => {
          const owners = [
            ...new Map(
              (everyoneItems ?? model.items).map((card) => [card.ownerId, card.ownerLabel]),
            ).entries(),
          ].map(([id, label]) => ({ id, label }));
          return (
            <>
              <FilterForm
                filters={filters}
                owners={owners}
                canManage={model.caller.canManageCommunity}
                base={base}
              />
              {model.items.length === 0 ? (
                narrowed ? (
                  <p className="todo-empty" role="status" data-testid="todo-no-match">
                    Nincs találat. <a href={base}>Szűrők törlése</a>
                  </p>
                ) : (
                  <p className="todo-empty" role="status" data-testid="todo-empty">
                    Most nincs nyitott teendő.
                  </p>
                )
              ) : (
                <ul className="todo-list" aria-label="Közös teendők">
                  {model.items.map((card) => (
                    <TodoRow
                      key={card.id}
                      card={card}
                      actor={actor}
                      canClaimTasks={model.caller.canClaimTasks}
                    />
                  ))}
                </ul>
              )}
            </>
          );
        }}
      </ParentStatePanel>
    </section>
  );
}

/* ---------- The task page ---------- */

function Fact({
  label,
  children,
  testId,
}: Readonly<{ label: string; children: ReactNode; testId: string }>) {
  return (
    <div className="todo-fact" data-testid={testId}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The address of the form that edits a task: a coordinator's through the group's management page, a super admin's in the admin area. */
function editPath(actor: TodoActor, card: TodoCard): string {
  return actor.area === "admin" || card.ownerKind === "family"
    ? `/admin/teendok/${card.id}/szerkesztes`
    : `${groupManagePath("szulo", card.ownerId)}/teendo/${card.id}`;
}

function DetailBody({
  detail,
  actor,
  now,
}: Readonly<{ detail: TodoDetailModel; actor: TodoActor; now: Date }>) {
  const { item, can } = detail;
  const groupId = item.ownerKind === "working_group" ? item.ownerId : undefined;
  const notes = todoNotes(item);
  const task = { taskId: item.id, topic: item.topic, version: item.version };
  const events = `/${actor.area}/esemenyek`;
  return (
    <>
      <header className="todo-header">
        <div>
          <div className="todo-row-head">
            <StateBadge card={item} />
            {notes.map((note) => (
              <span key={note} className="todo-chip">
                {note}
              </span>
            ))}
          </div>
          <h1 tabIndex={-1}>{item.topic}</h1>
        </div>
        {can.edit && actor.area !== "teacher" && (
          <a
            className="button-link"
            href={editPath(actor, item)}
            aria-label={`Szerkesztés: ${item.topic}`}
            data-testid="todo-edit-link"
          >
            Szerkesztés
          </a>
        )}
        {can.edit && actor.area === "admin" && item.ownerKind === "family" && (
          <a
            className="button-link"
            href={`${editPath(actor, item)}#todo-new-owner-family`}
            aria-label={`Átadás másik családnak: ${item.topic}`}
            data-testid="todo-handover-link"
          >
            Átadás másik családnak
          </a>
        )}
      </header>
      <dl className="todo-facts">
        <Fact label="Felelős" testId="todo-owner">
          {item.ownerLabel}
        </Fact>
        {item.priority !== undefined && (
          <Fact label="Prioritás" testId="todo-fact-priority">
            {item.priority}
          </Fact>
        )}
        {item.deadline && (
          <Fact label="Határidő" testId="todo-fact-deadline">
            {formatLibraryDate(item.deadline)}
          </Fact>
        )}
        {item.notBefore && (
          <Fact label="Nem előbb" testId="todo-fact-not-before">
            {formatLibraryDate(item.notBefore)}
          </Fact>
        )}
        {item.claimantDisplayName !== undefined && (
          <Fact label="Vállalta" testId="todo-fact-claimant">
            {item.claimantDisplayName}
          </Fact>
        )}
        {detail.done && (
          <Fact label="Kész" testId="todo-fact-done">
            {detail.done.byDisplayName ?? "korábbi tag"}
          </Fact>
        )}
        {detail.description && (
          <Fact label="Leírás" testId="todo-fact-description">
            {detail.description}
          </Fact>
        )}
        {detail.materials && (
          <Fact label="Eszközök és anyagok" testId="todo-fact-materials">
            {detail.materials}
          </Fact>
        )}
        {detail.note && (
          <Fact label="Megjegyzés" testId="todo-fact-note">
            {detail.note}
          </Fact>
        )}
      </dl>
      {detail.eventLinks.length > 0 && (
        <ul className="todo-event-links" aria-label="Események" data-testid="todo-event-links">
          {detail.eventLinks.map((link) => (
            <li key={link.eventId}>
              {link.state === "gone" ? (
                eventLinkText(link)
              ) : (
                <a href={`${events}/${link.eventId}`}>{eventLinkText(link)}</a>
              )}
            </li>
          ))}
        </ul>
      )}
      {actor.area !== "teacher" &&
        (can.claim || can.giveBack || can.markDone || can.undoDone || can.freeClaim) && (
          <div className="todo-actions" data-testid="todo-detail-actions">
            {can.claim && <ClaimButton {...task} />}
            {can.markDone && <DoneButton {...task} />}
            {can.undoDone && <UndoDoneButton {...task} />}
            {can.giveBack && <GiveBackButton {...task} />}
            {can.freeClaim && <FreeClaimButton {...task} groupId={groupId} />}
          </div>
        )}
      {can.update && actor.area !== "teacher" && <UpdateForm detail={detail} />}
      <section className="todo-history" aria-labelledby="todo-history-title">
        <h2 id="todo-history-title">Előzmények</h2>
        <ol className="todo-history-list" data-testid="todo-history">
          {detail.history.map((entry, index) => (
            <li key={`${entry.at}-${index}`}>{historyLine(entry, now)}</li>
          ))}
        </ol>
      </section>
    </>
  );
}

/** One task's page (BR180, BR182 to BR185): its fields, the buttons the database says the caller may use, the event links and the history. One read. */
export async function TodoDetailScreen({
  actor,
  taskId,
}: Readonly<{ actor: TodoActor; taskId: string }>) {
  const todo = await resolveTodoFacade();
  const result: ApplicationResult<TodoDetailModel> = todo
    ? await todo.get(actor.session, actor.scope, taskId)
    : terminalFailure();
  const base = TODO_BASE_PATH[actor.area];
  return (
    <section className="parent-page todo-page" data-testid="todo-detail-page">
      <TodoStatusRegion />
      <p className="parent-page-actions">
        <a href={base} data-testid="todo-back-link">
          Vissza a teendőkhöz
        </a>
      </p>
      <ParentStatePanel
        result={result}
        emptyMessage="Ez a teendő nem érhető el."
        testId="todo-detail-state"
      >
        {(detail) => <DetailBody detail={detail} actor={actor} now={new Date()} />}
      </ParentStatePanel>
    </section>
  );
}

/* ---------- My tasks ---------- */

function MyRow({ row }: Readonly<{ row: MyTasksRow }>) {
  const href =
    row.kind === "todo"
      ? `/szulo/teendok/${row.refId}`
      : row.kind === "recurring"
        ? "/szulo/ismetlodo"
        : `/szulo/feladatok/${row.id}`;
  return (
    <li
      className={`todo-row${row.isOverdue ? " todo-row-attention" : ""}`}
      data-testid={`my-task-${row.kind}-${row.id}`}
    >
      <div className="todo-row-head">
        <StatusBadge
          className="todo-status"
          label={row.isOverdue ? "Lejárt" : "Nyitott"}
          symbol={symbol(row.isOverdue ? "warning" : "ring")}
        />
        {row.date && <span className="todo-chip">{formatLibraryDate(row.date)}</span>}
      </div>
      <h3 className="todo-title">
        <a href={href}>{row.title}</a>
      </h3>
      {row.canMarkDone && row.kind === "todo" && (
        <div className="todo-actions">
          <DoneButton taskId={row.refId} topic={row.title} version={row.version} />
        </div>
      )}
      {row.canMarkDone && row.kind === "recurring" && (
        <div className="todo-actions">
          <MyRecurringDoneButton occurrenceId={row.refId} title={row.title} version={row.version} />
        </div>
      )}
    </li>
  );
}

function MySection({
  id,
  title,
  rows,
}: Readonly<{ id: string; title: string; rows: readonly MyTasksRow[] }>) {
  if (rows.length === 0) return null;
  return (
    <section
      className="todo-section"
      aria-labelledby={`my-tasks-${id}-title`}
      data-testid={`my-tasks-${id}`}
    >
      <h2 id={`my-tasks-${id}-title`}>{title}</h2>
      <ul className="todo-list" aria-label={title}>
        {rows.map((row) => (
          <MyRow key={`${row.kind}-${row.id}`} row={row} />
        ))}
      </ul>
    </section>
  );
}

/** My tasks (BR186): the family's duties, recurring duties and claimed to-do tasks, grouped by week. One read. */
export async function MyTasksScreen({ actor }: Readonly<{ actor: TodoActor }>) {
  const todo = await resolveTodoFacade();
  const result: ApplicationResult<MyTasksModel> = todo
    ? await todo.myTasks(actor.session, actor.scope)
    : terminalFailure();
  return (
    <section className="parent-page todo-page" data-testid="my-tasks-page">
      <TodoStatusRegion />
      <header className="todo-header">
        <h1 tabIndex={-1}>Feladataim</h1>
      </header>
      <ParentStatePanel
        result={result}
        emptyMessage="Most nincs feladatotok."
        testId="my-tasks-state"
      >
        {(model) =>
          model.isEmpty ? (
            <div className="todo-empty" role="status" data-testid="my-tasks-empty">
              <p>Most nincs feladatotok.</p>
              <p className="parent-page-actions">
                <a href={TODO_BASE_PATH.szulo}>Teendők</a>
                <a href="/szulo/allatok">Állatgondozás</a>
              </p>
            </div>
          ) : (
            <>
              <MySection id="week" title="Ezen a héten" rows={model.thisWeek} />
              <MySection id="later" title="Később" rows={model.later} />
              <MySection id="nodate" title="Nincs dátum" rows={model.noDate} />
            </>
          )
        }
      </ParentStatePanel>
    </section>
  );
}

/* ---------- The management page ---------- */

export type ManageTab = "todo" | "recurring" | "templates" | "members";

/** The `?ful=` value of each tab of the management page (the Teendők tab has none). */
const MANAGE_TAB_PARAMS: Readonly<Record<ManageTab, string>> = Object.freeze({
  todo: "teendok",
  recurring: "ismetlodo",
  templates: "sablonok",
  members: "tagok",
});

const MANAGE_TAB_LABELS: Readonly<Record<ManageTab, string>> = Object.freeze({
  todo: "Teendők",
  recurring: "Ismétlődő feladatok",
  templates: "Sablonok",
  members: "Tagok",
});

function ManageTabs({
  area,
  groupId,
  current,
}: Readonly<{ area: "szulo" | "admin"; groupId: string; current: ManageTab }>) {
  const base = groupManagePath(area, groupId);
  return (
    <nav className="todo-tabs" aria-label="Kezelés" data-testid="manage-tabs">
      {(Object.keys(MANAGE_TAB_LABELS) as ManageTab[]).map((tab) => (
        <a
          key={tab}
          href={tab === "todo" ? base : `${base}?ful=${MANAGE_TAB_PARAMS[tab]}`}
          aria-current={current === tab ? "page" : undefined}
          data-testid={`manage-tab-${tab}`}
        >
          {MANAGE_TAB_LABELS[tab]}
        </a>
      ))}
    </nav>
  );
}

/** The tab named by `?ful=` on the management page; anything else is the Teendők tab. */
export function parseManageTab(value: string | string[] | undefined): ManageTab {
  const found = (Object.keys(MANAGE_TAB_PARAMS) as ManageTab[]).find(
    (tab) => MANAGE_TAB_PARAMS[tab] === value,
  );
  return found ?? "todo";
}

/** The members tab: the group's own member list, read only (the group page keeps the coordinator actions). */
async function manageMembersTab(actor: TodoActor, groupId: string, area: "szulo" | "admin") {
  const groups = await resolveWorkingGroupFacade();
  const result = groups
    ? await groups.detail(actor.session, actor.scope, groupId)
    : terminalFailure();
  return (
    <ParentStatePanel
      result={result}
      emptyMessage="Ez a munkacsoport nem érhető el."
      testId="manage-members-state"
    >
      {(model) => (
        <GroupMembersSection
          model={model}
          area={area === "admin" ? "admin" : "parent"}
          directoryPath={`/${area}/szulok`}
        />
      )}
    </ParentStatePanel>
  );
}

/**
 * A working group's management page (BR187, W7). Its four tabs are shown inline, one at a time (`?ful=`): Teendők is
 * built here, and the other three reuse the reads and rows of the group's recurring-duty, template and member pages.
 * Only the open tab is read. A person who may not manage the group reads the denied state.
 */
export async function TodoManageScreen({
  actor,
  groupId,
  tab = "todo",
}: Readonly<{ actor: TodoActor; groupId: string; tab?: ManageTab }>) {
  const area = actor.area === "admin" ? "admin" : "szulo";
  return (
    <section className="parent-page todo-page" data-testid="manage-page">
      <TodoStatusRegion />
      <p className="parent-page-actions">
        <a href={`/${area}/munkacsoportok/${groupId}`} data-testid="manage-back-link">
          Vissza a munkacsoporthoz
        </a>
      </p>
      <header className="todo-header">
        <h1 tabIndex={-1}>Munkacsoport kezelése</h1>
      </header>
      <ManageTabs area={area} groupId={groupId} current={tab} />
      {tab === "todo" && (await manageTodoTab(actor, groupId, area))}
      {tab === "recurring" && <RecurringGroupTab actor={actor} groupId={groupId} />}
      {tab === "templates" && (
        <TemplateListTab
          actor={{
            area,
            basePath: EVENT_BASE_PATH[area],
            session: actor.session,
            scope: actor.scope,
          }}
          groupId={groupId}
        />
      )}
      {tab === "members" && (await manageMembersTab(actor, groupId, area))}
    </section>
  );
}

/** The Teendők tab: one read of the group's tasks (and a plain function, so the page awaits it as part of its own render). */
async function manageTodoTab(actor: TodoActor, groupId: string, area: "szulo" | "admin") {
  const todo = await resolveTodoFacade();
  // The group's tasks are read with the right of the group's coordinator (or the super admin's), so the scope is the
  // group's, never the family scope the parent pages read with. A group that is not the person's has no scope.
  const manager = todo ? await resolveTodoManager() : undefined;
  const scope = manager?.scopeFor(groupId);
  const result: ApplicationResult<TodoGroupListModel> = !todo
    ? terminalFailure()
    : manager && scope
      ? await todo.groupList(manager.session, scope, groupId)
      : denied();
  const formBase = `${groupManagePath(area, groupId)}/teendo`;
  return (
    <>
      <ParentStatePanel
        result={result}
        emptyMessage="Ennek a csoportnak most nincs teendője."
        testId="manage-state"
      >
        {(model) => (
          <section className="todo-section" aria-labelledby="manage-todo-title">
            <div className="todo-section-head">
              <h2 id="manage-todo-title">Teendők</h2>
              <a className="button-link" href={formBase} data-testid="manage-new-link">
                Új teendő
              </a>
            </div>
            {model.items.length === 0 ? (
              <p className="todo-empty" role="status" data-testid="manage-empty">
                Ennek a csoportnak most nincs teendője.
              </p>
            ) : (
              <ul className="todo-list" aria-label="A csoport teendői" data-testid="manage-list">
                {model.items.map((item) => {
                  const state = todoState({
                    isDone: item.status === "done",
                    needsAttention: item.needsAttention,
                    ownerKind: "working_group",
                    claimantDisplayName: item.claimantDisplayName,
                    status: item.status,
                  });
                  return (
                    <li
                      key={item.id}
                      className={`todo-row todo-row-${state.key}`}
                      data-testid={`manage-item-${item.id}`}
                    >
                      <div className="todo-row-head">
                        <StatusBadge
                          className={`todo-status todo-status-${state.key}`}
                          label={state.label}
                          symbol={symbol(state.icon)}
                        />
                        {item.isOverdue && <span className="todo-chip">Lejárt</span>}
                      </div>
                      <h3 className="todo-title">
                        <a href={`${TODO_BASE_PATH[actor.area]}/${item.id}`}>{item.title}</a>
                      </h3>
                      <p className="todo-meta">
                        {[priorityText(item.priority), deadlineText(item.deadline)]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                      <div className="todo-actions">
                        <a
                          href={`${formBase}/${item.id}`}
                          aria-label={`Szerkesztés: ${item.title}`}
                          data-testid={`manage-edit-${item.id}`}
                        >
                          Szerkesztés
                        </a>
                        {item.claimantDisplayName !== undefined && item.status !== "done" && (
                          <FreeClaimButton
                            taskId={item.id}
                            topic={item.title}
                            version={item.version}
                            groupId={groupId}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </ParentStatePanel>
    </>
  );
}

/* ---------- The task form ---------- */

function FormDenied({ testId }: Readonly<{ testId: string }>) {
  return (
    <section className="parent-state" role="alert" data-testid={testId}>
      <h2>Hiba történt</h2>
      <p>Ezt a teendőt nem kezelheted.</p>
    </section>
  );
}

/**
 * The families a super admin may hand a family-owned task to: the active families by name (the existing admin read),
 * without the current owner. Anyone else, and a read that fails, gets none, and the form then shows no chooser. The
 * database repeats the rule: only a super admin changes an owner.
 */
async function handoverFamilies(
  actor: TodoActor,
  currentFamilyId: string,
): Promise<readonly { id: string; name: string }[]> {
  if (actor.area !== "admin") return [];
  const manager = await resolveTodoManager();
  if (!manager?.isSuperAdmin) return [];
  const admin = await resolveAdminFacade();
  const found = admin ? await admin.listFamilyNames(actor.session, actor.scope) : undefined;
  if (!found || (found.state !== "success" && found.state !== "recovery")) return [];
  return found.data.items
    .filter((family) => family.id !== currentFamilyId)
    .map((family) => ({ id: family.id, name: family.displayName }));
}

/**
 * The form that adds a task (with its group in the address, or chosen by a super admin) or changes one (with its id). Only
 * a person who may manage the owner sees the form; anyone else reads one plain refusal, the same for a made-up address.
 */
export async function TodoFormScreen({
  actor,
  groupId,
  taskId,
  groups,
}: Readonly<{
  actor: TodoActor;
  groupId?: string | undefined;
  taskId?: string | undefined;
  groups?: readonly { id: string; name: string }[] | undefined;
}>) {
  const todo = await resolveTodoFacade();
  const area = actor.area === "admin" ? "admin" : "szulo";
  let detail: TodoDetailModel | undefined;
  let refused = todo === undefined;
  if (todo && taskId) {
    const found = await todo.get(actor.session, actor.scope, taskId);
    if (found.state === "success" || found.state === "recovery") {
      detail = found.data;
      refused = !found.data.can.edit;
    } else {
      refused = true;
    }
  }
  const owner = detail?.item;
  const ownerGroupId = owner
    ? owner.ownerKind === "working_group"
      ? owner.ownerId
      : undefined
    : groupId;
  const backHref =
    area === "szulo" && ownerGroupId
      ? groupManagePath("szulo", ownerGroupId)
      : TODO_BASE_PATH.admin;
  const families =
    !refused && owner?.ownerKind === "family" ? await handoverFamilies(actor, owner.ownerId) : [];
  return (
    <section className="parent-page todo-page" data-testid="todo-form-page">
      <p className="parent-page-actions">
        <a href={backHref} data-testid="todo-form-back-link">
          Mégse
        </a>
      </p>
      {refused ? (
        <FormDenied testId="todo-form-denied" />
      ) : (
        <>
          <header className="todo-header">
            <h1 tabIndex={-1}>{detail ? "Szerkesztés" : "Új teendő"}</h1>
          </header>
          <TodoForm
            task={
              detail
                ? {
                    id: detail.item.id,
                    version: detail.item.version,
                    topic: detail.item.topic,
                    status: detail.item.status,
                    priority: detail.item.priority,
                    description: detail.description,
                    materials: detail.materials,
                    note: detail.note,
                    notBefore: detail.item.notBefore,
                    deadline: detail.item.deadline,
                  }
                : undefined
            }
            ownerGroupId={ownerGroupId}
            ownerFamilyId={owner && owner.ownerKind === "family" ? owner.ownerId : undefined}
            ownerLabel={owner?.ownerLabel}
            groups={ownerGroupId || owner ? undefined : groups}
            families={families}
            backHref={backHref}
          />
        </>
      )}
    </section>
  );
}

/* ---------- On the group page ---------- */

/** The one read of the group's section: the community list narrowed to the group. A missing facade reads as a failure. */
export async function loadGroupTodo(
  actor: TodoActor,
  groupId: string,
): Promise<ApplicationResult<TodoListModel>> {
  const todo = await resolveTodoFacade();
  return todo ? todo.list(actor.session, actor.scope, { owner: groupId }) : terminalFailure();
}

/**
 * The group's open to-do tasks on its page, for every reader: the community list narrowed to the group (one read). A
 * refused or failed read shows nothing here; the page itself has its own states.
 */
export function GroupTodoSection({
  actor,
  groupId,
  result,
}: Readonly<{
  actor: TodoActor;
  groupId: string;
  result: ApplicationResult<TodoListModel>;
}>) {
  if (result.state !== "success" && result.state !== "recovery") return null;
  const base = TODO_BASE_PATH[actor.area];
  return (
    <section className="todo-section" aria-labelledby="group-todo-title" data-testid="group-todo">
      <h2 id="group-todo-title">Teendők</h2>
      {result.data.items.length === 0 ? (
        <p className="todo-empty" role="status" data-testid="group-todo-empty">
          Most nincs nyitott teendő.
        </p>
      ) : (
        <ul className="todo-list" aria-label="A csoport teendői">
          {result.data.items.map((card) => (
            <li key={card.id} className="todo-row" data-testid={`group-todo-${card.id}`}>
              <div className="todo-row-head">
                <StateBadge card={card} />
              </div>
              <h3 className="todo-title">
                <a href={`${base}/${card.id}`}>{card.topic}</a>
              </h3>
            </li>
          ))}
        </ul>
      )}
      <p className="parent-page-actions">
        <a href={`${base}?felelos=${groupId}`} data-testid="group-todo-all-link">
          Összes teendő
        </a>
      </p>
    </section>
  );
}

/* ---------- The pull list ---------- */

/**
 * "Teendők hozzáadása" on an event (BR185, W3): the open tasks with a checkbox each. Two reads: the event (for its title,
 * its group and whether the caller manages it) and the task list. A person who does not manage the event reads the
 * denied state.
 */
export async function TodoPullScreen({
  actor,
  eventId,
}: Readonly<{ actor: TodoActor; eventId: string }>) {
  const events = await resolveEventFacade();
  const todo = await resolveTodoFacade();
  const detail = events ? await events.detail(actor.session, actor.scope, eventId) : undefined;
  const event =
    detail && (detail.state === "success" || detail.state === "recovery") ? detail.data : undefined;
  const managed = event?.caller.canManage === true && actor.area !== "teacher";
  const list: ApplicationResult<TodoListModel> =
    todo && managed ? await todo.list(actor.session, actor.scope, {}) : terminalFailure();
  const back = `/${actor.area}/esemenyek/${eventId}`;
  return (
    <section className="parent-page todo-page" data-testid="todo-pull-page">
      <p className="parent-page-actions">
        <a href={back} data-testid="todo-pull-back-link">
          Vissza az eseményhez
        </a>
      </p>
      {!event || !managed ? (
        <FormDenied testId="todo-pull-denied" />
      ) : event.event.isOpen === false ? (
        <section className="parent-state" role="status" data-testid="todo-pull-closed">
          <h2>{event.event.title}</h2>
          <p>Ez az esemény már le van zárva, nem vehető fel rá teendő.</p>
        </section>
      ) : (
        <>
          <header className="todo-header">
            <h1 tabIndex={-1}>Teendők hozzáadása</h1>
          </header>
          <p className="todo-meta">{event.event.title}</p>
          <ParentStatePanel
            result={list}
            emptyMessage="Most nincs nyitott teendő."
            testId="todo-pull-state"
          >
            {(model) => (
              <PullForm
                eventId={eventId}
                groupId={event.event.groupId}
                rows={model.items
                  .filter((card) => !card.isDone)
                  .map((card): TodoPullRow => {
                    const state = todoState(card);
                    return {
                      id: card.id,
                      version: card.version,
                      topic: card.topic,
                      stateLabel: state.label,
                      stateIcon: symbol(state.icon),
                      meta: [card.ownerLabel, metaLine(card)].filter(Boolean).join(" • "),
                      onEvent: card.onEvent,
                    };
                  })}
              />
            )}
          </ParentStatePanel>
        </>
      )}
    </section>
  );
}
