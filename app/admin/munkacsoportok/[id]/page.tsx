import { terminalFailure } from "../../../../src/application/results.ts";
import { WorkingGroupDetail } from "../../../../src/runtime/WorkingGroupDetail.tsx";
import { resolveWorkingGroupFacade } from "../../../teacher/_lib/facade.ts";
import { AdminMutationForm } from "../../_components/AdminMutationForm.tsx";
import { resolveAdminSession } from "../../_lib/session.ts";
import { appointCoordinatorAction, revokeCoordinatorAction } from "../../group-actions.ts";

/**
 * The admin's view of a group. A super admin also gets the coordinator actions on each member (BR42.5); a group
 * admin reads the same list without them, because the database gives the row version to a super admin only.
 */
export default async function AdminWorkingGroupPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const session = await resolveAdminSession();
  const facade = await resolveWorkingGroupFacade();
  const result =
    session.state === "success" && facade
      ? await facade.detail(session.data.applicationSession, session.data.scope, id)
      : terminalFailure();
  return (
    <WorkingGroupDetail
      result={result}
      area="admin"
      listPath="/admin/munkacsoportok"
      directoryPath="/admin/szulok"
      memberControls={(member, model) =>
        member.version === undefined ? null : (
          <AdminMutationForm
            action={member.isCoordinator ? revokeCoordinatorAction : appointCoordinatorAction}
            submitLabel={member.isCoordinator ? "Visszavonom a jogot" : "Koordinátorrá teszem"}
            testId={`admin-group-${member.isCoordinator ? "revoke" : "appoint"}-${member.membershipId}`}
            longForm
          >
            <input type="hidden" name="groupId" value={model.group.id} />
            <input type="hidden" name="membershipId" value={member.membershipId} />
            <input type="hidden" name="expectedVersion" value={member.version} />
            <input
              type="hidden"
              name="idempotencyKey"
              value={`group-${member.isCoordinator ? "revoke" : "appoint"}:${member.membershipId}:v${member.version}`}
            />
          </AdminMutationForm>
        )
      }
    />
  );
}
