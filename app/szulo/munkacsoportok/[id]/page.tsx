import { terminalFailure } from "../../../../src/application/results.ts";
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
  return (
    <WorkingGroupDetail
      result={result}
      area="parent"
      listPath="/szulo/munkacsoportok"
      directoryPath="/szulo/szulok"
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
