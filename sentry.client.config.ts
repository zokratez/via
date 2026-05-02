import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;
const isProd = process.env.NODE_ENV === "production";

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || "development",
    tracesSampleRate: isProd ? 0.2 : 1.0,
    // Replay disabled — costs money and we don't need it at this stage.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event, hint) {
      // Drop browser noise that clutters Sentry without representing bugs.
      const exception = hint?.originalException;
      if (exception && typeof exception === "object" && "message" in exception) {
        const msg = String((exception as Error).message);
        if (/ResizeObserver loop/.test(msg)) return null;
      }

      // Filter health-check / probe pings if any reach the client.
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
