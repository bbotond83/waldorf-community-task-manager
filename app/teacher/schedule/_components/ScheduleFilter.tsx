import Link from "next/link";
import { isCalendarDate } from "../../../../src/teacher-tracking/tracking-model.ts";
import type { TeacherFilters } from "../../_lib/filters.ts";

export function ScheduleFilter({ filters }: Readonly<{ filters: TeacherFilters }>) {
  return (
    <form
      className="teacher-filter"
      action="/teacher/schedule"
      data-testid="teacher-schedule-filter-form"
    >
      <fieldset>
        <legend>Beosztás szűrése</legend>
        <label htmlFor="groupId">Csoport</label>
        <select
          id="groupId"
          name="groupId"
          defaultValue={filters.groupId}
          data-testid="teacher-schedule-group-select"
        >
          {filters.groups.map(({ scope, label }) => (
            <option key={scope.id} value={scope.id}>
              {label}
            </option>
          ))}
        </select>
        <label htmlFor="from">Kezdő dátum</label>
        <input
          id="from"
          type="date"
          name="from"
          defaultValue={isCalendarDate(filters.from) ? filters.from : ""}
          required
          data-testid="teacher-schedule-from-input"
        />
        <label htmlFor="to">Záró dátum</label>
        <input
          id="to"
          type="date"
          name="to"
          defaultValue={isCalendarDate(filters.to) ? filters.to : ""}
          required
          data-testid="teacher-schedule-to-input"
        />
        <button type="submit" data-testid="teacher-schedule-filter-submit-button">
          Szűrés
        </button>
        <Link href="/teacher/schedule" data-testid="teacher-schedule-filter-clear-link">
          Szűrők törlése
        </Link>
      </fieldset>
    </form>
  );
}
