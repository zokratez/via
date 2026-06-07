export const ANALYTICS_EVENT_NAMES = [
  "landing_view",
  "signup_started",
  "signup_completed",
  "onboarding_started",
  "onboarding_completed",
  "first_log",
  "coach_message_sent",
  "paywall_viewed",
  "paywall_dismissed",
  "checkout_started",
  "trial_started",
  "subscription_active",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
export type AnalyticsLocale = "es" | "en";

export type AnalyticsProps = Record<
  string,
  string | number | boolean | null
>;

const ALLOWED_PROPS: Record<AnalyticsEventName, readonly string[]> = {
  landing_view: [
    "pathname",
    "referrer",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ],
  signup_started: ["method", "plan"],
  signup_completed: ["method", "plan"],
  onboarding_started: ["step"],
  onboarding_completed: ["skipped", "checkout_started"],
  first_log: ["log_type"],
  coach_message_sent: ["surface"],
  paywall_viewed: ["surface", "plan"],
  paywall_dismissed: ["surface"],
  checkout_started: ["surface", "plan"],
  trial_started: ["source", "plan"],
  subscription_active: ["source", "plan"],
};

export const DEDUPED_ANALYTICS_EVENTS = new Set<AnalyticsEventName>([
  "first_log",
  "trial_started",
  "subscription_active",
]);

export function isAnalyticsEventName(value: unknown): value is AnalyticsEventName {
  return (
    typeof value === "string" &&
    (ANALYTICS_EVENT_NAMES as readonly string[]).includes(value)
  );
}

export function isAnalyticsLocale(value: unknown): value is AnalyticsLocale {
  return value === "es" || value === "en";
}

export function sanitizeAnalyticsProps(
  eventName: AnalyticsEventName,
  props: unknown,
): AnalyticsProps {
  if (!props || typeof props !== "object" || Array.isArray(props)) return {};
  const source = props as Record<string, unknown>;
  const allowed = new Set(ALLOWED_PROPS[eventName]);
  const safe: AnalyticsProps = {};

  for (const key of allowed) {
    const value = source[key];
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      safe[key] =
        typeof value === "string" && value.length > 300
          ? value.slice(0, 300)
          : value;
    }
  }

  return safe;
}
