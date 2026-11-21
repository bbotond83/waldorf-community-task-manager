import { terminalFailure } from "../../../../src/application/results.ts";
import { EVENT_BASE_PATH } from "../../../_events/actor.ts";
import { GroupEventsSection, loadGroupEvents } from "../../../_events/EventScreens.tsx";
import { WorkingGroupDetail } from "../../../../src/runtime/WorkingGroupDetail.tsx";
import { resolveWorkingGroupFacade } from "../../_lib/facade.ts";
import { resolveTeacherSession } from "../../_lib/session.ts";

/** The teacher's view of a group: the same page as a parent sees, read-only (no join or leave, BR42.4). */
export default async function TeacherWorkingGroupPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const session = await resolveTeacherSession();
  const facade = await resolveWorkingGroupFacade();
  const result =
    session.state === "success" && facade
      ? await facade.detail(session.data.applicationSession, session.data.scope, id)
      : terminalFailure();
  const eventsActor =
    session.state === "success"
      ? {
          area: "teacher" as const,
          basePath: EVENT_BASE_PATH.teacher,
          session: session.data.applicationSession,
          scope: session.data.scope,
        }
      : undefined;
  const eventsResult = eventsActor ? await loadGroupEvents(eventsActor, id) : undefined;
  return (
    <WorkingGroupDetail
      result={result}
      area="teacher"
      listPath="/teacher/munkacsoportok"
      directoryPath="/teacher/szulok"
      extraSections={
        eventsActor ? (
          <GroupEventsSection
            actor={eventsActor}
            groupId={id}
            result={eventsResult ?? terminalFailure()}
          />
        ) : null
      }
    />
  );
}
