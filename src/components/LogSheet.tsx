"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type LogVerb = {
  key:
    | "dose"
    | "food"
    | "weight"
    | "water"
    | "sleep"
    | "symptom"
    | "progress"
    | "note";
  href?: string;
  disabled?: boolean;
};

const VERBS: LogVerb[] = [
  { key: "dose", href: "/log/dose" },
  { key: "food", href: "/food" },
  { key: "weight", href: "/log/weight" },
  { key: "water", href: "/log/water" },
  { key: "sleep", href: "/log/sleep" },
  { key: "symptom", href: "/log/symptom" },
  { key: "progress", href: "/progress" },
  { key: "note", disabled: true },
];

function VerbIcon({ kind }: { kind: LogVerb["key"] }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (kind === "dose") {
    return (
      <svg {...common}>
        <path d="m18 2 4 4" />
        <path d="m17 7 2-2" />
        <path d="M3 21 14 10" />
        <path d="m9 15 4 4" />
        <path d="m14 10 4 4" />
      </svg>
    );
  }

  if (kind === "food") {
    return (
      <svg {...common}>
        <path d="M8 2v20" />
        <path d="M4 2v7a4 4 0 0 0 8 0V2" />
        <path d="M16 2v20" />
        <path d="M16 2c3 2 4 5 4 9h-4" />
      </svg>
    );
  }

  if (kind === "weight") {
    return (
      <svg {...common}>
        <path d="M5 20h14" />
        <path d="M7 20 12 4l5 16" />
        <path d="M9 11h6" />
      </svg>
    );
  }

  if (kind === "water") {
    return (
      <svg {...common}>
        <path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11z" />
      </svg>
    );
  }

  if (kind === "sleep") {
    return (
      <svg {...common}>
        <path d="M21 14.5A8 8 0 0 1 9.5 3 7 7 0 1 0 21 14.5z" />
      </svg>
    );
  }

  if (kind === "symptom") {
    return (
      <svg {...common}>
        <path d="M12 7v6" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      </svg>
    );
  }

  if (kind === "progress") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8" cy="10" r="1.5" />
        <path d="m21 15-4-4-6 6-3-3-5 5" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h10" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function LogSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("log_sheet");
  const sheetRef = useRef<HTMLElement | null>(null);
  const firstActionRef = useRef<HTMLButtonElement | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;

    setDragOffset(0);
    const previousActiveElement = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => firstActionRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const focusable = Array.from(
        sheet.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousActiveElement?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  function goTo(href: string) {
    onClose();
    router.push(href);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragStartRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStartRef.current === null) return;
    setDragOffset(Math.max(0, event.clientY - dragStartRef.current));
  }

  function onPointerUp() {
    if (dragOffset > 100) {
      setDragOffset(0);
      onClose();
      return;
    }
    dragStartRef.current = null;
    setDragOffset(0);
  }

  const backdropStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.44)",
    padding: "0 1rem",
  };

  const sheetStyle: React.CSSProperties = {
    width: "min(100%, 540px)",
    maxHeight: "72vh",
    overflowY: "auto",
    borderRadius: "24px 24px 0 0",
    border: "1px solid rgba(255, 255, 255, 0.09)",
    borderBottom: "none",
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0)), #1a1614",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.14), 0 -18px 55px rgba(0,0,0,0.44)",
    transform: `translateY(${dragOffset}px)`,
    animation: "pp-mimeta-sheet-in 0.35s cubic-bezier(0.32, 0.72, 0, 1) both",
  };

  return (
    <div role="presentation" style={backdropStyle} onClick={onClose}>
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-sheet-title"
        style={sheetStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            padding: "12px 24px 0",
            touchAction: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            style={{
              width: "40px",
              height: "4px",
              borderRadius: "999px",
              background: "rgba(255, 255, 255, 0.2)",
              margin: "0 auto",
            }}
          />
        </div>

        <div style={{ padding: "24px 24px 28px" }}>
          <header
            style={{
              display: "flex",
              alignItems: "start",
              justifyContent: "space-between",
              gap: "1rem",
              marginBottom: "18px",
            }}
          >
            <div>
              <p
                style={{
                  margin: "0 0 0.35rem",
                  fontFamily: "var(--pp-font-sans)",
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(201, 150, 107, 0.72)",
                }}
              >
                {t("eyebrow")}
              </p>
              <h2
                id="log-sheet-title"
                style={{
                  margin: 0,
                  fontFamily: "var(--pp-font-serif)",
                  fontSize: "28px",
                  fontStyle: "italic",
                  fontWeight: 400,
                  color: "var(--pp-text)",
                  letterSpacing: "-0.03em",
                }}
              >
                {t("title")}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "999px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.06)",
                color: "var(--pp-text-secondary)",
                display: "grid",
                placeItems: "center",
              }}
            >
              ×
            </button>
          </header>

          <div>
            {VERBS.map((verb, index) => {
              const disabled = verb.disabled || !verb.href;
              return (
                <button
                  key={verb.key}
                  ref={index === 0 ? firstActionRef : undefined}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (verb.href) goTo(verb.href);
                  }}
                  style={{
                    width: "100%",
                    minHeight: "56px",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.85rem",
                    padding: "0.7rem 0",
                    border: 0,
                    borderTop:
                      index === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                    background: "transparent",
                    color: disabled
                      ? "rgba(255,255,255,0.34)"
                      : "var(--pp-text)",
                    cursor: disabled ? "default" : "pointer",
                    textAlign: "left",
                    opacity: disabled ? 0.74 : 1,
                  }}
                >
                  <span
                    style={{
                      color: disabled
                        ? "rgba(201,150,107,0.32)"
                        : "rgba(201,150,107,0.72)",
                      flex: "0 0 auto",
                    }}
                  >
                    <VerbIcon kind={verb.key} />
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontFamily: "var(--pp-font-serif)",
                      fontSize: "18px",
                    }}
                  >
                    {t(verb.key)}
                  </span>
                  {disabled ? (
                    <span
                      style={{
                        borderRadius: "999px",
                        border: "1px solid rgba(255,255,255,0.08)",
                        padding: "0.2rem 0.45rem",
                        fontFamily: "var(--pp-font-sans)",
                        fontSize: "9px",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.42)",
                      }}
                    >
                      {t("soon")}
                    </span>
                  ) : (
                    <span style={{ color: "rgba(255,255,255,0.3)" }}>
                      <ChevronIcon />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
