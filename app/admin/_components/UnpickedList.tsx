import type {
  ApplicationResult,
  UnpickedItem,
  UnpickedListModel,
} from "../../../src/application/index.ts";
import {
  formatLongDay,
  formatWeekRange,
  ROTA_ASSIGN_TEXT,
  ROTA_JOB_LABELS,
  WEEKEND_SLOT_LABELS,
} from "../../../src/application/rota-format.ts";
import { StatusBadge } from "../../../src/runtime/StatusBadge.tsx";
import { assignSlotAction } from "../rota-actions.ts";
import { AdminMutationForm } from "./AdminMutationForm.tsx";

function Item({ item, missed }: Readonly<{ item: UnpickedItem; missed: boolean }>) {
  const first = item.freeSlots[0];
  return (
    <li
      className="admin-unpicked-item"
      data-testid={`admin-unpicked-${item.rotaWeekId}-${item.job}`}
    >
      <div className="admin-unpicked-week">
        <strong>{formatWeekRange(item.weekStart)}</strong>
        <span className="form-hint">{ROTA_JOB_LABELS[item.job]}</span>
        <StatusBadge
          label={missed ? "Nem választott időben" : "Még nincs választva"}
          symbol={{ icon: "warning", character: "" }}
        />
      </div>
      <div className="admin-unpicked-families">
        <p>
          <span className="form-hint">Választó család</span>
          <strong>{item.familyDisplayName}</strong>
        </p>
        <p>
          <span className="form-hint">Hétvégi család</span>
          <strong>{item.weekendFamilyDisplayName}</strong>
        </p>
      </div>
      {item.changeUntil && (
        <p className="form-hint">
          Módosítható eddig: {formatLongDay(item.changeUntil.slice(0, 10))}
        </p>
      )}
      {first ? (
        <AdminMutationForm
          action={assignSlotAction}
          submitLabel={ROTA_ASSIGN_TEXT.submit}
          testId={`admin-unpicked-form-${item.rotaWeekId}-${item.job}`}
        >
          <input type="hidden" name="rotaWeekId" value={item.rotaWeekId} />
          <input
            type="hidden"
            name="idempotencyKey"
            value={`assign:${item.rotaWeekId}:${item.job}:v${first.placeVersion}`}
          />
          <label className="visually-hidden" htmlFor={`slot-${item.rotaWeekId}-${item.job}`}>
            {ROTA_ASSIGN_TEXT.slotLabel}: {formatWeekRange(item.weekStart)},{" "}
            {item.familyDisplayName}
          </label>
          <select
            id={`slot-${item.rotaWeekId}-${item.job}`}
            name="slot"
            defaultValue={`${first.slot}:${first.placeVersion}`}
            data-testid={`admin-unpicked-select-${item.rotaWeekId}-${item.job}`}
          >
            {item.freeSlots.map((slot) => (
              <option key={slot.slot} value={`${slot.slot}:${slot.placeVersion}`}>
                {WEEKEND_SLOT_LABELS[slot.slot]}
              </option>
            ))}
          </select>
        </AdminMutationForm>
      ) : (
        <p className="form-hint">{ROTA_ASSIGN_TEXT.noFreeSlot}</p>
      )}
    </li>
  );
}

/**
 * "Ki nem választott?" (BR63.8): the picks that are owed and not yet made, and those nobody made in time, each with
 * the free openings and closings and a way to assign one until the weekend starts (BR63.6). A super admin's alone:
 * for anyone else the read is refused and the section is left out of the page.
 */
export function UnpickedList({
  result,
}: Readonly<{ result: ApplicationResult<UnpickedListModel> }>) {
  if (result.state === "denied" || result.state === "invalidated") return null;
  if (result.state !== "success" && result.state !== "recovery") {
    return (
      <section className="admin-rota-state" role="alert" data-testid="admin-unpicked-error">
        <h2>{ROTA_ASSIGN_TEXT.title}</h2>
        <p>A lista most nem tölthető be. Próbálja meg később.</p>
      </section>
    );
  }
  const { items, missed } = result.data;
  return (
    <section className="admin-rota-panel" data-testid="admin-unpicked">
      <h2>{ROTA_ASSIGN_TEXT.title}</h2>
      <p className="form-hint">{ROTA_ASSIGN_TEXT.intro}</p>
      {items.length === 0 && missed.length === 0 ? (
        <p className="admin-unpicked-empty" role="status" data-testid="admin-unpicked-empty">
          <strong>{ROTA_ASSIGN_TEXT.emptyTitle}</strong> {ROTA_ASSIGN_TEXT.empty}
        </p>
      ) : (
        <>
          {items.length > 0 && (
            <ul className="admin-unpicked-list" data-testid="admin-unpicked-open">
              {items.map((item) => (
                <Item key={`${item.rotaWeekId}:${item.job}`} item={item} missed={false} />
              ))}
            </ul>
          )}
          {missed.length > 0 && (
            <>
              <h3>{ROTA_ASSIGN_TEXT.missedTitle}</h3>
              <ul className="admin-unpicked-list" data-testid="admin-unpicked-missed">
                {missed.map((item) => (
                  <Item key={`${item.rotaWeekId}:${item.job}`} item={item} missed />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
