"use server";

import { revalidatePath } from "next/cache";
import { validation } from "../../../src/application/index.ts";
import { COPY } from "../../../src/identity/copy.ts";
import {
  cancelEmailChange,
  changePassword,
  requestEmailChangeChecked,
  type AccountCaller,
} from "../../../src/identity/account-changes.ts";
import { readTokenClaims } from "../../../src/identity/service.ts";
import { accountChangeDeps, getIdentityRuntime } from "../../../src/identity/runtime.ts";
import { currentSession } from "../../_identity/current-session.ts";
import type { ParentActionState } from "../_lib/action-state.ts";
import { mapAccountResult } from "../_lib/account-state.ts";
import { resolveDirectoryFacade } from "../_lib/facade.ts";
import { resolveParentSession } from "../_lib/session.ts";

const PATH = "/szulo/fiokom";
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;
const PHONE = /^[0-9 +-]{6,20}$/;

/** The longest each profile field may be; the database checks the same limits. */
const PROFILE_FIELDS = [
  {
    form: "phone",
    column: "phone",
    max: 20,
    message:
      "A telefonszám 6–20 karakter lehet, és csak számjegyet, szóközt, + és - jelet tartalmazhat.",
  },
  {
    form: "residence",
    column: "residence",
    max: 100,
    message: "A lakóhely legfeljebb 100 karakter lehet.",
  },
  {
    form: "occupation",
    column: "occupation",
    max: 100,
    message: "A foglalkozás legfeljebb 100 karakter lehet.",
  },
  { form: "hobby", column: "hobby", max: 200, message: "A hobbi legfeljebb 200 karakter lehet." },
  {
    form: "howISupport",
    column: "how_i_support",
    max: 500,
    message: "A válasz legfeljebb 500 karakter lehet.",
  },
] as const;

const text = (formData: FormData, field: string): string => {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
};

const refused = (fieldErrors: Record<string, string>): ParentActionState => ({
  state: "validation",
  message: "Ellenőrizze a megadott adatokat.",
  fieldErrors,
});

const DENIED: ParentActionState = { state: "denied", message: "Nincs jogosultság." };

async function parentBoundary() {
  const session = await resolveParentSession();
  const directory = await resolveDirectoryFacade();
  if (session.state !== "success" || !directory) return undefined;
  return { session: session.data, directory };
}

function versionAndKey(formData: FormData) {
  const expectedVersion = Number(formData.get("expectedVersion"));
  const idempotencyKey = text(formData, "idempotencyKey");
  return { expectedVersion, idempotencyKey, valid: KEY_PATTERN.test(idempotencyKey) };
}

/** Panel "Adataim" (W3): every field is checked here first, so the message sits next to the field. */
export async function saveProfileAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const fields: Record<string, string | null> = {};
  const errors: Record<string, string> = {};
  for (const field of PROFILE_FIELDS) {
    const value = text(formData, field.form).trim();
    if (value.length > field.max || (field.form === "phone" && value && !PHONE.test(value))) {
      errors[field.form] = field.message;
    }
    fields[field.column] = value === "" ? null : value;
  }
  if (Object.keys(errors).length > 0) return refused(errors);
  const context = versionAndKey(formData);
  const boundary = await parentBoundary();
  if (!boundary) return DENIED;
  const result = await boundary.directory.updateOwnProfile(boundary.session.applicationSession, {
    scope: boundary.session.familyScope,
    parentId: boundary.session.parentId,
    expectedVersion: context.expectedVersion,
    idempotencyKey: context.idempotencyKey,
    fields,
  });
  if (result.state === "success") revalidatePath(PATH);
  return mapAccountResult(result, "Az adataid mentése sikerült.");
}

/** Panel "Láthatóság" (W2): one tick box and a save. */
export async function saveSharingAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const context = versionAndKey(formData);
  const boundary = await parentBoundary();
  if (!boundary) return DENIED;
  const sharing = text(formData, "sharing") === "on";
  const result = await boundary.directory.setSharing(boundary.session.applicationSession, {
    scope: boundary.session.familyScope,
    parentId: boundary.session.parentId,
    expectedVersion: context.expectedVersion,
    idempotencyKey: context.idempotencyKey,
    sharing,
  });
  if (result.state === "success") revalidatePath(PATH);
  return mapAccountResult(
    result,
    sharing
      ? "Az adataid mostantól láthatók a közösségnek."
      : "Az adataid nem láthatók a közösségnek.",
  );
}

/** The signed-in account as the identity module needs it, or undefined when the session cannot be read. */
async function accountCaller(): Promise<AccountCaller | undefined> {
  const session = await currentSession();
  if (session.status !== "signed-in") return undefined;
  const email = readTokenClaims(session.accessToken)?.email;
  if (typeof email !== "string") return undefined;
  return {
    accessToken: session.accessToken,
    accountId: session.accountId,
    sessionId: session.sessionId,
    email,
  };
}

const TEMPORARY: ParentActionState = { state: "terminal", message: COPY.common.temporary };

async function identityBoundary() {
  if (!(await parentBoundary())) return undefined;
  const caller = await accountCaller();
  if (!caller) return undefined;
  try {
    const runtime = getIdentityRuntime();
    return { caller, deps: accountChangeDeps(runtime) };
  } catch {
    return "unavailable" as const;
  }
}

/** Panel "Bejelentkezés", password (W4). The other sessions end; this device stays signed in. */
export async function changePasswordAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const currentPassword = text(formData, "currentPassword");
  const newPassword = text(formData, "newPassword");
  const repeat = text(formData, "newPasswordRepeat");
  if (!currentPassword) return refused({ currentPassword: "Add meg a jelenlegi jelszavadat." });
  if (newPassword !== repeat) return refused({ newPasswordRepeat: "A két új jelszó nem egyezik." });
  const boundary = await identityBoundary();
  if (boundary === "unavailable") return TEMPORARY;
  if (!boundary) return DENIED;
  const result = await changePassword(
    boundary.caller,
    { currentPassword, newPassword },
    boundary.deps,
  );
  const sessionsEnded = result.state !== "success" || result.data.sessionsEnded;
  return mapAccountResult(
    result,
    sessionsEnded ? "A jelszavad megváltozott." : COPY.account.sessionsNotEnded,
  );
}

/** Panel "Bejelentkezés", new address (W5): the current password is checked first. */
export async function requestEmailChangeAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const email = text(formData, "email").trim();
  const currentPassword = text(formData, "currentPassword");
  const idempotencyKey = text(formData, "idempotencyKey");
  if (!email) return refused({ email: "Add meg az új e-mail-címet." });
  if (!currentPassword) return refused({ currentPassword: "Add meg a jelenlegi jelszavadat." });
  if (!KEY_PATTERN.test(idempotencyKey)) {
    return mapAccountResult(validation({ idempotencyKey: "VAL-IDEMPOTENCY-KEY" }), "");
  }
  const boundary = await identityBoundary();
  if (boundary === "unavailable") return TEMPORARY;
  if (!boundary) return DENIED;
  const result = await requestEmailChangeChecked(
    boundary.caller,
    { newEmail: email, currentPassword, idempotencyKey },
    boundary.deps,
  );
  if (result.state === "success") revalidatePath(PATH);
  return mapAccountResult(result, "Elküldtük a megerősítő levelet az új címre.");
}

/** "Új levél": a fresh link for the address already pending. */
export async function resendEmailChangeAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const idempotencyKey = text(formData, "idempotencyKey");
  if (!KEY_PATTERN.test(idempotencyKey)) {
    return mapAccountResult(validation({ idempotencyKey: "VAL-IDEMPOTENCY-KEY" }), "");
  }
  const boundary = await identityBoundary();
  if (boundary === "unavailable") return TEMPORARY;
  if (!boundary) return DENIED;
  const result = await requestEmailChangeChecked(
    boundary.caller,
    { newEmail: null, currentPassword: "", idempotencyKey },
    boundary.deps,
  );
  if (result.state === "success") revalidatePath(PATH);
  return mapAccountResult(result, "Új megerősítő levelet küldtünk.");
}

/** "Mégse": cancels the pending request; the old address stays. */
export async function cancelEmailChangeAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const idempotencyKey = text(formData, "idempotencyKey");
  if (!KEY_PATTERN.test(idempotencyKey)) {
    return mapAccountResult(validation({ idempotencyKey: "VAL-IDEMPOTENCY-KEY" }), "");
  }
  const boundary = await identityBoundary();
  if (boundary === "unavailable") return TEMPORARY;
  if (!boundary) return DENIED;
  const result = await cancelEmailChange(boundary.caller, { idempotencyKey }, boundary.deps);
  if (result.state === "success") revalidatePath(PATH);
  return mapAccountResult(result, "A címváltoztatási kérést visszavontuk.");
}
