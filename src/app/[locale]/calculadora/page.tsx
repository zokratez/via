import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { buildMetadata, SITE_URL } from "@/lib/seo";
import { CalculatorScreen } from "@/components/CalculatorScreen";

export const dynamic = "force-static";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const seoLocale = locale === "en" ? "en" : "es";
  const t = await getTranslations({
    locale: seoLocale,
    namespace: "calculator",
  });
  return buildMetadata({
    locale: seoLocale,
    title: t("seo_title"),
    description: t("seo_description"),
    pathname: `/${seoLocale}/calculadora`,
    type: "website",
    languages: {
      es: `${SITE_URL}/es/calculadora`,
      en: `${SITE_URL}/en/calculator`,
    },
  });
}

export default async function CalculadoraPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    redirect({ href: "/", locale: routing.defaultLocale });
  }
  setRequestLocale(locale);

  return <CalculatorScreen locale={locale as "es" | "en"} />;
}
