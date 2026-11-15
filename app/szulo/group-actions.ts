"use server";

import { revalidatePath } from "next/cache";
import {
  mapWorkingGroupResult,
  NO_ACCESS,
  readGroupCommand,
} from "../_lib/working-group-result.ts";
import { resolveWorkingGroupFacade } from "../teacher/_lib/facade.ts";
import type { ParentActionState } from "./_lib/action-state.ts";
import { resolveParentSession } from "./_lib/session.ts";

/** A parent joins a working group for themself (BR40.1). Joining again says so and changes nothing. */
export async function joinGroupAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const input = readGroupCommand(formData, "groupId", false);
  if (!input.ok) return input.state;
  const session = await resolveParentSession();
  const facade = await resolveWorkingGroupFacade();
  if (session.state !== "success" || !facade) return NO_ACCESS;
  const result = await facade.join(session.data.applicationSession, {
    scope: session.data.familyScope,
    idempotencyKey: input.idempotencyKey,
    groupId: input.id,
  });
  if (result.state === "success") revalidateGroup(input.id);
  const repeated = result.state === "success" && result.data.alreadyMember;
  return mapWorkingGroupResult(
    "join",
    result,
    repeated ? "Már tagja vagy ennek a csoportnak." : "Csatlakoztál a munkacsoporthoz.",
  );
}

/** A parent leaves a working group, which also ends their coordinator right there (BR40.5). */
export async function leaveGroupAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const input = readGroupCommand(formData, "membershipId", true);
  if (!input.ok) return input.state;
  const groupField = formData.get("groupId");
  const groupId = typeof groupField === "string" ? groupField : "";
  const session = await resolveParentSession();
  const facade = await resolveWorkingGroupFacade();
  if (session.state !== "success" || !facade) return NO_ACCESS;
  const result = await facade.leave(session.data.applicationSession, {
    scope: session.data.familyScope,
    idempotencyKey: input.idempotencyKey,
    membershipId: input.id,
    expectedVersion: input.expectedVersion,
  });
  if (result.state === "success") revalidateGroup(groupId);
  return mapWorkingGroupResult("leave", result, "Kiléptél a munkacsoportból.");
}

/** Refreshes the group page in every area; an identifier that is not a UUID is never put into a path. */
function revalidateGroup(groupId: string): void {
  if (!/^[0-9a-f-]{36}$/.test(groupId)) return;
  for (const area of ["szulo", "teacher", "admin"]) {
    revalidatePath(`/${area}/munkacsoportok/${groupId}`);
  }
}
