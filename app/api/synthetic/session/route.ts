import { currentSyntheticActor } from "../../../../src/runtime/synthetic/access-state";
import { NextResponse, type NextRequest } from "next/server";
import { composeRuntime } from "../../../../src/runtime/composition";
import { isSameOrigin } from "../../../../src/runtime/security/origin";
import {
  createSyntheticSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "../../../../src/runtime/session/session";
import {
  getSyntheticProfile,
  syntheticProfileIdSchema,
} from "../../../../src/runtime/synthetic/profiles";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const composition = await composeRuntime();
  if (!composition.ok || composition.value.mode !== "synthetic") {
    return new NextResponse(null, { status: 503 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: { code: "REQUEST_ORIGIN_DENIED" } }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: { code: "REQUEST_BODY_INVALID" } }, { status: 400 });
  }
  const rawProfileId = formData.get("profileId");
  const redirectTarget = new URL("/", request.headers.get("origin")!);
  if (rawProfileId === "") {
    const response = NextResponse.redirect(redirectTarget, 303);
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  const profileId = syntheticProfileIdSchema.safeParse(rawProfileId);
  const profile = profileId.success ? getSyntheticProfile(profileId.data) : undefined;
  if (!profile || !currentSyntheticActor(profile.id)) {
    return NextResponse.json({ error: { code: "SYNTHETIC_PROFILE_INVALID" } }, { status: 400 });
  }

  // Choosing a profile opens that profile's default page directly (no welcome page).
  const response = NextResponse.redirect(
    new URL(profile.homePath, request.headers.get("origin")!),
    303,
  );
  response.cookies.set(
    SESSION_COOKIE_NAME,
    createSyntheticSessionToken(profile),
    sessionCookieOptions(false),
  );
  return response;
}
