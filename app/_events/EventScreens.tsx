import type {
  ApplicationResult,
  EventDetailModel,
  EventListItem,
  EventListModel,
  EventRoleModel,
  FoodCategory,
} from "../../src/application/index.ts";
import { FOOD_CATEGORIES } from "../../src/application/contracts.ts";
import {
  FOOD_CATEGORY_LABELS,
  FORMER_HOLDER_TEXT,
  formatDeadline,
  formatEventDay,
  formatEventRange,
  formatEventTime,
  ingredientWords,
} from "../../src/application/event-format.ts";
import { terminalFailure } from "../../src/application/results.ts";
import { STATUS_ICON_CHARACTERS, type StatusSymbol } from "../../src/application/status-labels.ts";
import { StatusBadge } from "../../src/runtime/StatusBadge.tsx";
import { ChecklistBlock } from "../_checklists/ChecklistScreens.tsx";
import { resolveChecklistFacade } from "../_checklists/facade.ts";
import { ParentStatePanel } from "../szulo/_components/ParentStatePanel.tsx";
import { resolveDirectoryFacade } from "../szulo/_lib/facade.ts";
import { resolveWorkingGroupFacade } from "../teacher/_lib/facade.ts";
import type { EventActor } from "./actor.ts";
import {
  CancelEventPanel,
  EventCoreForm,
  NoticesForm,
  OfferAddForm,
  OfferChangeForm,
  PastEventsToggle,
  RemoveRoleForm,
  RoleForm,
  SignupAddForm,
  SignupChangeForm,
  TaleForm,
  WithdrawOfferForm,
  WithdrawSignupForm,
  type GroupOption,
  type ParentOption,
} from "./EventForms.tsx";
import { resolveEventFacade } from "./facade.ts";

const symbol = (icon: keyof typeof STATUS_ICON_CHARACTERS): StatusSymbol => ({
  icon,
  character: STATUS_ICON_CHARACTERS[icon],
});

const COMMUNITY_CHIP = "Közösségi";

/** A short line saying why an event takes no new sign-up, or nothing while it is open. */
function closedReason(event: EventDetailModel["event"]): string | undefined {
  if (event.status === "cancelled") return "Az esemény elmarad, új jelentkezés nem lehetséges.";
  if (event.isFinished) return "Az esemény véget ért, új jelentkezés nem lehetséges.";
  if (!event.isOpen) return "A jelentkezés lezárult.";
  return undefined;
}

/* ---------- List ---------- */

function EventCard({ item, basePath }: Readonly<{ item: EventListItem; basePath: string }>) {
  const cancelled = item.status === "cancelled";
  return (
    <li
      className={`parent-event-card${cancelled ? " parent-event-card-cancelled" : ""}`}
      data-testid={`event-card-${item.id}`}
    >
      <p className="parent-event-chips">
        <span className="parent-event-chip" data-testid={`event-group-${item.id}`}>
          {item.groupName ?? COMMUNITY_CHIP}
        </span>
        {cancelled && (
          <StatusBadge
            label="Elmarad"
            symbol={symbol("cross")}
            testId={`event-cancelled-${item.id}`}
          />
        )}
        {item.isSignedUp && (
          <StatusBadge
            label="Jelentkeztél"
            symbol={symbol("check")}
            className="parent-event-signed-up"
            testId={`event-signed-up-${item.id}`}
          />
        )}
        {!cancelled && item.isFinished && (
          <StatusBadge
            label="Véget ért"
            symbol={symbol("ring")}
            testId={`event-ended-${item.id}`}
          />
        )}
      </p>
      <h2 className="parent-event-title">
        <a href={`${basePath}/${item.id}`} data-testid={`event-link-${item.id}`}>
          {item.title}
        </a>
      </h2>
      <p className={`parent-event-when${cancelled ? " parent-event-struck" : ""}`}>
        {formatEventRange(item.startsAt, item.endsAt)}
      </p>
      {item.location && <p className="parent-event-where">{item.location}</p>}
      <p className="parent-event-count" data-testid={`event-count-${item.id}`}>
        {item.signupCount} jelentkező
      </p>
    </li>
  );
}

function EventCards({
  items,
  basePath,
  label,
}: Readonly<{ items: readonly EventListItem[]; basePath: string; label: string }>) {
  return (
    <ul className="parent-event-list" aria-label={label} data-testid="event-list">
      {items.map((item) => (
        <EventCard key={item.id} item={item} basePath={basePath} />
      ))}
    </ul>
  );
}

/** Whether the list says the caller manages some events: the whole community or at least one group. */
function managesSome(model: EventListModel): boolean {
  return model.canManageCommunity || model.managedGroupIds.length > 0 || model.canManage === true;
}

/**
 * The events list: events that have not ended, soonest first; with the switch also the finished ones, newest first
 * (BR104.2). Managers get the "Új esemény" link.
 */
export async function EventListScreen({
  actor,
  past,
}: Readonly<{ actor: EventActor; past: boolean }>) {
  const events = await resolveEventFacade();
  const upcoming: ApplicationResult<EventListModel> = events
    ? await events.list(actor.session, actor.scope, { past: false })
    : terminalFailure();
  const earlier: ApplicationResult<EventListModel> | undefined =
    past && events ? await events.list(actor.session, actor.scope, { past: true }) : undefined;
  const earlierItems =
    earlier && (earlier.state === "success" || earlier.state === "recovery")
      ? earlier.data.items
      : [];
  return (
    <section className="parent-page parent-event-page" data-testid="event-list-page">
      <header className="parent-event-header">
        <p className="eyebrow">Közösségi élet</p>
        <h1 tabIndex={-1}>Események</h1>
        {(upcoming.state === "success" || upcoming.state === "recovery") &&
          actor.area !== "teacher" &&
          managesSome(upcoming.data) && (
            <p className="parent-page-actions">
              <a href={`${actor.basePath}/uj`} data-testid="event-new-link">
                Új esemény
              </a>
            </p>
          )}
      </header>
      <PastEventsToggle action={actor.basePath} checked={past} />
      <ParentStatePanel
        result={upcoming}
        emptyMessage="Nincs közelgő esemény."
        testId="event-list-state"
      >
        {(model) => (
          <>
            {model.items.length === 0 ? (
              <p className="parent-event-empty" role="status" data-testid="event-list-empty">
                Nincs közelgő esemény.
              </p>
            ) : (
              <EventCards items={model.items} basePath={actor.basePath} label="Közelgő események" />
            )}
            {past && (
              <section aria-labelledby="event-earlier-title" data-testid="event-earlier">
                <h2 id="event-earlier-title" className="parent-event-subtitle">
                  Korábbi események
                </h2>
                {earlierItems.length === 0 ? (
                  <p className="parent-event-empty" role="status" data-testid="event-earlier-empty">
                    Nincs korábbi esemény.
                  </p>
                ) : (
                  <EventCards
                    items={earlierItems}
                    basePath={actor.basePath}
                    label="Korábbi események"
                  />
                )}
              </section>
            )}
          </>
        )}
      </ParentStatePanel>
    </section>
  );
}

/* ---------- Group page section ---------- */

/** The events of one working group, read for its page (C14); a group page shows them under its members. */
export async function loadGroupEvents(
  actor: EventActor,
  groupId: string,
): Promise<ApplicationResult<EventListModel>> {
  const events = await resolveEventFacade();
  return events ? events.listForGroup(actor.session, actor.scope, groupId) : terminalFailure();
}

/**
 * The events of one working group, for its page: the open events, a link to all of them and, for a coordinator or a
 * super admin, the link to a new one (BR119). A group that cannot be read shows no section.
 */
export function GroupEventsSection({
  actor,
  groupId,
  result,
}: Readonly<{
  actor: EventActor;
  groupId: string;
  result: ApplicationResult<EventListModel>;
}>) {
  if (result.state !== "success" && result.state !== "recovery") return null;
  const model = result.data;
  return (
    <section
      className="parent-group-events"
      aria-labelledby="parent-group-events-title"
      data-testid="group-events"
    >
      <h2 id="parent-group-events-title">Események</h2>
      {model.items.length === 0 ? (
        <p className="parent-event-empty" role="status" data-testid="group-events-empty">
          Nincs közelgő esemény.
        </p>
      ) : (
        <EventCards items={model.items} basePath={actor.basePath} label="A csoport eseményei" />
      )}
      <p className="parent-page-actions">
        <a href={actor.basePath} data-testid="group-events-all-link">
          Összes esemény
        </a>
        {model.canManage === true && actor.area !== "teacher" && (
          <a href={`${actor.basePath}/uj?csoport=${groupId}`} data-testid="group-events-new-link">
            Új esemény
          </a>
        )}
        {model.canManage === true && actor.area !== "teacher" && (
          <a
            href={`/${actor.area}/munkacsoportok/${groupId}/sablonok`}
            data-testid="group-templates-link"
          >
            Sablonok
          </a>
        )}
      </p>
    </section>
  );
}

/* ---------- Detail ---------- */

function RolesList({ roles }: Readonly<{ roles: readonly EventRoleModel[] }>) {
  return (
    <dl className="parent-event-roles" data-testid="event-roles">
      {roles.map((role) => (
        <div key={role.id} data-testid={`event-role-${role.id}`}>
          <dt>
            {role.name}
            {role.isOrganiser && <span className="parent-event-chip"> Főszervező</span>}
          </dt>
          <dd>{role.kind === "former" ? FORMER_HOLDER_TEXT : role.displayName}</dd>
        </div>
      ))}
    </dl>
  );
}

function FoodSection({ actor, detail }: Readonly<{ actor: EventActor; detail: EventDetailModel }>) {
  const { event, food, caller } = detail;
  const byCategory = new Map(food.categories.map((entry) => [entry.category, entry.offers]));
  const shown = FOOD_CATEGORIES.filter((category) => (byCategory.get(category) ?? []).length > 0);
  if (!food.on && shown.length === 0) return null;
  const groupId = event.groupId;
  const canAdd = actor.area === "szulo" && caller.canSignUp && food.on && event.isOpen;
  return (
    <section
      className="parent-event-section"
      aria-labelledby="event-food-title"
      data-testid="event-food"
    >
      <h2 id="event-food-title">Ételfelajánlások</h2>
      {shown.length === 0 ? (
        <p className="parent-event-empty" role="status" data-testid="event-food-empty">
          Még nincs felajánlás.
        </p>
      ) : (
        shown.map((category: FoodCategory) => (
          <div key={category} className="parent-event-food-group">
            <h3>{FOOD_CATEGORY_LABELS[category]}</h3>
            <ul>
              {(byCategory.get(category) ?? []).map((offer) => {
                const ticks = ingredientWords(offer);
                return (
                  <li key={offer.id} data-testid={`event-offer-${offer.id}`}>
                    <span>
                      {offer.text}{" "}
                      <span className="parent-event-muted">({offer.parentDisplayName})</span>
                    </span>
                    {ticks !== "" && (
                      <span className="parent-event-muted"> Tartalmaz: {ticks.toLowerCase()}</span>
                    )}
                    {offer.isOwn && actor.area === "szulo" && event.isOpen && (
                      <details
                        className="parent-event-change"
                        data-testid={`event-offer-edit-${offer.id}`}
                      >
                        <summary>Módosítás</summary>
                        <OfferChangeForm
                          area={actor.area}
                          eventId={event.id}
                          category={category}
                          offer={offer}
                        />
                      </details>
                    )}
                    {(offer.isOwn && actor.area === "szulo") || caller.canManage ? (
                      <WithdrawOfferForm
                        area={actor.area}
                        eventId={event.id}
                        groupId={groupId}
                        offer={offer}
                        asManager={!offer.isOwn}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
      {!food.on && (
        <p className="parent-notice" data-testid="event-food-off">
          Ennél az eseménynél új ételfelajánlás már nincs.
        </p>
      )}
      {canAdd && <OfferAddForm area={actor.area} eventId={event.id} />}
    </section>
  );
}

function SignupSection({
  actor,
  detail,
}: Readonly<{ actor: EventActor; detail: EventDetailModel }>) {
  const { event, signups, caller } = detail;
  const own = signups.filter((signup) => signup.isOwn);
  const reason = closedReason(event);
  const parentView = actor.area === "szulo" && caller.canSignUp;
  return (
    <>
      <section
        className="parent-event-section"
        aria-labelledby="event-signup-title"
        data-testid="event-signup"
      >
        <h2 id="event-signup-title">Jelentkezés</h2>
        {event.signupDeadline && (
          <p className="parent-event-deadline" data-testid="event-deadline">
            Jelentkezési határidő: {formatDeadline(event.signupDeadline)}
          </p>
        )}
        {reason && (
          <p className="parent-notice" role="status" data-testid="event-closed-state">
            {reason}
          </p>
        )}
        {parentView &&
          own.map((signup) => (
            <div
              key={signup.id}
              className="parent-event-own-signup"
              data-testid={`event-own-signup-${signup.id}`}
            >
              <StatusBadge label="Jelentkeztél" symbol={symbol("check")} />
              {signup.chosenAt && (
                <p>
                  Választott időpont: {formatEventDay(signup.chosenAt)},{" "}
                  {formatEventTime(signup.chosenAt)}
                </p>
              )}
              {signup.note && <p>Megjegyzés: {signup.note}</p>}
              {event.isOpen && <SignupChangeForm area={actor.area} event={event} signup={signup} />}
              <WithdrawSignupForm
                area={actor.area}
                eventId={event.id}
                groupId={event.groupId}
                signup={signup}
                asManager={false}
              />
            </div>
          ))}
        {parentView && event.isOpen && <SignupAddForm area={actor.area} event={event} />}
        {actor.area !== "szulo" && !event.isFinished && event.status !== "cancelled" && (
          <p className="parent-notice" data-testid="event-signup-elsewhere">
            Jelentkezni a szülői nézetben lehet.
          </p>
        )}
      </section>
      <section
        className="parent-event-section"
        aria-labelledby="event-signups-title"
        data-testid="event-signups"
      >
        <h2 id="event-signups-title">
          Jelentkezők <span className="parent-event-chip">{signups.length}</span>
        </h2>
        {signups.length === 0 ? (
          <p className="parent-event-empty" role="status" data-testid="event-signups-empty">
            Még senki nem jelentkezett.
          </p>
        ) : (
          <ul className="parent-event-signup-list">
            {signups.map((signup) => (
              <li key={signup.id} data-testid={`event-signup-${signup.id}`}>
                <strong>{signup.parentDisplayName}</strong>{" "}
                <span className="parent-event-muted">({signup.familyDisplayName})</span>
                {signup.chosenAt && (
                  <p className="parent-event-muted">
                    {formatEventDay(signup.chosenAt)}, {formatEventTime(signup.chosenAt)}
                  </p>
                )}
                {signup.note && <p>{signup.note}</p>}
                {caller.canManage && !signup.isOwn && (
                  <WithdrawSignupForm
                    area={actor.area}
                    eventId={event.id}
                    groupId={event.groupId}
                    signup={signup}
                    asManager
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** One event page: notices, roles, the year's tale, sign-up, sign-ups, food offers and, for a manager, the strip (BR104 to BR124). */
export async function EventDetailScreen({
  actor,
  eventId,
}: Readonly<{ actor: EventActor; eventId: string }>) {
  const events = await resolveEventFacade();
  const result = events
    ? await events.detail(actor.session, actor.scope, eventId)
    : terminalFailure();
  return (
    <section className="parent-page parent-event-page" data-testid="event-detail-page">
      <a href={actor.basePath} className="parent-back-link" data-testid="event-back-link">
        Vissza az eseményekhez
      </a>
      <ParentStatePanel
        result={result}
        emptyMessage="Az esemény nem érhető el."
        testId="event-detail"
      >
        {(detail) => {
          const { event } = detail;
          const cancelled = event.status === "cancelled";
          return (
            <>
              <header className="parent-detail-header parent-event-header">
                <p className="parent-event-chips">
                  <span className="parent-event-chip">{event.groupName ?? COMMUNITY_CHIP}</span>
                  {cancelled ? (
                    <StatusBadge label="Elmarad" symbol={symbol("cross")} testId="event-state" />
                  ) : event.isFinished ? (
                    <StatusBadge label="Véget ért" symbol={symbol("ring")} testId="event-state" />
                  ) : event.isOpen ? (
                    <StatusBadge
                      label="Nyitott esemény"
                      symbol={symbol("check")}
                      testId="event-state"
                    />
                  ) : (
                    <StatusBadge
                      label="Lezárt jelentkezés"
                      symbol={symbol("clock")}
                      testId="event-state"
                    />
                  )}
                </p>
                <h1 tabIndex={-1}>{event.title}</h1>
              </header>
              <dl className="parent-detail-grid" data-testid="event-facts">
                <div>
                  <dt>Időpont</dt>
                  <dd className={cancelled ? "parent-event-struck" : undefined}>
                    {formatEventRange(event.startsAt, event.endsAt)}
                  </dd>
                </div>
                {event.location && (
                  <div>
                    <dt>Helyszín</dt>
                    <dd>{event.location}</dd>
                  </div>
                )}
              </dl>
              {detail.notices.length > 0 && (
                <section className="parent-note-panel" data-testid="event-notices">
                  <h2>Tudnivalók</h2>
                  <ul>
                    {detail.notices.map((notice, index) => (
                      <li key={`${index}-${notice}`}>{notice}</li>
                    ))}
                  </ul>
                </section>
              )}
              {detail.roles.length > 0 && (
                <section className="parent-event-section" aria-labelledby="event-roles-title">
                  <h2 id="event-roles-title">Szerepek és felelősök</h2>
                  <RolesList roles={detail.roles} />
                </section>
              )}
              {event.tale && (
                <details className="parent-event-tale" data-testid="event-tale">
                  <summary>Az év meséje</summary>
                  <p>{event.tale}</p>
                </details>
              )}
              <SignupSection actor={actor} detail={detail} />
              <FoodSection actor={actor} detail={detail} />
              <ChecklistBlock actor={actor} eventId={event.id} groupId={event.groupId} />
              {detail.caller.canManage && actor.area !== "teacher" && (
                <section
                  className="parent-event-section parent-event-manager"
                  aria-labelledby="event-manager-title"
                  data-testid="event-manager-strip"
                >
                  <h2 id="event-manager-title">Szervezői sáv</h2>
                  <p className="parent-page-actions">
                    <a
                      href={`${actor.basePath}/${event.id}/szerkesztes`}
                      data-testid="event-edit-link"
                    >
                      Szerkesztés
                    </a>
                  </p>
                  {!cancelled && !event.isFinished && (
                    <CancelEventPanel area={actor.area} event={event} />
                  )}
                </section>
              )}
            </>
          );
        }}
      </ParentStatePanel>
    </section>
  );
}

/* ---------- Form ---------- */

async function groupOptions(
  actor: EventActor,
  list: EventListModel | undefined,
  preset: string | undefined,
): Promise<GroupOption[]> {
  const groups = await resolveWorkingGroupFacade();
  const result = groups ? await groups.list(actor.session, actor.scope) : undefined;
  const all =
    result && (result.state === "success" || result.state === "recovery") ? result.data.items : [];
  const community = list?.canManageCommunity === true;
  const allowed = all.filter((group) => community || list?.managedGroupIds.includes(group.id));
  const options: GroupOption[] = [
    ...(community ? [{ value: "community", label: "Egész közösség" }] : []),
    ...allowed.map((group) => ({ value: group.id, label: group.name })),
  ];
  const first = options.findIndex((option) => option.value === preset);
  return first > 0 ? [options[first]!, ...options.filter((_, index) => index !== first)] : options;
}

async function parentOptions(actor: EventActor): Promise<ParentOption[]> {
  const directory = await resolveDirectoryFacade();
  const result = directory ? await directory.list(actor.session, actor.scope) : undefined;
  if (!result || (result.state !== "success" && result.state !== "recovery")) return [];
  return result.data.families
    .flatMap((family) =>
      family.parents.map((parent) => ({
        id: parent.id,
        name: `${parent.fullName} (${family.familyName})`,
      })),
    )
    .toSorted((a, b) => a.name.localeCompare(b.name, "hu"));
}

/**
 * The event form. A new event has the basic fields; once saved, the edit page adds the notices, the roles and the
 * year's tale, each saved on its own with the version it was shown with (BR101 to BR107).
 */
export async function EventFormScreen({
  actor,
  eventId,
  presetGroupId,
  saved,
}: Readonly<{
  actor: EventActor;
  eventId?: string;
  presetGroupId?: string;
  saved?: "uj" | "1";
}>) {
  const events = await resolveEventFacade();
  const list = events ? await events.list(actor.session, actor.scope) : undefined;
  const listModel =
    list && (list.state === "success" || list.state === "recovery") ? list.data : undefined;
  const detail =
    eventId && events ? await events.detail(actor.session, actor.scope, eventId) : undefined;
  const groups = await groupOptions(actor, listModel, presetGroupId);
  const checklists = eventId === undefined ? await resolveChecklistFacade() : undefined;
  const templateResult = checklists
    ? await checklists.templateOptions(actor.session, actor.scope)
    : undefined;
  const templates =
    templateResult && (templateResult.state === "success" || templateResult.state === "recovery")
      ? templateResult.data.items
      : [];
  const parents = eventId ? await parentOptions(actor) : [];
  const backHref = eventId ? `${actor.basePath}/${eventId}` : actor.basePath;
  const allowed =
    eventId === undefined
      ? listModel !== undefined &&
        (listModel.canManageCommunity || listModel.managedGroupIds.length > 0)
      : detail !== undefined &&
        (detail.state === "success" || detail.state === "recovery") &&
        detail.data.caller.canManage;
  return (
    <section className="parent-page parent-event-page" data-testid="event-form-page">
      <a href={backHref} className="parent-back-link" data-testid="event-form-back-link">
        {eventId ? "Vissza az eseményhez" : "Vissza az eseményekhez"}
      </a>
      <header className="parent-detail-header parent-event-header">
        <p className="eyebrow">Közösségi élet</p>
        <h1 tabIndex={-1}>{eventId ? "Esemény szerkesztése" : "Új esemény"}</h1>
      </header>
      {!allowed ? (
        <p className="parent-state" role="alert" data-testid="event-form-denied">
          Ezt az eseményt nem kezelheted.
        </p>
      ) : (
        <>
          {saved && (
            <p
              className="parent-action-state parent-action-state-success"
              role="status"
              data-testid="event-saved"
            >
              <strong>
                {saved === "uj"
                  ? "Az eseményt létrehoztuk. Alább megadhatod a tudnivalókat, a szerepeket és az év meséjét."
                  : "Az esemény mentése sikerült."}
              </strong>
            </p>
          )}
          {detail === undefined ? (
            <>
              <EventCoreForm area={actor.area} groups={groups} templates={templates} />
              <p className="form-hint">
                A tudnivalókat, a szerepeket és az év meséjét az esemény mentése után adhatod meg.
              </p>
            </>
          ) : (
            <ParentStatePanel
              result={detail}
              emptyMessage="Az esemény nem érhető el."
              testId="event-form"
            >
              {(model) => (
                <>
                  <section className="parent-event-section" aria-labelledby="event-core-title">
                    <h2 id="event-core-title">Alapadatok</h2>
                    <EventCoreForm area={actor.area} event={model.event} groups={groups} />
                  </section>
                  <section className="parent-event-section" aria-labelledby="event-notices-title">
                    <h2 id="event-notices-title">Tudnivalók és házirend</h2>
                    <NoticesForm area={actor.area} event={model.event} notices={model.notices} />
                  </section>
                  <RoleEditors actor={actor} detail={model} parents={parents} />
                  <section className="parent-event-section" aria-labelledby="event-tale-title">
                    <h2 id="event-tale-title">Az év meséje</h2>
                    <TaleForm area={actor.area} event={model.event} />
                  </section>
                </>
              )}
            </ParentStatePanel>
          )}
        </>
      )}
    </section>
  );
}

function RoleEditors({
  actor,
  detail,
  parents,
}: Readonly<{ actor: EventActor; detail: EventDetailModel; parents: readonly ParentOption[] }>) {
  return (
    <section
      className="parent-event-section"
      aria-labelledby="event-roles-edit-title"
      data-testid="event-role-editor"
    >
      <h2 id="event-roles-edit-title">Szerepek és felelősök</h2>
      {detail.roles.map((role) => (
        <div key={role.id} className="parent-event-role-edit">
          <RoleForm area={actor.area} event={detail.event} role={role} parents={parents} />
          <RemoveRoleForm area={actor.area} event={detail.event} role={role} />
        </div>
      ))}
      <h3>Új szerep</h3>
      <RoleForm area={actor.area} event={detail.event} parents={parents} />
    </section>
  );
}
