import Link from "next/link";
import type { ScheduleEntryModel } from "../../../../src/application/index.ts";
import type { StaffFilters } from "../../_lib/filters.ts";
import { staffFilterQuery } from "../../_lib/filters.ts";
import { STAFF_GROUPS } from "../../../../src/staff-web/index.ts";

export function ScheduleCollection({
  entries,
  filters,
}: Readonly<{ entries: readonly ScheduleEntryModel[]; filters: StaffFilters }>) {
  const query = staffFilterQuery(filters);
  const groupLabel = STAFF_GROUPS.find(({ scope }) => scope.id === filters.groupId)?.label ?? "";
  return (
    <div className="staff-collection" data-testid="staff-schedule-collection">
      <div className="staff-table-wrapper">
        <table className="staff-table" data-testid="staff-schedule-table">
          <caption>Engedélyezett munkatársi beosztás</caption>
          <thead>
            <tr>
              <th scope="col">Dátum és idő</th>
              <th scope="col">Tevékenység</th>
              <th scope="col">Engedélyezett csoport</th>
              <th scope="col">Helyszín vagy lefedettség</th>
              <th scope="col">Koordináció</th>
              <th scope="col">
                <span className="visually-hidden">Részletek</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} data-testid={`staff-schedule-row-${entry.id}`}>
                <td>{formatScheduleRange(entry)}</td>
                <td>{entry.title}</td>
                <td>{groupLabel}</td>
                <td>{entry.location}</td>
                <td>{entry.coordinationDisplayName ?? "Nem szükséges"}</td>
                <td>
                  <Link
                    href={`/munkatars/beosztas/${encodeURIComponent(entry.id)}?${query}`}
                    data-testid={`staff-schedule-open-${entry.id}`}
                  >
                    Részletek
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="staff-card-list" data-testid="staff-schedule-card-list">
        {entries.map((entry) => (
          <li className="staff-card" key={entry.id} data-testid={`staff-schedule-card-${entry.id}`}>
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
            </dl>
            <Link
              href={`/munkatars/beosztas/${encodeURIComponent(entry.id)}?${query}`}
              data-testid={`staff-schedule-card-open-${entry.id}`}
            >
              Részletek
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function formatScheduleRange(entry: Pick<ScheduleEntryModel, "startsAt" | "endsAt">) {
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
