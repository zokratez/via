"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { LogSheet } from "@/components/LogSheet";
import { track } from "@/lib/analytics/client";
import { saveOnboardingGoalAction } from "./actions";

type Locale = "es" | "en";
type Step = "welcome" | "goal" | "activate" | "aha" | "paywall";
type LoggedKind = "dose" | "weight" | null;
type Focus = "dose" | "weight" | "protein";
type GoalType = "lose" | "maintain" | "gain";
type Plan = "annual" | "monthly";

const SANS = "var(--pp-font-sans)";
const SERIF = "var(--pp-font-serif)";

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "calc(env(safe-area-inset-top, 0px) + 28px) 18px 140px",
  background:
    "radial-gradient(circle at 20% 0%, rgba(201,150,107,0.12), transparent 34%), var(--pp-bg)",
  color: "var(--pp-text)",
};

const cardStyle: React.CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: "28px",
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.018)), rgba(26,22,20,0.72)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.18), 0 24px 70px rgba(0,0,0,0.34)",
  backdropFilter: "blur(22px) saturate(160%)",
  WebkitBackdropFilter: "blur(22px) saturate(160%)",
  padding: "26px",
};

const eyebrowStyle: React.CSSProperties = {
  margin: "0 0 0.65rem",
  fontFamily: SANS,
  fontSize: "11px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--pp-accent)",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: SERIF,
  fontStyle: "italic",
  fontWeight: 400,
  fontSize: "clamp(42px, 12vw, 64px)",
  lineHeight: 0.92,
  letterSpacing: "-0.04em",
};

const bodyStyle: React.CSSProperties = {
  margin: "1.1rem 0 0",
  fontFamily: SERIF,
  fontStyle: "italic",
  fontSize: "19px",
  lineHeight: 1.38,
  color: "var(--pp-text-secondary)",
};

const primaryStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "52px",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "999px",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04)), rgba(255,255,255,0.08)",
  color: "var(--pp-accent)",
  fontFamily: SANS,
  fontSize: "12px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.24), 0 12px 30px rgba(0,0,0,0.24)",
};

const secondaryStyle: React.CSSProperties = {
  ...primaryStyle,
  background: "transparent",
  color: "var(--pp-text-secondary)",
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "none",
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    minHeight: "48px",
    borderRadius: "16px",
    border: active
      ? "1px solid rgba(201,150,107,0.75)"
      : "1px solid rgba(255,255,255,0.12)",
    background: active
      ? "rgba(201,150,107,0.16)"
      : "rgba(255,255,255,0.035)",
    color: active ? "var(--pp-accent)" : "var(--pp-text-secondary)",
    fontFamily: SANS,
    fontSize: "11px",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    cursor: "pointer",
    padding: "0 12px",
  };
}

export function OnboardingClient({
  locale,
  initialStep,
  loggedKind,
  miMetaSentence,
  bukowskiLine,
}: {
  locale: Locale;
  initialStep: Step;
  loggedKind: LoggedKind;
  miMetaSentence: string;
  bukowskiLine: string;
}) {
  const t = useTranslations("onboarding");
  const tPaywall = useTranslations("paywall");
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);
  const [focus, setFocus] = useState<Focus>("dose");
  const [goalType, setGoalType] = useState<GoalType>("lose");
  const [protein, setProtein] = useState(120);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isSavingGoal, startSavingGoal] = useTransition();
  const [isCheckingOut, startCheckout] = useTransition();
  const [isLogSheetOpen, setIsLogSheetOpen] = useState(false);

  useEffect(() => {
    track("onboarding_started", {
      locale,
      props: { step: initialStep },
    });
  }, [initialStep, locale]);

  useEffect(() => {
    if (step !== "aha" || !loggedKind) return;
    track("first_log", {
      locale,
      props: { log_type: loggedKind },
    });
  }, [locale, loggedKind, step]);

  useEffect(() => {
    if (step !== "paywall") return;
    track("paywall_viewed", {
      locale,
      props: { surface: "onboarding" },
    });
  }, [locale, step]);

  const progress = useMemo(() => {
    const order: Step[] = ["welcome", "goal", "activate", "aha", "paywall"];
    return order.indexOf(step) + 1;
  }, [step]);

  function finishOnboarding(skipped: boolean) {
    track("onboarding_completed", {
      locale,
      props: { skipped },
    });
    router.push("/today");
  }

  function dismissPaywall() {
    track("paywall_dismissed", {
      locale,
      props: { surface: "onboarding" },
    });
    finishOnboarding(false);
  }

  function saveGoalThenContinue() {
    setGoalError(null);
    const fd = new FormData();
    fd.set("focus", focus);
    fd.set("protein_target_g", String(protein));
    fd.set("nutrition_goal_type", goalType);
    fd.set("locale", locale);
    startSavingGoal(async () => {
      const result = await saveOnboardingGoalAction(fd);
      if (result?.error) {
        setGoalError(t("goal_error"));
        return;
      }
      setStep("activate");
    });
  }

  function checkout(plan: Plan) {
    setCheckoutError(null);
    startCheckout(async () => {
      try {
        const response = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale, plan, surface: "onboarding" }),
        });
        const data = (await response.json()) as { url?: string };
        if (!response.ok || !data.url) {
          setCheckoutError(tPaywall("checkout_error"));
          return;
        }
        track("onboarding_completed", {
          locale,
          props: { checkout_started: true },
        });
        window.location.href = data.url;
      } catch {
        setCheckoutError(tPaywall("checkout_error"));
      }
    });
  }

  return (
    <main style={shellStyle}>
      <div
        style={{
          width: "min(100%, 620px)",
          margin: "0 auto",
          display: "grid",
          gap: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <button
            type="button"
            style={{
              color: "var(--pp-text-secondary)",
              fontFamily: SANS,
              fontSize: "11px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              background: "transparent",
              border: 0,
              padding: 0,
              cursor: "pointer",
            }}
            onClick={() => finishOnboarding(true)}
          >
            {t("skip")}
          </button>
          <span
            style={{
              color: "var(--pp-helper)",
              fontFamily: SANS,
              fontSize: "11px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {t("progress", { current: progress, total: 5 })}
          </span>
        </div>

        <section style={cardStyle}>
          {step === "welcome" && (
            <>
              <p style={eyebrowStyle}>{t("welcome_eyebrow")}</p>
              <h1 style={titleStyle}>{t("welcome_title")}</h1>
              <p style={bodyStyle}>{t("welcome_body")}</p>
              <p
                style={{
                  margin: "1rem 0 0",
                  fontFamily: SANS,
                  fontSize: "12px",
                  lineHeight: 1.5,
                  color: "var(--pp-helper)",
                }}
              >
                {t("welcome_disclaimer")}
              </p>
              <div style={{ display: "grid", gap: "0.75rem", marginTop: "2rem" }}>
                <button type="button" style={primaryStyle} onClick={() => setStep("goal")}>
                  {t("start")}
                </button>
                <button
                  type="button"
                  style={secondaryStyle}
                  onClick={() => finishOnboarding(true)}
                >
                  {t("skip_to_today")}
                </button>
              </div>
            </>
          )}

          {step === "goal" && (
            <>
              <p style={eyebrowStyle}>{t("goal_eyebrow")}</p>
              <h1 style={titleStyle}>{t("goal_title")}</h1>
              <p style={bodyStyle}>{t("goal_body")}</p>

              <div style={{ display: "grid", gap: "1.25rem", marginTop: "1.75rem" }}>
                <div>
                  <p style={eyebrowStyle}>{t("goal_focus_label")}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                    {(["dose", "weight", "protein"] as Focus[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        style={chipStyle(focus === value)}
                        onClick={() => setFocus(value)}
                      >
                        {t(`goal_focus_${value}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p style={eyebrowStyle}>{t("goal_protein_label")}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                    {[90, 120, 150].map((value) => (
                      <button
                        key={value}
                        type="button"
                        style={chipStyle(protein === value)}
                        onClick={() => setProtein(value)}
                      >
                        {t("goal_protein_chip", { value })}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p style={eyebrowStyle}>{t("goal_type_label")}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                    {(["lose", "maintain", "gain"] as GoalType[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        style={chipStyle(goalType === value)}
                        onClick={() => setGoalType(value)}
                      >
                        {t(`goal_type_${value}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: "0.75rem", marginTop: "2rem" }}>
                <button
                  type="button"
                  style={primaryStyle}
                  disabled={isSavingGoal}
                  onClick={saveGoalThenContinue}
                >
                  {isSavingGoal ? t("saving") : t("save_goal")}
                </button>
                <button type="button" style={secondaryStyle} onClick={() => setStep("activate")}>
                  {t("skip_goal")}
                </button>
              </div>
              {goalError && (
                <p style={{ color: "#d97b6a", fontFamily: SANS, fontSize: "13px" }}>
                  {goalError}
                </p>
              )}
            </>
          )}

          {step === "activate" && (
            <>
              <p style={eyebrowStyle}>{t("activate_eyebrow")}</p>
              <h1 style={titleStyle}>{t("activate_title")}</h1>
              <p style={bodyStyle}>{t("activate_body")}</p>
              <div style={{ display: "grid", gap: "0.75rem", marginTop: "2rem" }}>
                <button type="button" style={primaryStyle} onClick={() => setIsLogSheetOpen(true)}>
                  {t("open_log_sheet")}
                </button>
                <button type="button" style={secondaryStyle} onClick={() => setStep("paywall")}>
                  {t("skip_log")}
                </button>
              </div>
            </>
          )}

          {step === "aha" && (
            <>
              <p style={eyebrowStyle}>{t("aha_eyebrow")}</p>
              <h1 style={titleStyle}>{t("aha_title")}</h1>
              <div
                style={{
                  marginTop: "1.5rem",
                  borderRadius: "22px",
                  border: "1px solid rgba(201,150,107,0.24)",
                  background: "rgba(201,150,107,0.08)",
                  padding: "18px",
                }}
              >
                <p style={{ ...eyebrowStyle, marginBottom: "0.4rem" }}>Mi Meta</p>
                <p style={{ ...bodyStyle, margin: 0, color: "var(--pp-text)" }}>
                  {miMetaSentence}
                </p>
              </div>
              <p style={bodyStyle}>{bukowskiLine}</p>
              <button
                type="button"
                style={{ ...primaryStyle, marginTop: "2rem" }}
                onClick={() => setStep("paywall")}
              >
                {t("continue_to_paywall")}
              </button>
            </>
          )}

          {step === "paywall" && (
            <>
              <p style={eyebrowStyle}>{t("paywall_eyebrow")}</p>
              <h1 style={titleStyle}>{t("paywall_title")}</h1>
              <p style={bodyStyle}>{t("paywall_body")}</p>
              <div style={{ display: "grid", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  style={primaryStyle}
                  disabled={isCheckingOut}
                  onClick={() => checkout("annual")}
                >
                  {t("paywall_annual")}
                </button>
                <button
                  type="button"
                  style={secondaryStyle}
                  disabled={isCheckingOut}
                  onClick={() => checkout("monthly")}
                >
                  {t("paywall_monthly")}
                </button>
                <button
                  type="button"
                  style={{
                    ...secondaryStyle,
                    minHeight: "44px",
                    borderColor: "transparent",
                  }}
                  onClick={dismissPaywall}
                >
                  {t("paywall_free")}
                </button>
              </div>
              <p
                style={{
                  margin: "1rem 0 0",
                  fontFamily: SANS,
                  color: "var(--pp-helper)",
                  fontSize: "12px",
                  lineHeight: 1.5,
                }}
              >
                {t("paywall_terms")}
              </p>
              {checkoutError && (
                <p style={{ color: "#d97b6a", fontFamily: SANS, fontSize: "13px" }}>
                  {checkoutError}
                </p>
              )}
            </>
          )}
        </section>
      </div>

      <LogSheet
        open={isLogSheetOpen}
        onClose={() => setIsLogSheetOpen(false)}
        onboarding
        locale={locale}
      />
    </main>
  );
}
