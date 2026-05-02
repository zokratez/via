import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {};

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
