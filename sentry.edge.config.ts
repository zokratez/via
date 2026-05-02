import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || "development",
    tracesSampleRate: 0.5,
    beforeSend(event) {
      // Filter health-check / probe pings.
      const url = event.request?.url ?? "";
      if (/\/(health|ping|status)(\b|\/)/.test(url)) return null;

      // PII redaction: drop body, cookies, and all headers except User-Agent.
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          const headers = event.request.headers as Record<string, string>;
          const ua = headers["user-agent"] ?? headers["User-Agent"];
          event.request.headers = ua ? { "user-agent": ua } : {};
        }
      }
      return event;
    },
  });
}
