import "server-only";

import type {
  ApplicationResult,
  CoordinatorGroupModel,
  FlaggedItemListModel,
  RemovalPreviewModel,
  RemovalSubjectModel,
} from "../../../src/application/index.ts";
import { terminalFailure } from "../../../src/application/results.ts";
import { productionRequest } from "../../_identity/production-request.ts";
import { resolveAdminSession } from "./session.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const GROUP_LIMIT = 50;

async function boundary() {
  const session = await resolveAdminSession();
  const request = await productionRequest();
  return session.state === "success" && request.state === "ready"
    ? { session: session.data, services: request.services }
    : undefined;
}

export async function readRemovalPreview(
  subject: RemovalSubjectModel,
): Promise<ApplicationResult<RemovalPreviewModel>> {
  const ready = await boundary();
  if (!ready) return terminalFailure();
  return ready.services.removal.preview(
    ready.session.applicationSession,
    ready.session.scope,
    subject,
  );
}

export async function readFlaggedItems(
  subject: RemovalSubjectModel,
): Promise<ApplicationResult<FlaggedItemListModel>> {
  const ready = await boundary();
  if (!ready) return terminalFailure();
  return ready.services.removal.flaggedItems(
    ready.session.applicationSession,
    ready.session.scope,
    subject,
  );
}

/**
 * Of the groups the removal named, those that still have no coordinator, with their current names. A group that cannot
 * be read stays on the list under a general name, so nothing to handle is dropped silently.
 */
export async function readGroupsWithoutCoordinator(
  ids: readonly string[],
): Promise<readonly CoordinatorGroupModel[]> {
  const wanted = [...new Set(ids.filter((id) => UUID.test(id)))].slice(0, GROUP_LIMIT);
  const ready = await boundary();
  if (!ready) return [];
  const found = await Promise.all(
    wanted.map(async (groupId): Promise<CoordinatorGroupModel | undefined> => {
      const detail = await ready.services.workingGroups.detail(
        ready.session.applicationSession,
        ready.session.scope,
        groupId,
      );
      if (detail.state !== "success") return { groupId, groupName: "Munkacsoport" };
      return detail.data.hasCoordinator
        ? undefined
        : { groupId, groupName: detail.data.group.name };
    }),
  );
  return found.filter((group) => group !== undefined);
}
