"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { type SignalState } from "@/lib/mimeta/signals";
import { MiMetaSheet } from "@/components/MiMetaSheet";
import { useRouter } from "@/i18n/navigation";

const LAST_SEEN_SIGNAL_KEY = "mimeta_last_seen_signal_id";

function TargetIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function MiMeta({
  signal,
  surface = "dashboard",
  signupHref,
}: {
  signal: SignalState;
  surface?: "dashboard" | "today";
  signupHref?: string;
}) {
  const t = useTranslations("mimeta");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hasUnseenSignal, setHasUnseenSignal] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const pillRef = useRef<HTMLButtonElement | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!signal.hasNewSignal || !signal.signalId) {
      setHasUnseenSignal(false);
      return;
    }

    const lastSeen = window.localStorage.getItem(LAST_SEEN_SIGNAL_KEY);
    setHasUnseenSignal(lastSeen !== signal.signalId);
  }, [signal.hasNewSignal, signal.signalId]);

  useEffect(() => {
    function onScroll() {
      setScrolling(true);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        setScrolling(false);
      }, 200);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  function openSheet() {
    if (signupHref) {
      router.push(signupHref);
      return;
    }

    if (signal.signalId) {
      window.localStorage.setItem(LAST_SEEN_SIGNAL_KEY, signal.signalId);
    }
    setHasUnseenSignal(false);
    setOpen(true);
  }

  const ariaLabel = hasUnseenSignal
    ? `${t("pill_label")} (${t("aria_new_observation")})`
    : t("pill_label");

  return (
    <>
      <div
        className="pp-mimeta-anchor"
        data-surface={surface}
        style={{ opacity: scrolling ? 0.3 : 1 }}
      >
        <button
          ref={pillRef}
          type="button"
          className="pp-mimeta-pill"
          aria-label={ariaLabel}
          onClick={openSheet}
        >
          <span className="pp-mimeta-pill-icon">
            <TargetIcon />
          </span>
          <span>{t("pill_label")}</span>
          {hasUnseenSignal && (
            <span className="pp-mimeta-signal-dot" aria-hidden="true">
              ✓
            </span>
          )}
        </button>
      </div>

      <MiMetaSheet
        open={open}
        signal={signal}
        copy={{
          header: t("sheet_header"),
          subhead: t("sheet_subhead"),
          footer: t("sheet_footer"),
        }}
        onClose={() => setOpen(false)}
        pillRef={pillRef}
      />
    </>
  );
}
