import "server-only";

import { resolveWorkingGroupFacade } from "../../teacher/_lib/facade.ts";
import { loadAdminLookups, NO_LOOKUPS, type AdminLookups } from "./lookups.ts";
import { resolveAdminFacade } from "./facade.ts";
import { resolveAdminSession } from "./session.ts";

/** The choices of the extended admin forms for this request (none without a signed-in admin). */
export async function resolveAdminLookups(): Promise<AdminLookups> {
  const session = await resolveAdminSession();
  const facade = await resolveAdminFacade();
  const workingGroups = await resolveWorkingGroupFacade();
  if (session.state !== "success" || !facade || !workingGroups) return NO_LOOKUPS;
  return loadAdminLookups(
    facade,
    workingGroups,
    session.data.applicationSession,
    session.data.scope,
    session.data.groupIds,
  );
}
