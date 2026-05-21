import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { enforceActiveSubscription } from "@/lib/subscription-guard";

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

export default async function DailyCheckInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: "/auth/sign-in", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user!.id)
    .maybeSingle();

  await enforceActiveSubscription({
    tier: profile?.subscription_tier,
    locale: locale as "es" | "en",
  });

  const t = await getTranslations("checkin");
  const tApp = await getTranslations("app");
  const tAuth = await getTranslations("auth");

  const navLinkStyle: React.CSSProperties = {
    fontFamily: SANS,
    fontSize: "12px",
    letterSpacing: "0.24em",
    textTransform: "uppercase",
    color: "var(--pp-text-secondary)",
    textDecoration: "none",
  };

  const eyebrowStyle: React.CSSProperties = {
    fontFamily: SANS,
    fontSize: "11px",
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: "var(--pp-text-secondary)",
    fontWeight: 500,
    margin: 0,
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--pp-surface)",
    border: "0.5px solid var(--pp-border)",
    borderRadius: "12px",
    padding: "1rem",
  };

  const steps = [
    {
      href: "/log/weight",
      eyebrow: t("step_weight_eyebrow"),
      title: t("step_weight_title"),
      body: t("step_weight_body"),
      color: "#c9966b",
    },
    {
      href: "/log/dose",
      eyebrow: t("step_dose_eyebrow"),
      title: t("step_dose_title"),
      body: t("step_dose_body"),
      color: "#f0a15f",
    },
    {
      href: "/log/sleep",
      eyebrow: t("step_sleep_eyebrow"),
      title: t("step_sleep_title"),
      body: t("step_sleep_body"),
      color: "#7db9ff",
    },
    {
      href: "/log/symptom",
      eyebrow: t("step_symptom_eyebrow"),
      title: t("step_symptom_title"),
      body: t("step_symptom_body"),
      color: "#ef7b8a",
    },
    {
      href: "/coach",
      eyebrow: t("step_coach_eyebrow"),
      title: t("step_coach_title"),
      body: t("step_coach_body"),
      color: "#88d39f",
    },
  ] as const;

  const comingSoon = [
    {
      href: "/progress",
      eyebrow: t("future_photo_eyebrow"),
      title: t("future_photo_title"),
      body: t("future_photo_body"),
      active: true,
    },
    {
      href: null,
      eyebrow: t("future_food_eyebrow"),
      title: t("future_food_title"),
      body: t("future_food_body"),
      active: false,
    },
  ] as const;

  return (
    <div
      className="flex flex-col flex-1"
      style={{
        background: "var(--pp-bg)",
        color: "var(--pp-text)",
        fontFamily: SERIF,
        minHeight: "100vh",
      }}
    >
      <header
        className="mx-auto w-full"
        style={{
          maxWidth: "880px",
          padding: "1.5rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link href="/dashboard" style={navLinkStyle}>
          {tApp("name")}
        </Link>
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            alignItems: "center",
          }}
        >
          <Link href="/dashboard" style={navLinkStyle}>
            {t("nav_dashboard")}
          </Link>
          <LocaleSwitcher />
          <SignOutButton label={tAuth("sign_out")} />
        </div>
      </header>

      <main
        className="flex-1 mx-auto w-full"
        style={{ maxWidth: "760px", padding: "2.5rem 1.5rem 5rem" }}
      >
        <Link
          href="/dashboard"
          style={{
            ...navLinkStyle,
            display: "inline-block",
            marginBottom: "1.5rem",
          }}
          className="hover:text-[var(--pp-accent)]"
        >
          {t("back")}
        </Link>

        <section
          style={{
            ...cardStyle,
            padding: "1.25rem",
            background:
              "radial-gradient(circle at 85% 0%, rgba(201, 150, 107, 0.2), transparent 34%), linear-gradient(135deg, rgba(201, 150, 107, 0.12), rgba(34, 28, 25, 0.96) 44%, rgba(26, 22, 20, 0.98))",
            borderColor: "rgba(201, 150, 107, 0.32)",
          }}
          className="pp-fade-up"
        >
          <p style={eyebrowStyle}>{t("eyebrow")}</p>
          <h1
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "clamp(42px, 11vw, 72px)",
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              fontWeight: 400,
              color: "var(--pp-text)",
              margin: "0.8rem 0 0",
            }}
          >
            {t("title")}
          </h1>
          <p
            style={{
              fontFamily: SERIF,
              color: "var(--pp-text-secondary)",
              fontSize: "18px",
              lineHeight: 1.55,
              maxWidth: "580px",
              margin: "1rem 0 0",
            }}
          >
            {t("body")}
          </p>
        </section>

        <section
          className="grid gap-3 sm:grid-cols-2"
          style={{ marginTop: "1rem" }}
          aria-label={t("steps_label")}
        >
          {steps.map((step, index) => (
            <Link
              key={step.href}
              href={step.href}
              className="pp-stat-card"
              style={{
                ...cardStyle,
                minHeight: "152px",
                textDecoration: "none",
                borderColor: `${step.color}66`,
                background: `linear-gradient(145deg, color-mix(in srgb, ${step.color} 9%, transparent), rgba(26, 22, 20, 0.68))`,
                animationDelay: `${index * 0.06}s`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  alignItems: "flex-start",
                }}
              >
                <p style={eyebrowStyle}>{step.eyebrow}</p>
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "999px",
                    background: step.color,
                    boxShadow: `0 0 22px ${step.color}80`,
                    flex: "0 0 auto",
                    marginTop: "0.15rem",
                  }}
                />
              </div>
              <h2
                style={{
                  fontFamily: SERIF,
                  fontStyle: "italic",
                  color: step.color,
                  fontSize: "28px",
                  fontWeight: 400,
                  lineHeight: 1.05,
                  margin: "1rem 0 0",
                }}
              >
                {step.title}
              </h2>
              <p
                style={{
                  fontFamily: SANS,
                  color: "var(--pp-text-secondary)",
                  fontSize: "12px",
                  lineHeight: 1.6,
                  margin: "0.7rem 0 0",
                }}
              >
                {step.body}
              </p>
            </Link>
          ))}
        </section>

        <section
          className="grid gap-3 sm:grid-cols-2"
          style={{ marginTop: "1rem" }}
          aria-label={t("future_label")}
        >
          {comingSoon.map((item) => (
            item.href ? (
              <Link
                key={item.title}
                href={item.href}
                className="pp-stat-card"
                style={{
                  ...cardStyle,
                  minHeight: "128px",
                  textDecoration: "none",
                  borderColor: "rgba(201, 150, 107, 0.42)",
                }}
              >
                <p style={eyebrowStyle}>{item.eyebrow}</p>
                <h2
                  style={{
                    fontFamily: SERIF,
                    fontStyle: "italic",
                    color: "var(--pp-accent)",
                    fontSize: "25px",
                    fontWeight: 400,
                    lineHeight: 1.05,
                    margin: "0.8rem 0 0",
                  }}
                >
                  {item.title}
                </h2>
                <p
                  style={{
                    fontFamily: SANS,
                    color: "var(--pp-text-tertiary)",
                    fontSize: "12px",
                    lineHeight: 1.6,
                    margin: "0.7rem 0 0",
                  }}
                >
                  {item.body}
                </p>
              </Link>
            ) : (
              <div
                key={item.title}
                style={{
                  ...cardStyle,
                  minHeight: "128px",
                  borderStyle: "dashed",
                  opacity: 0.78,
                }}
              >
                <p style={eyebrowStyle}>{item.eyebrow}</p>
                <h2
                  style={{
                    fontFamily: SERIF,
                    fontStyle: "italic",
                    color: "var(--pp-text)",
                    fontSize: "25px",
                    fontWeight: 400,
                    lineHeight: 1.05,
                    margin: "0.8rem 0 0",
                  }}
                >
                  {item.title}
                </h2>
                <p
                  style={{
                    fontFamily: SANS,
                    color: "var(--pp-text-tertiary)",
                    fontSize: "12px",
                    lineHeight: 1.6,
                    margin: "0.7rem 0 0",
                  }}
                >
                  {item.body}
                </p>
              </div>
            )
          ))}
        </section>
      </main>
    </div>
  );
}
