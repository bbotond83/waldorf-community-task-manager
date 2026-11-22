import { terminalFailure } from "../../../../src/application/results.ts";
import { EVENT_BASE_PATH } from "../../../_events/actor.ts";
import { GroupRecurringLink } from "../../../_recurring/RecurringScreens.tsx";
import { GroupEventsSection, loadGroupEvents } from "../../../_events/EventScreens.tsx";
import { WorkingGroupDetail } from "../../../../src/runtime/WorkingGroupDetail.tsx";
import { resolveWorkingGroupFacade } from "../../../teacher/_lib/facade.ts";
import { GroupMembershipPanel } from "../../_components/GroupMembershipPanel.tsx";
import { resolveParentSession } from "../../_lib/session.ts";

export default async function ParentWorkingGroupPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const session = await resolveParentSession();
  const facade = await resolveWorkingGroupFacade();
  const result =
    session.state === "success" && facade
      ? await facade.detail(session.data.applicationSession, session.data.familyScope, id)
      : terminalFailure();
  const eventsActor =
    session.state === "success"
      ? {
          area: "szulo" as const,
          basePath: EVENT_BASE_PATH.szulo,
          session: session.data.applicationSession,
          scope: session.data.familyScope,
        }
      : undefined;
  const eventsResult = eventsActor ? await loadGroupEvents(eventsActor, id) : undefined;
  return (
    <WorkingGroupDetail
      result={result}
      area="parent"
      listPath="/szulo/munkacsoportok"
      directoryPath="/szulo/szulok"
      extraSections={
        eventsActor ? (
          <>
            <GroupEventsSection
              actor={eventsActor}
              groupId={id}
              result={eventsResult ?? terminalFailure()}
            />
            <GroupRecurringLink area="szulo" groupId={id} />
          </>
        ) : null
      }
      ownControls={(model) =>
        model.callerIsParent ? (
          <GroupMembershipPanel
            groupId={model.group.id}
            membership={model.ownMembership}
            isCoordinator={model.members.some((m) => m.isSelf && m.isCoordinator)}
          />
        ) : null
      }
    />
  );
}
