"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { useRouter } from "@/i18n/navigation";
import { type NextAction, type SignalState } from "@/lib/mimeta/signals";

type MiMetaSheetCopy = {
  header: string;
  subhead: string;
  footer: string;
};

type MiMetaSheetProps = {
  open: boolean;
  signal: SignalState;
  copy: MiMetaSheetCopy;
  onClose: () => void;
  pillRef: React.RefObject<HTMLButtonElement | null>;
};

function ActionIcon({ icon }: { icon: NextAction["icon"] }) {
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

  if (icon === "scale") {
    return (
      <svg {...common}>
        <path d="M5 20h14" />
        <path d="M7 20 12 4l5 16" />
        <path d="M9 11h6" />
      </svg>
    );
  }

  if (icon === "syringe") {
    return (
      <svg {...common}>
        <path d="m18 2 4 4" />
        <path d="m17 7 2-2" />
        <path d="M3 21 14 10" />
        <path d="m9 15 4 4" />
        <path d="m14 10 4 4" />
        <path d="m6 18 2 2" />
      </svg>
    );
  }

  if (icon === "moon") {
    return (
      <svg {...common}>
        <path d="M21 14.5A8 8 0 0 1 9.5 3 7 7 0 1 0 21 14.5z" />
      </svg>
    );
  }

  if (icon === "calculator") {
    return (
      <svg {...common}>
        <rect x="6" y="3" width="12" height="18" rx="2" />
        <path d="M9 7h6" />
        <path d="M9 11h.01" />
        <path d="M12 11h.01" />
        <path d="M15 11h.01" />
        <path d="M9 15h.01" />
        <path d="M12 15h.01" />
        <path d="M15 15h.01" />
      </svg>
    );
  }

  if (icon === "book-open") {
    return (
      <svg {...common}>
        <path d="M12 7v14" />
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v17H7.5A3.5 3.5 0 0 0 4 22z" />
        <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H12v17h4.5A3.5 3.5 0 0 1 20 22z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
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

export function MiMetaSheet({
  open,
  signal,
  copy,
  onClose,
  pillRef,
}: MiMetaSheetProps) {
  const router = useRouter();
  const sheetRef = useRef<HTMLElement | null>(null);
  const firstActionRef = useRef<HTMLButtonElement | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => {
      firstActionRef.current?.focus();
    });

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
          'button, a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));
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
      (pillRef.current ?? previousActiveElement)?.focus();
    };
  }, [open, onClose, pillRef]);

  if (!open) return null;

  function goTo(action: NextAction) {
    onClose();
    router.push(action.href);
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
      onClose();
      return;
    }
    dragStartRef.current = null;
    setDragOffset(0);
  }

  return (
    <div
      role="presentation"
      className="pp-mimeta-backdrop"
      onClick={onClose}
    >
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mimeta-title"
        className="pp-mimeta-sheet"
        style={{ transform: `translateY(${dragOffset}px)` }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="pp-mimeta-handle-area"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="pp-mimeta-handle" />
        </div>

        <div className="pp-mimeta-content">
          <header className="pp-mimeta-header">
            <h2 id="mimeta-title">{copy.header}</h2>
            <p>{copy.subhead}</p>
          </header>

          <div className="pp-mimeta-status-card">
            <p>{signal.statusSentence}</p>
            <div className="pp-mimeta-progress-track" aria-hidden="true">
              <div
                className="pp-mimeta-progress-fill"
                style={{
                  width: `${Math.max(0, Math.min(1, signal.progressFraction)) * 100}%`,
                }}
              />
            </div>
          </div>

          {signal.nextActions.length > 0 && (
            <div className="pp-mimeta-actions">
              {signal.nextActions.slice(0, 3).map((action, index) => (
                <button
                  key={`${action.icon}-${action.href}`}
                  type="button"
                  ref={index === 0 ? firstActionRef : undefined}
                  onClick={() => goTo(action)}
                  className="pp-mimeta-action-row"
                >
                  <span className="pp-mimeta-action-icon">
                    <ActionIcon icon={action.icon} />
                  </span>
                  <span>{action.label}</span>
                  <ChevronIcon />
                </button>
              ))}
            </div>
          )}

          <p className="pp-mimeta-footer">{copy.footer}</p>
        </div>
      </section>
    </div>
  );
}
