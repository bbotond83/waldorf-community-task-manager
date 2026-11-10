import { terminalFailure } from "../../../src/application/results.ts";
import { WorkingGroupList } from "../../../src/runtime/WorkingGroupList.tsx";
import { resolveWorkingGroupFacade } from "../../teacher/_lib/facade.ts";
import { resolveAdminSession } from "../_lib/session.ts";

export default async function AdminWorkingGroupsPage() {
  const session = await resolveAdminSession();
  const facade = await resolveWorkingGroupFacade();
  const result =
    session.state === "success" && facade
      ? await facade.list(session.data.applicationSession, session.data.scope)
      : terminalFailure();
  return <WorkingGroupList result={result} />;
}
