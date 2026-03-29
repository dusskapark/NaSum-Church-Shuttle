import { NextResponse } from "next/server";

import { getInternalServiceToken, getMessagingAccessToken } from "@/lib/env";
import {
  LinePushApiError,
  linePushRequestSchema,
  sendLinePushMessage,
} from "@/lib/line";

export async function POST(request: Request) {
  const expectedToken = getInternalServiceToken();
  const authHeader = request.headers.get("authorization");
  const providedToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!expectedToken || providedToken !== expectedToken) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized internal request" },
      { status: 401 },
    );
  }

  const payload = linePushRequestSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid request body",
        issues: payload.error.flatten(),
      },
      { status: 400 },
    );
  }

  const accessToken = getMessagingAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      {
        ok: false,
        message: "Messaging API channel access token is not configured",
      },
      { status: 503 },
    );
  }

  try {
    await sendLinePushMessage(accessToken, payload.data);
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    if (error instanceof LinePushApiError) {
      console.error("Failed to send LINE push message", {
        status: error.status,
        responseBody: error.responseBody,
      });

      return NextResponse.json(
        {
          ok: false,
          message: "LINE push message request failed",
          status: error.status,
        },
        { status: 502 },
      );
    }

    console.error("Unexpected LINE push message error", error);
    return NextResponse.json(
      {
        ok: false,
        message: "Unexpected LINE push message error",
      },
      { status: 500 },
    );
  }
}
