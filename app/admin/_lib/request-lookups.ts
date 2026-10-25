import "server-only";

import { loadAdminLookups, NO_LOOKUPS, type AdminLookups } from "./lookups.ts";
import { resolveAdminFacade } from "./facade.ts";
import { resolveAdminSession } from "./session.ts";

/** The choices of the extended admin forms for this request (none without a signed-in admin). */
export async function resolveAdminLookups(): Promise<AdminLookups> {
  const session = await resolveAdminSession();
  const facade = await resolveAdminFacade();
  if (session.state !== "success" || !facade) return NO_LOOKUPS;
  return loadAdminLookups(facade, session.data.applicationSession, session.data.scope);
}
