"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { LogShell } from "@/components/LogShell";
import {
  chipStyle,
  emojiChipStyle,
  errorMessageStyle,
  formGroupStyle,
  inlineRowStyle,
  inputStyle,
  labelStyle,
  saveBtnStyle,
  secondaryBtnStyle,
  textareaStyle,
} from "@/lib/log-form-styles";
import { logSymptomAction } from "./actions";

const CATEGORIES = [
  "nausea",
  "fatigue",
  "constipation",
  "headache",
  "injection_site",
  "other",
] as const;
type Category = (typeof CATEGORIES)[number];

const SEVERITY_EMOJIS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "🙂",
  2: "😐",
  3: "😕",
  4: "😣",
  5: "😫",
};
const SEVERITIES = [1, 2, 3, 4, 5] as const;
type Severity = (typeof SEVERITIES)[number];

type SymptomFormValues = {
  category: Category | "";
  severity: Severity | 0;
  occurred_at: string;
  notes: string;
};

function nowLocalDateTime(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LogSymptomPage() {
  const t = useTranslations("symptom");
  const tErrors = useTranslations("errors");
  const locale = useLocale();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  const form = useForm<SymptomFormValues>({
    defaultValues: {
      category: "",
      severity: 0,
      occurred_at: nowLocalDateTime(),
      notes: "",
    },
    mode: "onSubmit",
  });

  const selectedCategory = form.watch("category");
  const selectedSeverity = form.watch("severity");

  function onSubmit(v: SymptomFormValues) {
    setErrorMsg(null);
    if (!v.category || v.severity === 0) {
      setErrorMsg(t("validation_failed"));
      return;
    }
    const fd = new FormData();
    fd.set("category", v.category);
    fd.set("severity", String(v.severity));
    fd.set("occurred_at", v.occurred_at);
    if (v.notes) fd.set("notes", v.notes);
    fd.set("locale", locale);
    startSave(async () => {
      const result = await logSymptomAction(fd);
      if (result?.error) setErrorMsg(tErrors("generic"));
    });
  }

  const setNow = () => {
    form.setValue("occurred_at", nowLocalDateTime());
  };

  return (
    <LogShell backLabel={t("back")} title={t("title")}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div style={formGroupStyle}>
          <label style={labelStyle}>{t("category")}</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "0.5rem",
            }}
          >
            {CATEGORIES.map((c) => {
              const isActive = selectedCategory === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => form.setValue("category", c)}
                  aria-pressed={isActive}
                  style={chipStyle(isActive)}
                >
                  {t(`category_${c}`)}
                </button>
              );
            })}
          </div>
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle}>{t("severity")}</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "0.5rem",
            }}
          >
            {SEVERITIES.map((s) => {
              const isActive = selectedSeverity === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => form.setValue("severity", s)}
                  aria-pressed={isActive}
                  aria-label={String(s)}
                  style={emojiChipStyle(isActive)}
                >
                  {SEVERITY_EMOJIS[s]}
                </button>
              );
            })}
          </div>
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="occurred-at" style={labelStyle}>
            {t("occurred_at")}
          </label>
          <div style={inlineRowStyle}>
            <input
              id="occurred-at"
              type="datetime-local"
              style={{ ...inputStyle, flex: 1 }}
              className="focus:border-[var(--pp-accent)] transition-colors"
              {...form.register("occurred_at", { required: true })}
            />
            <button
              type="button"
              onClick={setNow}
              style={secondaryBtnStyle}
              className="hover:text-[var(--pp-accent)] hover:border-[var(--pp-accent)] transition-colors"
            >
              {t("now")}
            </button>
          </div>
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="notes" style={labelStyle}>
            {t("notes")}
          </label>
          <textarea
            id="notes"
            rows={3}
            style={textareaStyle}
            className="focus:border-[var(--pp-accent)] transition-colors"
            {...form.register("notes")}
          />
        </div>

        <button type="submit" disabled={isSaving} style={saveBtnStyle}>
          {isSaving ? t("saving") : t("save")}
        </button>

        {errorMsg && (
          <p style={errorMessageStyle} role="alert">
            {errorMsg}
          </p>
        )}
      </form>
    </LogShell>
  );
}
