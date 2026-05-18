import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export function isAuthorizedCronRequest(
  req: NextRequest,
  logPrefix: string,
): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(`${logPrefix} CRON_SECRET not set`);
    return false;
  }

  const header = req.headers.get("authorization");
  const expected = `Bearer ${secret}`;
  if (!header) return false;

  const actualBuffer = Buffer.from(header);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(actualBuffer, expectedBuffer);
}
