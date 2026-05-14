"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import {
  errorMessageStyle,
  formGroupStyle,
  inputStyle,
  labelHintStyle,
  labelStyle,
  saveBtnStyle,
  textareaStyle,
} from "@/lib/log-form-styles";
import { submitReviewAction } from "./actions";

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

const RATINGS = [1, 2, 3, 4, 5] as const;
type Rating = (typeof RATINGS)[number];

type ReviewFormValues = {
  display_name: string;
  rating: Rating | 0;
  review_text: string;
};

const navLinkStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "12px",
  letterSpacing: "0.24em",
  textTransform: "uppercase",
  color: "var(--pp-text-secondary)",
  textDecoration: "none",
};

const fileInputStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontSize: "14px",
  color: "var(--pp-text-secondary)",
  background: "var(--pp-surface)",
  border: "0.5px solid var(--pp-border)",
  borderRadius: "6px",
  padding: "12px 14px",
  cursor: "pointer",
  width: "100%",
  boxSizing: "border-box",
};

function StarButton({
  active,
  onClick,
  ariaLabel,
}: {
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      style={{
        background: "transparent",
        border: "none",
        padding: "8px",
        fontSize: "32px",
        lineHeight: 1,
        cursor: "pointer",
        color: active ? "var(--pp-accent)" : "var(--pp-text-tertiary)",
        transition: "color 0.15s",
      }}
    >
      ★
    </button>
  );
}

export default function SubmitReviewPage() {
  const t = useTranslations("reviews");
  const tApp = useTranslations("app");
  const locale = useLocale();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const form = useForm<ReviewFormValues>({
    defaultValues: {
      display_name: "",
      rating: 0,
      review_text: "",
    },
    mode: "onSubmit",
  });

  const selectedRating = form.watch("rating");

  function onSubmit(v: ReviewFormValues) {
    setErrorMsg(null);
    if (v.rating === 0) {
      setErrorMsg(t("submit_error_validation"));
      return;
    }
    const fd = new FormData();
    fd.set("display_name", v.display_name);
    fd.set("rating", String(v.rating));
    fd.set("review_text", v.review_text);
    fd.set("locale", locale);
    if (receiptFile) fd.set("receipt", receiptFile);

    startSave(async () => {
      const result = await submitReviewAction(fd);
      if (result.ok) {
        setSubmitted(true);
        return;
      }
      const errorKeyMap: Record<string, string> = {
        validation_failed: "submit_error_validation",
        file_too_large: "submit_error_file_too_large",
        invalid_file_type: "submit_error_invalid_file_type",
        upload_failed: "submit_error_generic",
        db_failed: "submit_error_generic",
      };
      const key = errorKeyMap[result.error] ?? "submit_error_generic";
      setErrorMsg(t(key));
    });
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setReceiptFile(null);
      setReceiptName(null);
      return;
    }
    setReceiptFile(f);
    setReceiptName(f.name);
  }

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
        <Link href="/" style={navLinkStyle}>
          {tApp("name")}
        </Link>
        <LocaleSwitcher variant="dark" />
      </header>

      <main
        className="flex-1 mx-auto w-full"
        style={{ maxWidth: "540px", padding: "2rem 1.5rem 5rem" }}
      >
        <Link
          href="/"
          style={{
            ...navLinkStyle,
            display: "inline-block",
            marginBottom: "1.5rem",
          }}
          className="hover:text-[var(--pp-accent)] transition-colors"
        >
          ← {t("submit_back")}
        </Link>

        <h1
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "clamp(36px, 6vw, 48px)",
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            fontWeight: 400,
            color: "var(--pp-text)",
            margin: "0 0 2rem",
          }}
        >
          {t("submit_title")}
        </h1>

        {submitted ? (
          <div
            style={{
              background: "var(--pp-surface)",
              border: "0.5px solid var(--pp-accent)",
              borderRadius: "6px",
              padding: "1.5rem",
            }}
          >
            <p
              style={{
                fontFamily: SERIF,
                fontStyle: "italic",
                fontSize: "18px",
                color: "var(--pp-accent)",
                margin: "0 0 1rem",
                lineHeight: 1.5,
              }}
            >
              {t("submit_success")}
            </p>
            <Link
              href="/"
              style={{
                fontFamily: SANS,
                fontSize: "12px",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--pp-text-secondary)",
                textDecoration: "none",
              }}
              className="hover:text-[var(--pp-accent)] transition-colors"
            >
              ← {t("submit_back")}
            </Link>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div style={formGroupStyle}>
              <label htmlFor="display-name" style={labelStyle}>
                {t("submit_display_name")}
              </label>
              <input
                id="display-name"
                type="text"
                maxLength={80}
                placeholder={t("submit_display_name_placeholder")}
                style={inputStyle}
                className="focus:border-[var(--pp-accent)] transition-colors"
                {...form.register("display_name", { required: true })}
                aria-invalid={!!form.formState.errors.display_name}
              />
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>{t("submit_rating")}</label>
              <div
                style={{
                  display: "flex",
                  gap: "0.25rem",
                  marginLeft: "-8px",
                }}
                role="radiogroup"
                aria-label={t("submit_rating")}
              >
                {RATINGS.map((r) => (
                  <StarButton
                    key={r}
                    active={selectedRating >= r}
                    onClick={() => form.setValue("rating", r)}
                    ariaLabel={`${r}`}
                  />
                ))}
              </div>
            </div>

            <div style={formGroupStyle}>
              <label htmlFor="review-text" style={labelStyle}>
                {t("submit_review_text")}
              </label>
              <textarea
                id="review-text"
                rows={5}
                maxLength={4000}
                placeholder={t("submit_review_text_placeholder")}
                style={textareaStyle}
                className="focus:border-[var(--pp-accent)] transition-colors"
                {...form.register("review_text", {
                  required: true,
                  minLength: 10,
                })}
              />
            </div>

            <div style={formGroupStyle}>
              <label htmlFor="receipt" style={labelStyle}>
                {t("submit_receipt")}
                <span style={labelHintStyle}>{t("submit_receipt_hint")}</span>
              </label>
              <input
                id="receipt"
                type="file"
                accept="image/*"
                onChange={onFileChange}
                style={fileInputStyle}
                className="focus:border-[var(--pp-accent)] transition-colors"
              />
              {receiptName && (
                <p
                  style={{
                    fontFamily: SERIF,
                    fontStyle: "italic",
                    fontSize: "13px",
                    color: "var(--pp-text-tertiary)",
                    margin: "0.25rem 0 0",
                  }}
                >
                  {receiptName}
                </p>
              )}
            </div>

            <button type="submit" disabled={isSaving} style={saveBtnStyle}>
              {isSaving ? t("submit_saving") : t("submit_save")}
            </button>

            {errorMsg && (
              <p style={errorMessageStyle} role="alert">
                {errorMsg}
              </p>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
