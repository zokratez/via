/**
 * SEO metadata helper.
 *
 * Centralizes the OG / Twitter / canonical shape so every page's
 * generateMetadata stays short. Per-page input: locale, title,
 * description, pathname (locale-prefixed, e.g. "/es/diario"), and
 * optional type/publishedTime/keywords/languages.
 *
 * Base URL is read from NEXT_PUBLIC_SITE_URL with a hardcoded
 * production fallback. Sam keeps Vercel env in sync; the fallback
 * keeps local dev + accidental misconfig safe.
 *
 * og:image points to /og-default.png on the same origin. The actual
 * PNG ships separately (Sam's call) — until then the path 404s but
 * the meta tag is present and crawler-correct.
 */

import type { Metadata } from "next";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://www.pacopeptide.com";

export type SeoLocale = "es" | "en";

export function ogLocale(locale: SeoLocale): "es_ES" | "en_US" {
  return locale === "es" ? "es_ES" : "en_US";
}

export type BuildMetadataInput = {
  locale: SeoLocale;
  title: string;
  description: string;
  /** Locale-prefixed pathname, e.g. "/es/diario". Used for canonical + og:url. */
  pathname: string;
  type?: "website" | "article";
  publishedTime?: string;
  keywords?: string[];
  /** Override locale alternates when the cross-locale path differs (e.g. /es/diario ↔ /en/journal). */
  languages?: Record<string, string>;
};

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const {
    locale,
    title,
    description,
    pathname,
    type = "website",
    publishedTime,
    keywords,
    languages,
  } = input;

  const url = `${SITE_URL}${pathname}`;
  const ogImage = `${SITE_URL}/og-default.png`;

  return {
    title,
    description,
    ...(keywords && keywords.length > 0 ? { keywords } : {}),
    alternates: {
      canonical: url,
      ...(languages ? { languages } : {}),
    },
    openGraph: {
      title,
      description,
      url,
      type,
      siteName: "PACO Peptide",
      locale: ogLocale(locale),
      images: [{ url: ogImage, width: 1200, height: 630 }],
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}
