"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LogSheet } from "@/components/LogSheet";
import { createClient } from "@/lib/supabase/client";
import {
  getMainTabs,
  openMainTabSearch,
  type MainTabKind,
} from "@/lib/navigation/main-tabs";

const HIDDEN_PATH_RE =
  /^\/(es|en)\/(auth|privacy|terms|reviews\/submit)(\/.*)?$/;

function Icon({
  kind,
  active,
}: {
  kind: MainTabKind;
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

  const items = getMainTabs(locale);

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
          item.href ? (
            <Link
              key={item.kind}
              href={item.href}
              className={
                item.matches(pathname, locale)
                  ? "pp-mobile-nav-item is-active"
                  : "pp-mobile-nav-item"
              }
              aria-current={item.matches(pathname, locale) ? "page" : undefined}
            >
              <Icon kind={item.kind} active={item.matches(pathname, locale)} />
              <span>{t(item.labelKey)}</span>
            </Link>
          ) : (
            <button
              key={item.kind}
              type="button"
              onClick={openMainTabSearch}
              className="pp-mobile-nav-item"
            >
              <Icon kind={item.kind} active={false} />
              <span>{t(item.labelKey)}</span>
            </button>
          )
        ))}
      </nav>
      <LogSheet
        open={isLogSheetOpen}
        onClose={() => setIsLogSheetOpen(false)}
      />
    </>
  );
}
