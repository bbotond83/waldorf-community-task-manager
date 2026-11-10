import { redirect } from "next/navigation";
import { ScheduleCollection } from "./_components/ScheduleCollection.tsx";
import { ScheduleFilter } from "./_components/ScheduleFilter.tsx";
import { TeacherStatePanel } from "../_components/TeacherStatePanel.tsx";
import {
  parseTeacherFilters,
  teacherFilterQuery,
  teacherScheduleHref,
  type TeacherSearchParams,
} from "../_lib/filters.ts";
import { resolveTeacherFacade, resolveWorkingGroupFacade } from "../_lib/facade.ts";
import { readTeacherSchedule, teacherGroupOptions } from "../_lib/schedule.ts";
import { resolveTeacherSession } from "../_lib/session.ts";

export default async function TeacherSchedulePage({
  searchParams,
}: Readonly<{ searchParams: Promise<TeacherSearchParams> }>) {
  const session = await resolveTeacherSession();
  if (session.state === "signed-out") redirect("/");
  if (session.state !== "success") return null;
  const [facade, workingGroups] = await Promise.all([
    resolveTeacherFacade(),
    resolveWorkingGroupFacade(),
  ]);
  if (!facade || !workingGroups) return null;
  const { applicationSession, scope } = session.data;
  const filters = parseTeacherFilters(
    await searchParams,
    await teacherGroupOptions(workingGroups, applicationSession, scope),
  );
  const result = await readTeacherSchedule(facade, applicationSession, scope, filters);

  return (
    <section className="teacher-page" data-testid="teacher-schedule-page">
      <header>
        <p className="eyebrow">Óvónő felület · csak olvasás</p>
        <h1 tabIndex={-1} autoFocus>
          Beosztás
        </h1>
        <p>A teljes közösség beosztása és a szükséges koordinációs adatok láthatók.</p>
      </header>
      {(result.state === "success" ||
        result.state === "empty" ||
        result.state === "validation") && <ScheduleFilter filters={filters} />}
      <TeacherStatePanel
        result={result}
        retryHref={teacherScheduleHref(teacherFilterQuery(filters))}
        testId="teacher-schedule"
      >
        {(model) => <ScheduleCollection entries={model.entries} filters={filters} />}
      </TeacherStatePanel>
    </section>
  );
}
