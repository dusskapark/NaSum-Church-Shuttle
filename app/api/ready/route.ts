import { NextResponse } from "next/server";

import { getMissingRequiredEnvNames } from "@/lib/env";

export async function GET() {
  const missing = getMissingRequiredEnvNames();

  if (missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        missing,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    service: "nasum-church-shuttle",
  });
}
