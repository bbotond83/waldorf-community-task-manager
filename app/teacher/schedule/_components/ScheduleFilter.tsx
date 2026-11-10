import { isCalendarDate } from "../../../../src/application/tracking-model.ts";
import { FilterClearLink } from "../../../../src/runtime/FilterClearLink.tsx";
import { COMMUNITY_FILTER, type TeacherFilters } from "../../_lib/filters.ts";

export function ScheduleFilter({ filters }: Readonly<{ filters: TeacherFilters }>) {
  return (
    // Keyed by the values the address carries, so a new address never keeps a stale typed value.
    <form
      key={`${filters.groupId}\u0000${filters.from}\u0000${filters.to}`}
      className="teacher-filter"
      action="/teacher/schedule"
      data-testid="teacher-schedule-filter-form"
    >
      <fieldset>
        <legend>Beosztás szűrése</legend>
        <div className="filter-field">
          <label htmlFor="groupId">Munkacsoport</label>
          <select
            id="groupId"
            name="groupId"
            defaultValue={filters.groupId}
            data-testid="teacher-schedule-group-select"
          >
            <option value="">Minden</option>
            <option value={COMMUNITY_FILTER}>Egész közösség</option>
            {filters.groups.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor="from">Kezdő dátum</label>
          <input
            id="from"
            type="date"
            name="from"
            defaultValue={isCalendarDate(filters.from) ? filters.from : ""}
            data-testid="teacher-schedule-from-input"
          />
        </div>
        <div className="filter-field">
          <label htmlFor="to">Záró dátum</label>
          <input
            id="to"
            type="date"
            name="to"
            defaultValue={isCalendarDate(filters.to) ? filters.to : ""}
            data-testid="teacher-schedule-to-input"
          />
        </div>
        <div className="filter-actions">
          <button type="submit" data-testid="teacher-schedule-filter-submit-button">
            Szűrés
          </button>
          <FilterClearLink
            href="/teacher/schedule"
            className="button-link button-link-secondary"
            testId="teacher-schedule-filter-clear-link"
          >
            Szűrők törlése
          </FilterClearLink>
        </div>
      </fieldset>
    </form>
  );
}
