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
import { resolveTeacherFacade } from "../_lib/facade.ts";
import { readTeacherSchedule } from "../_lib/schedule.ts";
import { resolveTeacherSession } from "../_lib/session.ts";

export default async function TeacherSchedulePage({
  searchParams,
}: Readonly<{ searchParams: Promise<TeacherSearchParams> }>) {
  const session = await resolveTeacherSession();
  if (session.state === "signed-out") redirect("/");
  if (session.state !== "success") return null;
  const filters = parseTeacherFilters(await searchParams, session.data.applicationSession);
  const facade = await resolveTeacherFacade();
  if (session.state !== "success" || !facade) return null;
  const result = await readTeacherSchedule(facade, session.data.applicationSession, filters);

  return (
    <section className="teacher-page" data-testid="teacher-schedule-page">
      <header>
        <p className="eyebrow">Óvónő felület · csak olvasás</p>
        <h1 tabIndex={-1} autoFocus>
          Beosztás
        </h1>
        <p>Csak az engedélyezett csoportok és a szükséges koordinációs adatok láthatók.</p>
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
