import { ScheduleCollection } from "./_components/ScheduleCollection.tsx";
import { ScheduleFilter } from "./_components/ScheduleFilter.tsx";
import { StaffStatePanel } from "../_components/StaffStatePanel.tsx";
import { parseStaffFilters, staffFilterQuery, type StaffSearchParams } from "../_lib/filters.ts";
import { resolveStaffFacade } from "../_lib/facade.ts";
import { resolveStaffSession } from "../_lib/session.ts";

export default async function StaffSchedulePage({
  searchParams,
}: Readonly<{ searchParams: Promise<StaffSearchParams> }>) {
  const filters = parseStaffFilters(await searchParams);
  const session = await resolveStaffSession();
  const facade = await resolveStaffFacade(filters.scenario);
  if (session.state !== "success" || !facade) return null;
  const result = await facade.getSchedule(session.data.applicationSession, {
    groupScope: filters.groupScope,
    from: filters.from,
    to: filters.to,
  });
  const retryFilters = { ...filters, scenario: "ready" as const };

  return (
    <section className="staff-page" data-testid="staff-schedule-page">
      <header>
        <p className="eyebrow">Munkatársi felület · csak olvasás</p>
        <h1 tabIndex={-1} autoFocus>
          Beosztás
        </h1>
        <p>Csak az engedélyezett csoportok és a szükséges koordinációs adatok láthatók.</p>
      </header>
      <ScheduleFilter filters={filters} />
      <StaffStatePanel
        result={result}
        retryHref={`/munkatars/beosztas?${staffFilterQuery(retryFilters)}`}
        testId="staff-schedule"
      >
        {(model) => <ScheduleCollection entries={model.entries} filters={filters} />}
      </StaffStatePanel>
    </section>
  );
}
