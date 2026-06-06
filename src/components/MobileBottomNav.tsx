"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LogSheet } from "@/components/LogSheet";
import { createClient } from "@/lib/supabase/client";

const HIDDEN_PATH_RE =
  /^\/(es|en)\/(auth|privacy|terms|reviews\/submit)(\/.*)?$/;

function Icon({
  kind,
  active,
}: {
  kind: "panel" | "check" | "coach" | "calc" | "search";
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

  if (kind === "panel") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }

  if (kind === "check") {
    return (
      <svg {...common}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }

  if (kind === "coach") {
    return (
      <svg {...common}>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
      </svg>
    );
  }

  if (kind === "calc") {
    return (
      <svg {...common}>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M8 7h8" />
        <path d="M8 11h.01" />
        <path d="M12 11h.01" />
        <path d="M16 11h.01" />
        <path d="M8 15h.01" />
        <path d="M12 15h.01" />
        <path d="M16 15h.01" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4.5-4.5" />
    </svg>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("mobile_nav");
  const tLogSheet = useTranslations("log_sheet");
  const [isLogSheetOpen, setIsLogSheetOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (mounted) setIsAuthenticated(Boolean(data.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!pathname.startsWith(`/${locale}`)) return null;
  if (HIDDEN_PATH_RE.test(pathname)) return null;
  if (!isAuthenticated) return null;

  const calculatorHref = locale === "es" ? "/calculadora" : "/calculator";
  const items = [
    {
      href: "/dashboard",
      label: t("dashboard"),
      kind: "panel" as const,
      active:
        pathname === `/${locale}/dashboard` || pathname === `/${locale}/today`,
    },
    {
      href: "/check-in",
      label: t("checkin"),
      kind: "check" as const,
      active: pathname === `/${locale}/check-in`,
    },
    {
      href: "/coach",
      label: t("coach"),
      kind: "coach" as const,
      active: pathname === `/${locale}/coach`,
    },
    {
      href: calculatorHref,
      label: t("calculator"),
      kind: "calc" as const,
      active:
        pathname === `/${locale}/calculadora` ||
        pathname === `/${locale}/calculator`,
    },
  ];

  function openSearch() {
    window.dispatchEvent(new Event("paco:open-search"));
  }

  return (
    <>
      <nav className="pp-mobile-nav" aria-label={t("label")}>
        <button
          type="button"
          className="pp-mobile-nav-log-action"
          onClick={() => setIsLogSheetOpen(true)}
          aria-label={tLogSheet("title")}
          aria-haspopup="dialog"
          aria-expanded={isLogSheetOpen}
        >
          <span aria-hidden="true">+</span>
        </button>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              item.active ? "pp-mobile-nav-item is-active" : "pp-mobile-nav-item"
            }
            aria-current={item.active ? "page" : undefined}
          >
            <Icon kind={item.kind} active={item.active} />
            <span>{item.label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={openSearch}
          className="pp-mobile-nav-item"
        >
          <Icon kind="search" active={false} />
          <span>{t("search")}</span>
        </button>
      </nav>
      <LogSheet
        open={isLogSheetOpen}
        onClose={() => setIsLogSheetOpen(false)}
      />
    </>
  );
}
