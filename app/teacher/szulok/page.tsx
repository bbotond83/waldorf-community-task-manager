import { terminalFailure } from "../../../src/application/results.ts";
import { DirectoryPage } from "../../../src/runtime/DirectoryPage.tsx";
import { resolveDirectoryFacade } from "../../szulo/_lib/facade.ts";
import { resolveTeacherSession } from "../_lib/session.ts";

export default async function TeacherDirectoryPage() {
  const session = await resolveTeacherSession();
  const facade = await resolveDirectoryFacade();
  const result =
    session.state === "success" && facade
      ? await facade.list(session.data.applicationSession, session.data.scope)
      : terminalFailure();
  return <DirectoryPage result={result} />;
}
