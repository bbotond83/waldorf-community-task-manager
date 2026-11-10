import { redirect } from "next/navigation";
import Link from "next/link";
import { TeacherStatePanel } from "../../_components/TeacherStatePanel.tsx";
import { resolveTeacherFacade, resolveWorkingGroupFacade } from "../../_lib/facade.ts";
import {
  parseTeacherFilters,
  teacherFilterQuery,
  teacherGroupLabel,
  teacherScheduleHref,
  type TeacherSearchParams,
} from "../../_lib/filters.ts";
import { teacherGroupOptions, teacherRange } from "../../_lib/schedule.ts";
import { resolveTeacherSession } from "../../_lib/session.ts";
import { formatScheduleRange, TrackingFields } from "../_components/ScheduleCollection.tsx";

export default async function TeacherScheduleDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<TeacherSearchParams>;
}>) {
  const { id } = await params;
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
  const result = await facade.getScheduleEntry(applicationSession, {
    scope,
    entryId: id,
    ...teacherRange(filters),
  });
  const canKeepContext =
    result.state === "success" || result.state === "dependency-failure-retryable";
  const returnHref = canKeepContext
    ? teacherScheduleHref(teacherFilterQuery(filters))
    : "/teacher/schedule";
  // The retry keeps the address as it is.
  const query = teacherFilterQuery(filters);
  const retryHref = `/teacher/schedule/${encodeURIComponent(id)}${query ? `?${query}` : ""}`;

  return (
    <section className="teacher-page" data-testid="teacher-schedule-detail-page">
      <Link href={returnHref} data-testid="teacher-schedule-detail-back-link">
        Vissza a beosztáshoz
      </Link>
      <TeacherStatePanel
        result={result}
        retryHref={retryHref}
        clearHref={returnHref}
        testId="teacher-detail"
      >
        {(entry) => (
          <>
            <header>
              <p className="eyebrow">Óvónő · Beosztás részletei · csak olvasás</p>
              <h1 tabIndex={-1} autoFocus>
                {entry.title}
              </h1>
            </header>
            <dl className="teacher-detail-grid" data-testid="teacher-schedule-detail-fields">
              <div>
                <dt>Dátum és idő</dt>
                <dd>{formatScheduleRange(entry)}</dd>
              </div>
              <div>
                <dt>Tevékenység</dt>
                <dd>{entry.title}</dd>
              </div>
              <div>
                <dt>Munkacsoport</dt>
                <dd>{teacherGroupLabel(filters, entry.groupId)}</dd>
              </div>
              <div>
                <dt>Helyszín vagy lefedettség</dt>
                <dd>{entry.location}</dd>
              </div>
              <div>
                <dt>Koordináció</dt>
                <dd>{entry.coordinationDisplayName ?? "Nem szükséges"}</dd>
              </div>
              <TrackingFields entry={entry} />
            </dl>
          </>
        )}
      </TeacherStatePanel>
    </section>
  );
}
