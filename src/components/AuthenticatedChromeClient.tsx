"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { MiMeta } from "@/components/MiMeta";
import { type SignalState } from "@/lib/mimeta/signals";

function publicSignal(locale: string): SignalState {
  return {
    hasNewSignal: false,
    signalId: null,
    statusSentence:
      locale === "es"
        ? "Tu meta empieza cuando creas tu registro."
        : "Your goal starts when you create your record.",
    progressFraction: 0,
    nextActions: [],
  };
}

export function AuthenticatedChromeClient() {
  const locale = useLocale();
  const [signal, setSignal] = useState<SignalState>(() => publicSignal(locale));
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setSignal(publicSignal(locale));
    setIsAuthenticated(false);

    void (async () => {
      try {
        const res = await fetch("/api/mimeta/signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale }),
          signal: controller.signal,
        });
        if (res.status === 401) return;
        if (!res.ok) return;
        const payload = (await res.json()) as { signal?: SignalState };
        if (payload.signal) {
          setSignal(payload.signal);
          setIsAuthenticated(true);
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setSignal(publicSignal(locale));
          setIsAuthenticated(false);
        }
      }
    })();

    return () => controller.abort();
  }, [locale]);

  return (
    <MiMeta
      signal={signal}
      surface="today"
      signupHref={isAuthenticated ? undefined : "/auth/sign-up"}
    />
  );
}
