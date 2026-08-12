import { NextResponse } from "next/server";
import { composeRuntime } from "../../../src/runtime/composition";

export const dynamic = "force-dynamic";

export async function GET() {
  const composition = await composeRuntime();
  if (!composition.ok) {
    return NextResponse.json(
      { status: "not-ready", code: composition.error.code },
      { status: 503 },
    );
  }

  return NextResponse.json({
    status: "ready",
    mode: composition.value.mode,
    marker: "waldorf-local-ready",
  });
}
