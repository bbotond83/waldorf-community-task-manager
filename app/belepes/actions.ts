"use server";

import { cookies } from "next/headers";
import { composeRuntime } from "../../src/runtime/composition.ts";
import {
  createSyntheticSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "../../src/runtime/session/session.ts";
import { getSyntheticProfile } from "../../src/runtime/synthetic/profiles.ts";
import { createSyntheticParentSessionFacade } from "../../src/parent-web/index.ts";

export type AuthenticationState = Readonly<{
  state: "initial" | "validation" | "success" | "denied" | "terminal";
  message?: string;
  destination?: string;
}>;

export async function authenticateParentAction(
  _state: AuthenticationState,
  formData: FormData,
): Promise<AuthenticationState> {
  const identifier = formData.get("identifier");
  if (typeof identifier !== "string" || !identifier.trim()) {
    return { state: "validation", message: "Adja meg a helyi tesztazonosítót." };
  }
  const composition = await composeRuntime();
  if (!composition.ok || composition.value.mode !== "synthetic") {
    return { state: "terminal", message: "A bejelentkezés most nem érhető el." };
  }
  const facade = createSyntheticParentSessionFacade(composition.value.application.authorization);
  const result = await facade.selectSynthetic(
    identifier.trim() === "parent-local" ? "parent-local" : "invalid-profile",
  );
  if (result.state !== "success") {
    return { state: "denied", message: "A bejelentkezés sikertelen." };
  }
  const profile = getSyntheticProfile("parent-local")!;
  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE_NAME,
    createSyntheticSessionToken(profile),
    sessionCookieOptions(false),
  );
  return {
    state: "success",
    message: "Sikeres bejelentkezés.",
    destination: safeDestination(formData.get("intendedPath")),
  };
}

function safeDestination(value: FormDataEntryValue | null): string {
  // A destination the person was sent here from still wins; otherwise the parent's default page.
  return typeof value === "string" && /^\/szulo(?:\/|$)/.test(value)
    ? value
    : getSyntheticProfile("parent-local")!.homePath;
}
