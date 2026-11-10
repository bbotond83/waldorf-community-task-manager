import { terminalFailure } from "../../../src/application/results.ts";
import { WorkingGroupList } from "../../../src/runtime/WorkingGroupList.tsx";
import { resolveWorkingGroupFacade } from "../../teacher/_lib/facade.ts";
import { resolveParentSession } from "../_lib/session.ts";

export default async function ParentWorkingGroupsPage() {
  const session = await resolveParentSession();
  const facade = await resolveWorkingGroupFacade();
  const result =
    session.state === "success" && facade
      ? await facade.list(session.data.applicationSession, session.data.familyScope)
      : terminalFailure();
  return <WorkingGroupList result={result} />;
}
