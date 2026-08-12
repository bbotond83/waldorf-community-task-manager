import Link from "next/link";
import { StaffStatePanel } from "../../_components/StaffStatePanel.tsx";
import { resolveStaffFacade } from "../../_lib/facade.ts";
import { parseStaffFilters, staffFilterQuery, type StaffSearchParams } from "../../_lib/filters.ts";
import { resolveStaffSession } from "../../_lib/session.ts";
import { formatScheduleRange } from "../_components/ScheduleCollection.tsx";
import { STAFF_GROUPS } from "../../../../src/staff-web/index.ts";

export default async function StaffScheduleDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<StaffSearchParams>;
}>) {
  const { id } = await params;
  const filters = parseStaffFilters(await searchParams);
  const session = await resolveStaffSession();
  const facade = await resolveStaffFacade(filters.scenario);
  if (session.state !== "success" || !facade) return null;
  const result = await facade.getScheduleEntry(session.data.applicationSession, {
    groupScope: filters.groupScope,
    entryId: id,
    from: filters.from,
    to: filters.to,
  });
  const returnHref = `/munkatars/beosztas?${staffFilterQuery(filters)}`;
  const retryHref = `/munkatars/beosztas/${encodeURIComponent(id)}?${staffFilterQuery({ ...filters, scenario: "ready" })}`;
  const groupLabel = STAFF_GROUPS.find(({ scope }) => scope.id === filters.groupId)?.label ?? "";

  return (
    <section className="staff-page" data-testid="staff-schedule-detail-page">
      <Link href={returnHref} data-testid="staff-schedule-detail-back-link">
        Vissza a beosztáshoz
      </Link>
      <StaffStatePanel
        result={result}
        retryHref={retryHref}
        clearHref={returnHref}
        testId="staff-detail"
      >
        {(entry) => (
          <>
            <header>
              <p className="eyebrow">Beosztás részletei · csak olvasás</p>
              <h1 tabIndex={-1} autoFocus>
                {entry.title}
              </h1>
            </header>
            <dl className="staff-detail-grid" data-testid="staff-schedule-detail-fields">
              <div>
                <dt>Dátum és idő</dt>
                <dd>{formatScheduleRange(entry)}</dd>
              </div>
              <div>
                <dt>Tevékenység</dt>
                <dd>{entry.title}</dd>
              </div>
              <div>
                <dt>Engedélyezett csoport</dt>
                <dd>{groupLabel}</dd>
              </div>
              <div>
                <dt>Helyszín vagy lefedettség</dt>
                <dd>{entry.location}</dd>
              </div>
              <div>
                <dt>Koordináció</dt>
                <dd>{entry.coordinationDisplayName ?? "Nem szükséges"}</dd>
              </div>
            </dl>
          </>
        )}
      </StaffStatePanel>
    </section>
  );
}
