"use server";

import { revalidatePath } from "next/cache";
import { mapApplicationResult } from "./_lib/action-state.ts";
import { resolveAdminFacade } from "./_lib/facade.ts";
import { removalFailed, removalSucceeded } from "./_lib/removal.ts";
import { resolveAdminSession } from "./_lib/session.ts";
import type { AdminActionState } from "./actions.ts";
import { productionRequest } from "../_identity/production-request.ts";
import { currentSession } from "../_identity/current-session.ts";
import { validation } from "../../src/application/index.ts";
import { REMOVAL_TEXTS } from "../../src/data/copy.ts";
import { sendParentInvitation } from "../../src/identity/account-changes.ts";
import { accountChangeDeps, getIdentityRuntime } from "../../src/identity/runtime.ts";

const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const text = (formData: FormData, field: string): string => {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
};

const DENIED: AdminActionState = { state: "denied", message: "Nincs jogosultság" };
const TEMPORARY: AdminActionState = {
  state: "retryable",
  message: "Átmeneti hiba történt. Próbálja újra.",
};

/**
 * Removes a parent (W7; U14). The database archives the parent, clears the details, runs every removal step and ends
 * the sign-in on its side in one commit; only afterwards does the server ban the sign-in users it returned and end
 * their sessions. That follow-up is tried three times and, if it still fails, reported on the screen and as an event
 * line: the removal itself stands, because the database already refuses the account.
 */
export async function removeParentAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parentId = text(formData, "parentId");
  const familyId = text(formData, "familyId");
  const expectedVersion = Number(formData.get("expectedVersion"));
  const idempotencyKey = text(formData, "idempotencyKey");
  if (!UUID.test(parentId) || !KEY_PATTERN.test(idempotencyKey)) {
    return mapApplicationResult(validation({ request: "VAL-INVALID" }));
  }
  const session = await resolveAdminSession();
  const request = await productionRequest();
  if (session.state !== "success" || request.state !== "ready") return DENIED;
  const result = await request.services.directory.removeParent(session.data.applicationSession, {
    scope: session.data.scope,
    parentId,
    expectedVersion,
    idempotencyKey,
  });
  if (result.state !== "success") return removalFailed("parent_remove", idempotencyKey, result);
  revalidatePath("/admin/nyilvantartasok");
  if (UUID.test(familyId)) revalidatePath(`/admin/nyilvantartasok/${familyId}`);
  revalidatePath("/admin/szulok");
  return removalSucceeded(
    REMOVAL_TEXTS.parentRemoved,
    result.code,
    result.data.removal,
    UUID.test(familyId)
      ? `/admin/nyilvantartasok/${familyId}/szulo/${parentId}/eltavolitas/eredmeny`
      : undefined,
  );
}

/**
 * Sends the invitation of a parent without an account (W8). The address comes from the parent's own record, read here
 * as the super admin, never from the form.
 */
export async function sendInvitationAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parentId = text(formData, "parentId");
  const familyId = text(formData, "familyId");
  const idempotencyKey = text(formData, "idempotencyKey");
  if (!UUID.test(parentId) || !UUID.test(familyId) || !KEY_PATTERN.test(idempotencyKey)) {
    return mapApplicationResult(validation({ request: "VAL-INVALID" }));
  }
  const session = await resolveAdminSession();
  const facade = await resolveAdminFacade();
  const signedIn = await currentSession();
  if (session.state !== "success" || !facade || signedIn.status !== "signed-in") return DENIED;
  const record = await facade.getRecord(
    session.data.applicationSession,
    session.data.scope,
    "record",
    familyId,
  );
  const email =
    record.state === "success"
      ? record.data.details?.parents?.find((parent) => parent.id === parentId)?.email
      : undefined;
  if (!email) {
    return mapApplicationResult(validation({ request: "EMAIL_INVALID" }, "EMAIL_INVALID"));
  }
  let deps: ReturnType<typeof accountChangeDeps>;
  try {
    deps = accountChangeDeps(getIdentityRuntime());
  } catch {
    return TEMPORARY;
  }
  const result = await sendParentInvitation(
    { accessToken: signedIn.accessToken, accountId: signedIn.accountId },
    { parentId, email, idempotencyKey },
    deps,
  );
  if (result.state === "success") {
    revalidatePath(`/admin/nyilvantartasok/${familyId}`);
    return {
      state: "success",
      message: result.data.mailed
        ? "A meghívót elküldtük a nyilvántartásban szereplő címre."
        : "A meghívó már el van küldve. Új levélhez kérj új meghívót.",
      code: result.code,
    };
  }
  return mapApplicationResult(result);
}
