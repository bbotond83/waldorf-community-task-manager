import Link from "next/link";
import type { TrackingEntry } from "../../../../src/application/index.ts";
import type { TeacherFilters } from "../../_lib/filters.ts";
import { teacherFilterQuery } from "../../_lib/filters.ts";

export function ScheduleCollection({
  entries,
  filters,
}: Readonly<{ entries: readonly TrackingEntry[]; filters: TeacherFilters }>) {
  const query = teacherFilterQuery(filters);
  const groupLabel = filters.groups.find(({ scope }) => scope.id === filters.groupId)?.label ?? "";
  return (
    <div className="teacher-collection" data-testid="teacher-schedule-collection">
      <div className="teacher-table-wrapper">
        <table className="teacher-table" data-testid="teacher-schedule-table">
          <caption>Engedélyezett óvónői beosztás</caption>
          <thead>
            <tr>
              <th scope="col">Dátum és idő</th>
              <th scope="col">Tevékenység</th>
              <th scope="col">Engedélyezett csoport</th>
              <th scope="col">Helyszín vagy lefedettség</th>
              <th scope="col">Koordináció</th>
              <th scope="col">Felelős</th>
              <th scope="col">Beosztottak</th>
              <th scope="col">Állapot</th>
              <th scope="col">
                <span className="visually-hidden">Részletek</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} data-testid={`teacher-schedule-row-${entry.id}`}>
                <td>{formatScheduleRange(entry)}</td>
                <td>{entry.title}</td>
                <td>{groupLabel}</td>
                <td>{entry.location}</td>
                <td>{entry.coordinationDisplayName ?? "Nem szükséges"}</td>
                <td>{entry.ownerDisplayName ?? "Nincs kijelölt felelős"}</td>
                <td>
                  {entry.assigneeDisplayNames.length
                    ? entry.assigneeDisplayNames.join(", ")
                    : "Nincs beosztott"}
                </td>
                <td>{entry.currentStatusLabel ?? "Nincs elérhető állapot"}</td>
                <td>
                  <Link
                    href={`/teacher/schedule/${encodeURIComponent(entry.id)}?${query}`}
                    data-testid={`teacher-schedule-open-${entry.id}`}
                  >
                    Részletek
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="teacher-card-list" data-testid="teacher-schedule-card-list">
        {entries.map((entry) => (
          <li
            className="teacher-card"
            key={entry.id}
            data-testid={`teacher-schedule-card-${entry.id}`}
          >
            <h2>{entry.title}</h2>
            <dl>
              <div>
                <dt>Dátum és idő</dt>
                <dd>{formatScheduleRange(entry)}</dd>
              </div>
              <div>
                <dt>Helyszín vagy lefedettség</dt>
                <dd>{entry.location}</dd>
              </div>
              <div>
                <dt>Engedélyezett csoport</dt>
                <dd>{groupLabel}</dd>
              </div>
              <div>
                <dt>Koordináció</dt>
                <dd>{entry.coordinationDisplayName ?? "Nem szükséges"}</dd>
              </div>
              <TrackingFields entry={entry} />
            </dl>
            <Link
              href={`/teacher/schedule/${encodeURIComponent(entry.id)}?${query}`}
              data-testid={`teacher-schedule-card-open-${entry.id}`}
            >
              Részletek
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function formatScheduleRange(entry: Pick<TrackingEntry, "startsAt" | "endsAt">) {
  const formatter = new Intl.DateTimeFormat("hu-HU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Budapest",
  });
  const timeFormatter = new Intl.DateTimeFormat("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Budapest",
  });
  return `${formatter.format(new Date(entry.startsAt))}–${timeFormatter.format(new Date(entry.endsAt))}`;
}

export function TrackingFields({ entry }: Readonly<{ entry: TrackingEntry }>) {
  return (
    <>
      <div>
        <dt>Felelős</dt>
        <dd>{entry.ownerDisplayName ?? "Nincs kijelölt felelős"}</dd>
      </div>
      <div>
        <dt>Beosztottak</dt>
        <dd>
          {entry.assigneeDisplayNames.length
            ? entry.assigneeDisplayNames.join(", ")
            : "Nincs beosztott"}
        </dd>
      </div>
      <div>
        <dt>Állapot</dt>
        <dd>{entry.currentStatusLabel ?? "Nincs elérhető állapot"}</dd>
      </div>
    </>
  );
}
