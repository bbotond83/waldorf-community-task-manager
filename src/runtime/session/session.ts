import { currentSyntheticActor } from "../synthetic/access-state.ts";
import type { SessionContext as ApplicationSession } from "../../application/contracts.ts";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getSyntheticProfile, type SyntheticProfile } from "../synthetic/profiles.ts";

export const SESSION_COOKIE_NAME = "waldorf_local_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const SYNTHETIC_SESSION_SECRET = "waldorf-local-synthetic-session-key-v1";

const sessionPayloadSchema = z.object({
  profileId: z.string(),
  authorizationVersion: z.number().int().positive(),
  issuedAt: z.number().int().positive(),
  nonce: z.string().min(16),
});

export type SessionContext = {
  profile: SyntheticProfile;
  actor: ApplicationSession;
  authorizationVersion: number;
  issuedAt: number;
};

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function hasValidSignature(payload: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(signPayload(payload, secret));
  const supplied = Buffer.from(signature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function createSyntheticSessionToken(profile: SyntheticProfile, now = Date.now()): string {
  const actor = currentSyntheticActor(profile.id);
  if (!actor) throw new Error("SYNTHETIC_PROFILE_INVALID");
  const payload = encodeJson({
    profileId: profile.id,
    authorizationVersion: actor.authorizationVersion,
    issuedAt: now,
    nonce: randomBytes(16).toString("hex"),
  });
  return `${payload}.${signPayload(payload, SYNTHETIC_SESSION_SECRET)}`;
}

export function resolveSyntheticSession(
  token: string | undefined,
  now = Date.now(),
): SessionContext | undefined {
  if (!token) return undefined;
  const [payload, signature, extra] = token.split(".");
  if (
    !payload ||
    !signature ||
    extra ||
    !hasValidSignature(payload, signature, SYNTHETIC_SESSION_SECRET)
  ) {
    return undefined;
  }

  try {
    const parsed = sessionPayloadSchema.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    if (
      !parsed.success ||
      parsed.data.issuedAt > now ||
      now - parsed.data.issuedAt > SESSION_MAX_AGE_SECONDS * 1000
    ) {
      return undefined;
    }

    const profile = getSyntheticProfile(parsed.data.profileId);
    const actor = profile && currentSyntheticActor(profile.id);
    if (!profile || !actor || actor.authorizationVersion !== parsed.data.authorizationVersion) {
      return undefined;
    }
    return {
      profile,
      actor,
      authorizationVersion: parsed.data.authorizationVersion,
      issuedAt: parsed.data.issuedAt,
    };
  } catch {
    return undefined;
  }
}

export function sessionCookieOptions(isSecure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecure,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
