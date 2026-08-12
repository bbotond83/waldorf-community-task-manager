import Link from "next/link";
import { STAFF_GROUPS, UNGRANTED_STAFF_GROUP } from "../../../../src/staff-web/index.ts";
import type { StaffFilters } from "../../_lib/filters.ts";

export function ScheduleFilter({ filters }: Readonly<{ filters: StaffFilters }>) {
  return (
    <form
      className="staff-filter"
      action="/munkatars/beosztas"
      data-testid="staff-schedule-filter-form"
    >
      <fieldset>
        <legend>Beosztás szűrése</legend>
        <label htmlFor="csoport">Csoport</label>
        <select
          id="csoport"
          name="csoport"
          defaultValue={filters.groupId}
          data-testid="staff-schedule-group-select"
        >
          {STAFF_GROUPS.map(({ scope, label }) => (
            <option key={scope.id} value={scope.id}>
              {label}
            </option>
          ))}
          {filters.groupId === UNGRANTED_STAFF_GROUP.id && (
            <option value={UNGRANTED_STAFF_GROUP.id}>Nem engedélyezett csoport</option>
          )}
        </select>
        <label htmlFor="kezdet">Kezdő dátum</label>
        <input
          id="kezdet"
          type="date"
          name="kezdet"
          defaultValue={filters.from}
          required
          data-testid="staff-schedule-from-input"
        />
        <label htmlFor="veg">Záró dátum</label>
        <input
          id="veg"
          type="date"
          name="veg"
          defaultValue={filters.to}
          required
          data-testid="staff-schedule-to-input"
        />
        {filters.scenario !== "ready" && (
          <input type="hidden" name="scenario" value={filters.scenario} />
        )}
        <button type="submit" data-testid="staff-schedule-filter-submit-button">
          Szűrés
        </button>
        <Link href="/munkatars/beosztas" data-testid="staff-schedule-filter-clear-link">
          Szűrők törlése
        </Link>
      </fieldset>
    </form>
  );
}
