import { resetSyntheticAccessState } from "../../../../src/runtime/synthetic/access-state.ts";
import { NextResponse, type NextRequest } from "next/server";
import { resetSyntheticAdminFixtures } from "../../../../src/admin-core/synthetic-admin.ts";
import { resetSyntheticAdvancedFixtures } from "../../../../src/admin-advanced/index.ts";
import { resetSyntheticParentState } from "../../../../src/parent-web/index.ts";
import { composeRuntime } from "../../../../src/runtime/composition";
import { isSameOrigin } from "../../../../src/runtime/security/origin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const composition = await composeRuntime();
  if (!composition.ok || composition.value.mode !== "synthetic") {
    return new NextResponse(null, { status: 404 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: { code: "REQUEST_ORIGIN_DENIED" } }, { status: 403 });
  }

  resetSyntheticAccessState();
  resetSyntheticAdminFixtures();
  resetSyntheticAdvancedFixtures();
  resetSyntheticParentState();

  return NextResponse.json({
    state: "success",
    code: "SYNTHETIC_FIXTURE_RESET",
    fixtureVersion: composition.value.config.fixtureVersion,
  });
}
