"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Link, useRouter } from "@/i18n/navigation";
import {
  inputStyle,
  labelStyle,
  secondaryBtnStyle,
} from "@/lib/log-form-styles";

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

const navLinkStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "12px",
  letterSpacing: "0.24em",
  textTransform: "uppercase",
  color: "var(--pp-text-secondary)",
  textDecoration: "none",
};

const mastStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontStyle: "italic",
  fontSize: "clamp(48px, 9vw, 64px)",
  lineHeight: 0.95,
  letterSpacing: "-0.01em",
  fontWeight: 400,
  color: "var(--pp-text)",
  margin: 0,
  textAlign: "center",
};

const primaryButtonStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "13px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  fontWeight: 500,
  background: "var(--pp-accent)",
  color: "var(--pp-bg)",
  padding: "16px 24px",
  borderRadius: "4px",
  border: "none",
  width: "100%",
  cursor: "pointer",
  display: "block",
  textAlign: "center",
};

const ghostLinkStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontStyle: "italic",
  fontSize: "15px",
  color: "var(--pp-text-secondary)",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "8px",
  textAlign: "center",
  display: "block",
  width: "100%",
};

const errorStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontStyle: "italic",
  fontSize: "15px",
  color: "#d97b6a",
  margin: 0,
  textAlign: "center",
};

const bottomLinkStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontStyle: "italic",
  fontSize: "15px",
  color: "var(--pp-text-secondary)",
  textAlign: "center",
  margin: 0,
};

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = { email: string; password: string };

export default function SignInPage() {
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ mode: "onSubmit" });

  async function onSubmit(values: FormValues) {
    setErrorMsg(null);
    const parsed = credentialsSchema.safeParse(values);
    if (!parsed.success) {
      setErrorMsg(t("error_invalid_credentials"));
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      const msg = error.message.toLowerCase();
      const isInvalid =
        msg.includes("invalid") || msg.includes("credentials");
      setErrorMsg(isInvalid ? t("error_invalid_credentials") : error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function signInWithGoogle() {
    setErrorMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/${locale}/dashboard`,
      },
    });
    if (error) setErrorMsg(tErrors("generic"));
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--pp-bg)",
        color: "var(--pp-text)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <nav
        style={{
          maxWidth: "880px",
          width: "100%",
          margin: "0 auto",
          padding: "1.5rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link href="/" style={navLinkStyle}>
          {t("nav_brand")}
        </Link>
        <LocaleSwitcher variant="dark" />
      </nav>

      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "440px",
            display: "flex",
            flexDirection: "column",
            gap: "2.5rem",
          }}
        >
          <h1 style={mastStyle}>{t("sign_in_mast")}</h1>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <button
              type="button"
              onClick={signInWithGoogle}
              style={primaryButtonStyle}
            >
              {t("google_cta")}
            </button>

            {!showEmail && (
              <button
                type="button"
                onClick={() => setShowEmail(true)}
                style={ghostLinkStyle}
              >
                {t("email_expand")}
              </button>
            )}
          </div>

          {showEmail && (
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
              }}
            >
              <div>
                <label htmlFor="email" style={{ ...labelStyle, display: "block", marginBottom: "8px" }}>
                  {t("email")}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register("email", { required: true })}
                  aria-invalid={!!errors.email}
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="password" style={{ ...labelStyle, display: "block", marginBottom: "8px" }}>
                  {t("password")}
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("password_placeholder")}
                  {...register("password", { required: true, minLength: 8 })}
                  aria-invalid={!!errors.password}
                  style={inputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{ ...secondaryBtnStyle, width: "100%", display: "block", textAlign: "center", opacity: isSubmitting ? 0.5 : 1 }}
              >
                {t("sign_in")}
              </button>
            </form>
          )}

          {errorMsg && (
            <p style={errorStyle} role="alert">
              {errorMsg}
            </p>
          )}

          <p style={bottomLinkStyle}>
            {t("dont_have_account")}{" "}
            <Link
              href="/auth/sign-up"
              style={{ color: "var(--pp-accent)", textDecoration: "none" }}
            >
              {t("sign_up_link")}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
