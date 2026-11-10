import Link from "next/link";
import type { TrackingEntry } from "../../../../src/application/index.ts";
import { teacherStatusDisplay } from "../../../../src/application/status-labels.ts";
import { StatusBadge } from "../../../../src/runtime/StatusBadge.tsx";
import type { TeacherFilters } from "../../_lib/filters.ts";
import { teacherFilterQuery, teacherGroupLabel } from "../../_lib/filters.ts";

export function ScheduleCollection({
  entries,
  filters,
}: Readonly<{ entries: readonly TrackingEntry[]; filters: TeacherFilters }>) {
  // The detail keeps the filter, so its back link returns to the same list.
  const detailHref = (entry: TrackingEntry) => {
    const query = teacherFilterQuery(filters);
    return `/teacher/schedule/${encodeURIComponent(entry.id)}${query ? `?${query}` : ""}`;
  };
  const groupLabelOf = (entry: TrackingEntry) => teacherGroupLabel(filters, entry.groupId);
  return (
    <div className="teacher-collection" data-testid="teacher-schedule-collection">
      <div className="teacher-table-wrapper">
        <table className="teacher-table" data-testid="teacher-schedule-table">
          <caption>A közösség beosztása</caption>
          <thead>
            <tr>
              <th scope="col">Dátum és idő</th>
              <th scope="col">Tevékenység</th>
              <th scope="col">Munkacsoport</th>
              <th scope="col">Helyszín vagy lefedettség</th>
              <th scope="col">Koordináció</th>
              <th scope="col">Felelős</th>
              <th scope="col">Beosztottak</th>
              <th scope="col">Állapot</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} data-testid={`teacher-schedule-row-${entry.id}`}>
                <td>{formatScheduleRange(entry)}</td>
                <td>
                  {/* One link per row: the link is stretched over the whole row with CSS. */}
                  <Link
                    className="teacher-row-link"
                    href={detailHref(entry)}
                    data-testid={`teacher-schedule-open-${entry.id}`}
                  >
                    {entry.title}
                  </Link>
                </td>
                <td>{groupLabelOf(entry)}</td>
                <td>{entry.location}</td>
                <td>{entry.coordinationDisplayName ?? "Nem szükséges"}</td>
                <td>{entry.ownerDisplayName ?? "Nincs kijelölt felelős"}</td>
                <td>
                  {entry.assigneeDisplayNames.length
                    ? entry.assigneeDisplayNames.join(", ")
                    : "Nincs beosztott"}
                </td>
                <td>
                  <StatusBadge {...teacherStatusDisplay(entry.currentStatusLabel)} />
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
            <h2>
              {/* One link per card: the link is stretched over the whole card with CSS. */}
              <Link
                className="teacher-card-link"
                href={detailHref(entry)}
                data-testid={`teacher-schedule-card-open-${entry.id}`}
              >
                {entry.title}
              </Link>
            </h2>
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
                <dt>Munkacsoport</dt>
                <dd>{groupLabelOf(entry)}</dd>
              </div>
              <div>
                <dt>Koordináció</dt>
                <dd>{entry.coordinationDisplayName ?? "Nem szükséges"}</dd>
              </div>
              <TrackingFields entry={entry} />
            </dl>
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
        <dd>
          <StatusBadge {...teacherStatusDisplay(entry.currentStatusLabel)} />
        </dd>
      </div>
    </>
  );
}
