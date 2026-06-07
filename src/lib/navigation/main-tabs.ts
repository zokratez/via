export type MainTabKind = "panel" | "check" | "coach" | "calc" | "search";

export type MainTab = {
  kind: MainTabKind;
  labelKey: "dashboard" | "checkin" | "coach" | "calculator" | "search";
  href?: string;
  matches: (pathname: string, locale: string) => boolean;
};

export function getMainTabs(locale: string): MainTab[] {
  const calculatorHref = locale === "es" ? "/calculadora" : "/calculator";

  return [
    {
      kind: "panel",
      labelKey: "dashboard",
      href: "/dashboard",
      matches: (pathname, currentLocale) =>
        pathname === `/${currentLocale}/dashboard` ||
        pathname === `/${currentLocale}/today`,
    },
    {
      kind: "check",
      labelKey: "checkin",
      href: "/check-in",
      matches: (pathname, currentLocale) => pathname === `/${currentLocale}/check-in`,
    },
    {
      kind: "coach",
      labelKey: "coach",
      href: "/coach",
      matches: (pathname, currentLocale) => pathname === `/${currentLocale}/coach`,
    },
    {
      kind: "calc",
      labelKey: "calculator",
      href: calculatorHref,
      matches: (pathname, currentLocale) =>
        pathname === `/${currentLocale}/calculadora` ||
        pathname === `/${currentLocale}/calculator`,
    },
    {
      kind: "search",
      labelKey: "search",
      matches: () => false,
    },
  ];
}

export function openMainTabSearch() {
  window.dispatchEvent(new Event("paco:open-search"));
}
