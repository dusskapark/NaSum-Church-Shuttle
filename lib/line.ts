import crypto from "node:crypto";

import { z } from "zod";

export const lineMessageSchema = z.object({ type: z.string().min(1) }).passthrough();

export const linePushRequestSchema = z.object({
  to: z.string().min(1),
  messages: z.array(lineMessageSchema).min(1),
  notificationDisabled: z.boolean().optional(),
});

export class LinePushApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = "LinePushApiError";
  }
}

export function verifyLineSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !secret) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");
  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function sendLinePushMessage(
  accessToken: string,
  payload: z.infer<typeof linePushRequestSchema>,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new LinePushApiError(
      "Failed to send LINE push message",
      response.status,
      await response.text(),
    );
  }
}
