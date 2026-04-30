"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Props = {
  locale: "es" | "en";
};

export function ManageSubscriptionLink({ locale }: Props) {
  const t = useTranslations("dashboard");
  const tPaywall = useTranslations("paywall");
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  async function open() {
    if (isLoading) return;
    setIsLoading(true);
    setHasError(false);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) {
        setHasError(true);
        setIsLoading(false);
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) {
        setHasError(true);
        setIsLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setHasError(true);
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={open}
        disabled={isLoading}
        className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-60"
      >
        {t("manage_subscription")}
      </button>
      {hasError && (
        <span className="mt-1 text-xs text-destructive">
          {tPaywall("checkout_error")}
        </span>
      )}
    </div>
  );
}
