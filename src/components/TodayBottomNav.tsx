"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LogSheet } from "@/components/LogSheet";

function Icon({
  kind,
  active,
}: {
  kind: "today" | "log" | "bukowski";
  active: boolean;
}) {
  const color = active ? "var(--pp-bg)" : "currentColor";
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (kind === "today") {
    return (
      <svg {...common}>
        <path d="M4 6h16" />
        <path d="M4 12h10" />
        <path d="M4 18h7" />
      </svg>
    );
  }

  if (kind === "log") {
    return (
      <svg {...common}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
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

export function TodayBottomNav() {
  const t = useTranslations("mobile_nav");
  const [logOpen, setLogOpen] = useState(false);

  return (
    <>
      <nav className="pp-mobile-nav" aria-label={t("label")}>
        <Link
          href="/today"
          className="pp-mobile-nav-item is-active"
          aria-current="page"
        >
          <Icon kind="today" active />
          <span>{t("today")}</span>
        </Link>
        <button
          type="button"
          className={
            logOpen ? "pp-mobile-nav-item is-active" : "pp-mobile-nav-item"
          }
          aria-expanded={logOpen}
          onClick={() => setLogOpen(true)}
        >
          <Icon kind="log" active={logOpen} />
          <span>{t("log")}</span>
        </button>
        <Link href="/coach" className="pp-mobile-nav-item">
          <Icon kind="bukowski" active={false} />
          <span>{t("bukowski")}</span>
        </Link>
      </nav>
      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </>
  );
}
