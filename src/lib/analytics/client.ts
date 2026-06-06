"use client";

import {
  type AnalyticsEventName,
  type AnalyticsLocale,
  type AnalyticsProps,
  sanitizeAnalyticsProps,
} from "./events";

const ANON_ID_KEY = "paco_anon_id";

function getOrCreateAnonId(): string {
  try {
    const existing = window.localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(ANON_ID_KEY, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

export function track(
  eventName: AnalyticsEventName,
  input: {
    locale: AnalyticsLocale;
    props?: AnalyticsProps;
  },
): void {
  const payload = {
    eventName,
    locale: input.locale,
    anonId: getOrCreateAnonId(),
    props: sanitizeAnalyticsProps(eventName, input.props ?? {}),
  };

  void fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Analytics is best-effort; never interrupt the user flow.
  });
}
