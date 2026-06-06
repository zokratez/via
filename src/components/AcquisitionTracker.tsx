"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { track } from "@/lib/analytics/client";
import { type AnalyticsLocale, type AnalyticsProps } from "@/lib/analytics/events";

const SESSION_KEY = "paco_landing_view_tracked";
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export function AcquisitionTracker() {
  const pathname = usePathname();
  const locale = useLocale() as AnalyticsLocale;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return;
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // If session storage is unavailable, still attempt a best-effort ping.
    }

    const params = new URLSearchParams(window.location.search);
    const props: AnalyticsProps = {
      pathname,
      referrer: document.referrer || null,
    };
    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) props[key] = value;
    }

    track("landing_view", { locale, props });
  }, [locale, pathname]);

  return null;
}
