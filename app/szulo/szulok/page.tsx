import { terminalFailure } from "../../../src/application/results.ts";
import { DirectoryPage } from "../../../src/runtime/DirectoryPage.tsx";
import { resolveDirectoryFacade } from "../_lib/facade.ts";
import { resolveParentSession } from "../_lib/session.ts";

export default async function ParentDirectoryPage() {
  const session = await resolveParentSession();
  const facade = await resolveDirectoryFacade();
  const result =
    session.state === "success" && facade
      ? await facade.list(session.data.applicationSession, session.data.familyScope)
      : terminalFailure();
  return <DirectoryPage result={result} />;
}
