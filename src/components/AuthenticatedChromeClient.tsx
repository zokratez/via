"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { MiMeta } from "@/components/MiMeta";
import { type SignalState } from "@/lib/mimeta/signals";

const APP_SURFACE_RE =
  /^\/(es|en)\/(today|dashboard|check-in|coach|calendar|goals|food|progress|log|admin|calculadora|calculator)(\/.*)?$/;

export function AuthenticatedChromeClient() {
  const pathname = usePathname();
  const locale = useLocale();
  const [signal, setSignal] = useState<SignalState | null>(null);

  const shouldShow = APP_SURFACE_RE.test(pathname);

  useEffect(() => {
    if (!shouldShow) {
      setSignal(null);
      return;
    }

    const controller = new AbortController();
    setSignal(null);
    void (async () => {
      try {
        const res = await fetch("/api/mimeta/signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale }),
          signal: controller.signal,
        });
        if (!res.ok) return;
        const payload = (await res.json()) as { signal?: SignalState };
        setSignal(payload.signal ?? null);
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setSignal(null);
        }
      }
    })();

    return () => controller.abort();
  }, [locale, shouldShow]);

  if (!shouldShow || !signal) return null;

  return <MiMeta signal={signal} surface="today" />;
}
