import type {
  AnimalCalendarModel,
  AnimalFairShareModel,
  AnimalSlotItem,
  AnimalSlotsModel,
  ApplicationResult,
  InfoLink,
} from "../../src/application/index.ts";
import { terminalFailure } from "../../src/application/results.ts";
import { formatLongDay, HOLD_REASON_TEXT } from "../../src/application/rota-format.ts";
import { STATUS_ICON_CHARACTERS, type StatusSymbol } from "../../src/application/status-labels.ts";
import { StatusBadge } from "../../src/runtime/StatusBadge.tsx";
import { ParentStatePanel } from "../szulo/_components/ParentStatePanel.tsx";
import { CalendarForm, CreateSlotsForm, GiveUpForm, SignUpForm } from "./AnimalForms.tsx";
import { resolveAnimalCareFacade } from "./facade.ts";
import type { SessionContext } from "../../src/application/index.ts";
import type { Scope } from "../../src/access/index.ts";
import { resolveRotaFacade } from "../_identity/rota-facade.ts";

const symbol = (icon: keyof typeof STATUS_ICON_CHARACTERS): StatusSymbol => ({
  icon,
  character: STATUS_ICON_CHARACTERS[icon],
});

const PART_LABEL = { morning: "Reggel", afternoon: "Délután" } as const;
const MESSAGES = {
  jelentkezes: "Az időpontot elvállaltad.",
  lemondas: "Az időpontot lemondtad.",
} as const;

function mergeLinks(a: readonly InfoLink[], b: readonly InfoLink[]): readonly InfoLink[] {
  return [...a, ...b.filter((link) => !a.some((other) => other.key === link.key))];
}

function InfoLinks({ links }: Readonly<{ links: readonly InfoLink[] }>) {
  if (links.length === 0) return null;
  return (
    <p className="parent-notice" data-testid="animal-info-links">
      Tudnivalók:{" "}
      {links.map((link, index) => (
        <span key={link.key}>
          {index > 0 && ", "}
          <a href={`/informacio#${link.key}`}>{link.title}</a>
        </span>
      ))}
    </p>
  );
}

function SlotCell({
  slot,
  dayText,
  readOnly,
}: Readonly<{ slot: AnimalSlotItem; dayText: string; readOnly: boolean }>) {
  const anchor = `slot-${slot.slotDate}-${slot.part}`;
  const free = slot.familyName === undefined;
  return (
    <div
      id={anchor}
      className="parent-animal-slot"
      tabIndex={-1}
      data-testid={`animal-slot-${slot.slotDate}-${slot.part}`}
    >
      <h4>
        {PART_LABEL[slot.part]} <span className="parent-animal-time">{slot.startTime}</span>
      </h4>
      {slot.cancelled ? (
        <StatusBadge label="Elmarad" symbol={symbol("ring")} />
      ) : free ? (
        slot.started ? (
          <StatusBadge label="Lezárva" symbol={symbol("ring")} />
        ) : readOnly ? (
          <StatusBadge label="Szabad" symbol={symbol("check")} />
        ) : slot.mayHold ? (
          <>
            <StatusBadge label="Szabad" symbol={symbol("check")} />
            <SignUpForm slot={slot} dayText={dayText} anchor={anchor} />
          </>
        ) : (
          <>
            <StatusBadge label="Szabad" symbol={symbol("check")} />
            <p className="form-hint" data-testid={`animal-hold-${slot.slotDate}-${slot.part}`}>
              {HOLD_REASON_TEXT[slot.holdReason as keyof typeof HOLD_REASON_TEXT] ??
                "Erre az időpontra most nem jelentkezhetsz."}
            </p>
          </>
        )
      ) : slot.mine ? (
        <>
          <p>
            <span className="parent-chip" data-testid={`animal-mine-${slot.slotDate}-${slot.part}`}>
              Ti
            </span>{" "}
            {slot.familyName}
          </p>
          {slot.canGiveUp && <GiveUpForm slot={slot} dayText={dayText} anchor={anchor} />}
          {!slot.canGiveUp && slot.inSwap && <p className="form-hint">Csere folyamatban.</p>}
          {!slot.canGiveUp && !slot.inSwap && !slot.started && (
            <p className="form-hint" data-testid={`animal-swap-${slot.slotDate}-${slot.part}`}>
              A kezdésig 24 óránál kevesebb van hátra.{" "}
              <a
                href={`/szulo/feladatok/${slot.dutyId}/csere`}
                aria-label={`Csere kérése: ${dayText} ${PART_LABEL[slot.part].toLowerCase()}`}
              >
                Csere kérése
              </a>
            </p>
          )}
        </>
      ) : (
        <>
          <StatusBadge label="Már foglalt" symbol={symbol("ring")} />
          <p>{slot.familyName}</p>
        </>
      )}
    </div>
  );
}

function groupByDay(slots: readonly AnimalSlotItem[]) {
  const days = new Map<string, AnimalSlotItem[]>();
  for (const slot of slots) days.set(slot.slotDate, [...(days.get(slot.slotDate) ?? []), slot]);
  return [...days.entries()].map(([date, items]) => ({
    date,
    items: [...items].sort((a, b) => (a.part === b.part ? 0 : a.part === "morning" ? -1 : 1)),
  }));
}

function FairShare({ model }: Readonly<{ model: AnimalFairShareModel }>) {
  const points = (value: number) => value.toLocaleString("hu-HU", { maximumFractionDigits: 1 });
  return (
    <section
      className="parent-animal-share"
      aria-labelledby="animal-share-title"
      data-testid="animal-fair-share"
    >
      <h2 id="animal-share-title">Igazságos teherviselés</h2>
      {model.mine && (
        <p data-testid="animal-share-mine">
          A ti családotok eddig <strong>{model.mine.count}</strong> időpontot vállalt; az éves átlag{" "}
          {points(model.average)}.
        </p>
      )}
      <details>
        <summary>Minden család</summary>
        <ul className="parent-animal-families" data-testid="animal-share-families">
          {model.families.map((family) => (
            <li key={family.familyName} data-testid="animal-share-family">
              {family.mine ? <strong>{family.familyName} (Ti)</strong> : family.familyName}:{" "}
              {family.count}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

/**
 * The animal-care sign-up page: the fair-share panel, then two weeks of days with a morning and an afternoon slot each
 * (BR80 to BR85). A taken slot shows the family name only; a failed read shows an error, never an empty week.
 */
export async function AnimalCareScreen({
  session,
  scope,
  notice,
  readOnly = false,
}: Readonly<{
  session: SessionContext;
  scope: Scope;
  notice: keyof typeof MESSAGES | undefined;
  /** A teacher only reads who looks after the animals: no sign-up, give-up or swap controls. */
  readOnly?: boolean;
}>) {
  const [animal, rota] = await Promise.all([resolveAnimalCareFacade(), resolveRotaFacade()]);
  const overview = rota ? await rota.getOverview(session, scope) : terminalFailure();
  const yearId =
    overview.state === "success" || overview.state === "recovery"
      ? overview.data.schoolYear?.id
      : undefined;
  let slots: ApplicationResult<AnimalSlotsModel> = terminalFailure();
  let share: ApplicationResult<AnimalFairShareModel> = terminalFailure();
  if (animal && yearId) {
    [slots, share] = await Promise.all([
      animal.slots(session, scope, { schoolYearId: yearId }),
      animal.fairShare(session, scope, yearId),
    ]);
  }
  const noYear = overview.state !== "success" && overview.state !== "recovery" ? false : !yearId;
  return (
    <section className="parent-page parent-animal-page" data-testid="animal-page">
      <header>
        <p className="eyebrow">Közösségi élet</p>
        <h1 tabIndex={-1}>Állatgondozás</h1>
        <p>
          {readOnly
            ? "Napi reggeli és délutáni állatgondozás: melyik családé melyik időpont."
            : "Napi reggeli és délutáni állatgondozás: vállalj egy időpontot, vagy mondd le a sajátodat."}
        </p>
      </header>
      <div role="status" aria-live="polite" data-testid="animal-status">
        {notice && (
          <p className="parent-action-state parent-action-state-success">{MESSAGES[notice]}</p>
        )}
      </div>
      {noYear ? (
        <p className="parent-empty" role="status" data-testid="animal-no-year">
          Még nincs tanév, ezért időpont sincs.
        </p>
      ) : (
        <>
          <ParentStatePanel
            result={share}
            emptyMessage="Még nincs adat."
            testId="animal-share-state"
          >
            {(model) => <FairShare model={model} />}
          </ParentStatePanel>
          <ParentStatePanel
            result={slots}
            emptyMessage="Még nincsenek időpontok."
            testId="animal-slots-state"
          >
            {(model) =>
              model.slots.length === 0 ? (
                <p className="parent-empty" role="status" data-testid="animal-empty">
                  A következő hetekre még nincsenek időpontok.
                </p>
              ) : (
                <>
                  <InfoLinks links={mergeLinks(model.infoLinksMorning, model.infoLinksAfternoon)} />
                  <ul className="parent-animal-days" aria-label="Napok" data-testid="animal-days">
                    {groupByDay(model.slots).map((day) => (
                      <li key={day.date} className="parent-animal-day">
                        <h3>{formatLongDay(day.date)}</h3>
                        <div className="parent-animal-slots">
                          {day.items.map((slot) => (
                            <SlotCell
                              key={slot.part}
                              slot={slot}
                              dayText={formatLongDay(day.date)}
                              readOnly={readOnly}
                            />
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )
            }
          </ParentStatePanel>
        </>
      )}
    </section>
  );
}

/** The settings of a school year for a super admin: the two times, the alert group and the slot creation (BR80). */
export async function AnimalSettingsScreen({
  session,
  scope,
  schoolYearId,
  schoolYearName,
}: Readonly<{
  session: SessionContext;
  scope: Scope;
  schoolYearId: string | undefined;
  schoolYearName: string | undefined;
}>) {
  const animal = await resolveAnimalCareFacade();
  const result: ApplicationResult<AnimalCalendarModel> =
    animal && schoolYearId
      ? await animal.calendar(session, scope, schoolYearId)
      : terminalFailure();
  return (
    <section className="admin-page admin-animal-page" data-testid="admin-animal-page">
      <header>
        <p className="eyebrow">Adminisztráció{schoolYearName ? ` · ${schoolYearName}` : ""}</p>
        <h1 tabIndex={-1}>Állatgondozás</h1>
        <p>
          A tanév két kezdési ideje és az értesített csoport. A mentés után hozhatók létre az
          időpontok.
        </p>
      </header>
      {!schoolYearId ? (
        <p className="parent-empty" role="status" data-testid="admin-animal-no-year">
          Még nincs tanév. Vegyen fel egyet a Nyilvántartások oldalon.
        </p>
      ) : (
        <ParentStatePanel result={result} emptyMessage="Nincs adat." testId="admin-animal-state">
          {(calendar) => (
            <>
              <CalendarForm calendar={calendar} />
              <section className="admin-animal-slots" data-testid="admin-animal-slots">
                <h2>Időpontok</h2>
                <p data-testid="admin-animal-slot-count">
                  {calendar.exists
                    ? `Eddig ${calendar.slotCount} időpont van.`
                    : "Előbb mentsd el a beállításokat."}
                </p>
                {calendar.exists && <CreateSlotsForm calendar={calendar} />}
              </section>
            </>
          )}
        </ParentStatePanel>
      )}
    </section>
  );
}
