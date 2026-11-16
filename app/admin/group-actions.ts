"use server";

import { revalidatePath } from "next/cache";
import {
  mapWorkingGroupResult,
  NO_ACCESS,
  readGroupCommand,
} from "../_lib/working-group-result.ts";
import { resolveWorkingGroupFacade } from "../teacher/_lib/facade.ts";
import { resolveAdminSession } from "./_lib/session.ts";
import type { AdminActionState } from "./actions.ts";

/** A super admin makes a member the coordinator of the group (BR41.1). The notice and its email follow in the same commit. */
export async function appointCoordinatorAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  return coordinatorCommand("appoint", formData, "Koordinátor lett.");
}

/** A super admin takes the coordinator right of a member back (BR41.4). The person stays a member. */
export async function revokeCoordinatorAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  return coordinatorCommand("revoke", formData, "A koordinátori jog visszavonva.");
}

async function coordinatorCommand(
  action: "appoint" | "revoke",
  formData: FormData,
  successMessage: string,
): Promise<AdminActionState> {
  const input = readGroupCommand(formData, "membershipId", true);
  if (!input.ok) return input.state;
  const groupValue = formData.get("groupId");
  const groupId = typeof groupValue === "string" ? groupValue : "";
  const session = await resolveAdminSession();
  const facade = await resolveWorkingGroupFacade();
  if (session.state !== "success" || !facade) return NO_ACCESS;
  const result = await facade[action](session.data.applicationSession, {
    scope: session.data.scope,
    idempotencyKey: input.idempotencyKey,
    membershipId: input.id,
    expectedVersion: input.expectedVersion,
  });
  if (result.state === "success" && /^[0-9a-f-]{36}$/.test(groupId)) {
    revalidatePath(`/admin/munkacsoportok/${groupId}`);
    revalidatePath(`/szulo/munkacsoportok/${groupId}`);
    revalidatePath(`/teacher/munkacsoportok/${groupId}`);
  }
  return mapWorkingGroupResult(action, result, successMessage);
}
