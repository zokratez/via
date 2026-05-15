/**
 * Resend client + shared email helpers.
 *
 * Initialized lazily so build-time imports don't blow up when the
 * RESEND_API_KEY isn't set in non-production environments. Callers
 * are expected to handle errors — never let an email failure bubble
 * up into something user-facing.
 */

import { Resend } from "resend";

let cached: Resend | null = null;

export function getResend(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY is not set");
  }
  cached = new Resend(key);
  return cached;
}

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "Bukowski <bukowski@pacopeptide.com>";
