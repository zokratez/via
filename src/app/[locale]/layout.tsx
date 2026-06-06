import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthenticatedChromeClient } from "@/components/AuthenticatedChromeClient";
import { Footer } from "@/components/Footer";
import { FooterGate } from "@/components/FooterGate";
import { GlobalSearch } from "@/components/GlobalSearch";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { SwipeNavClient } from "@/components/SwipeNavClient";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app" });
  const rssTitle =
    locale === "es" ? "Diario — PACO Peptide" : "Journal — PACO Peptide";
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("name"), template: `%s — ${t("name")}` },
    description: t("description"),
    alternates: {
      types: {
        "application/rss+xml": [
          { url: `${SITE_URL}/${locale}/feed.xml`, title: rssTitle },
        ],
      },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div style={{ overflowX: "hidden", width: "100%" }}>
        {children}
        <FooterGate>
          <Footer locale={locale as "es" | "en"} />
        </FooterGate>
      </div>
      <GlobalSearch />
      <AuthenticatedChromeClient />
      <MobileBottomNav />
      <SwipeNavClient />
    </NextIntlClientProvider>
  );
}
