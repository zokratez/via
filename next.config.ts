import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  },
];

const noStoreHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
];

const protectedRouteHeaders = [
  "/:locale(es|en)/admin",
  "/:locale(es|en)/admin/:path*",
  "/:locale(es|en)/calendar",
  "/:locale(es|en)/calendar/:path*",
  "/:locale(es|en)/coach",
  "/:locale(es|en)/coach/:path*",
  "/:locale(es|en)/dashboard",
  "/:locale(es|en)/dashboard/:path*",
  "/:locale(es|en)/log",
  "/:locale(es|en)/log/:path*",
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      ...protectedRouteHeaders.map((source) => ({
        source,
        headers: noStoreHeaders,
      })),
      {
        source: "/api/:path*",
        headers: noStoreHeaders,
      },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  // v10 replacement for hideSourceMaps. We are not uploading source maps
  // to Sentry yet (no SENTRY_AUTH_TOKEN), so disable generation entirely
  // to keep build output clean. Flip to
  // `sourcemaps: { deleteSourcemapsAfterUpload: true }` once Sam adds
  // the auth token for full symbolication.
  sourcemaps: { disable: true },
  disableLogger: true,
});
