import "server-only";

import { isProductionMode } from "../../_identity/production-request.ts";
import { loadAdminLookups, NO_LOOKUPS, type AdminLookups } from "./lookups.ts";
import { resolveAdminFacade } from "./facade.ts";
import { resolveAdminSession } from "./session.ts";

/**
 * The choices of the extended admin forms for this request. Only the production mode has them: the
 * synthetic admin keeps its one-field forms, so it gets none and the page does not ask for any.
 */
export async function resolveAdminLookups(): Promise<AdminLookups> {
  if (!(await isProductionMode())) return NO_LOOKUPS;
  const session = await resolveAdminSession();
  const facade = await resolveAdminFacade();
  if (session.state !== "success" || !facade) return NO_LOOKUPS;
  return loadAdminLookups(facade, session.data.applicationSession, session.data.scope);
}
