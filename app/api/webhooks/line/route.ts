import { NextResponse } from "next/server";
import { z } from "zod";

import { getMessagingSecret } from "@/lib/env";
import { verifyLineSignature } from "@/lib/line";

const lineWebhookSchema = z
  .object({
    destination: z.string().optional(),
    events: z.array(z.object({ type: z.string() }).passthrough()).default([]),
  })
  .passthrough();

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");
  const secret = getMessagingSecret();

  if (!verifyLineSignature(rawBody, signature, secret)) {
    return NextResponse.json(
      { ok: false, message: "Invalid LINE signature" },
      { status: 401 },
    );
  }

  const payload = lineWebhookSchema.parse(JSON.parse(rawBody || "{}"));

  console.info("LINE webhook received", {
    destination: payload.destination ?? null,
    eventTypes: payload.events.map((event) => event.type),
    received: payload.events.length,
  });

  return NextResponse.json({
    ok: true,
    received: payload.events.length,
  });
}
