import { terminalFailure } from "../../../src/application/results.ts";
import { WorkingGroupList } from "../../../src/runtime/WorkingGroupList.tsx";
import { resolveWorkingGroupFacade } from "../_lib/facade.ts";
import { resolveTeacherSession } from "../_lib/session.ts";

export default async function TeacherWorkingGroupsPage() {
  const session = await resolveTeacherSession();
  const facade = await resolveWorkingGroupFacade();
  const result =
    session.state === "success" && facade
      ? await facade.list(session.data.applicationSession, session.data.scope)
      : terminalFailure();
  return <WorkingGroupList result={result} />;
}
