"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { LogShell } from "@/components/LogShell";
import {
  emojiChipStyle,
  errorMessageStyle,
  formGroupStyle,
  inputStyle,
  labelStyle,
  saveBtnStyle,
  textareaStyle,
} from "@/lib/log-form-styles";
import { logSleepAction } from "./actions";

const QUALITIES = [1, 2, 3, 4, 5] as const;
type Quality = (typeof QUALITIES)[number];
const QUALITY_EMOJIS: Record<Quality, string> = {
  1: "🌑",
  2: "🌒",
  3: "🌓",
  4: "🌔",
  5: "🌕",
};

type SleepFormValues = {
  hours: string;
  quality: Quality | 0;
  slept_at: string;
  notes: string;
};

function todayDateString(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function LogSleepPage() {
  const t = useTranslations("sleep");
  const tErrors = useTranslations("errors");
  const locale = useLocale();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  const form = useForm<SleepFormValues>({
    defaultValues: {
      hours: "",
      quality: 0,
      slept_at: todayDateString(),
      notes: "",
    },
    mode: "onSubmit",
  });

  const selectedQuality = form.watch("quality");

  function onSubmit(v: SleepFormValues) {
    setErrorMsg(null);
    const hoursNum = Number(v.hours);
    if (!Number.isFinite(hoursNum) || hoursNum < 0 || hoursNum > 24) {
      setErrorMsg(t("validation_failed"));
      return;
    }
    if (v.quality === 0) {
      setErrorMsg(t("validation_failed"));
      return;
    }
    const fd = new FormData();
    fd.set("hours", String(hoursNum));
    fd.set("quality", String(v.quality));
    fd.set("slept_at", v.slept_at);
    if (v.notes) fd.set("notes", v.notes);
    fd.set("locale", locale);
    startSave(async () => {
      const result = await logSleepAction(fd);
      if (result?.error) setErrorMsg(tErrors("generic"));
    });
  }

  return (
    <LogShell backLabel={t("back")} title={t("title")}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div style={formGroupStyle}>
          <label htmlFor="hours" style={labelStyle}>
            {t("hours")}
          </label>
          <input
            id="hours"
            type="number"
            step="0.5"
            min="0"
            max="24"
            placeholder="7.5"
            style={inputStyle}
            className="focus:border-[var(--pp-accent)] transition-colors"
            {...form.register("hours", { required: true })}
          />
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle}>{t("quality")}</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "0.5rem",
            }}
          >
            {QUALITIES.map((q) => {
              const isActive = selectedQuality === q;
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => form.setValue("quality", q)}
                  aria-pressed={isActive}
                  aria-label={t(`quality_${q}`)}
                  style={emojiChipStyle(isActive)}
                >
                  {QUALITY_EMOJIS[q]}
                </button>
              );
            })}
          </div>
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="slept-at" style={labelStyle}>
            {t("slept_at")}
          </label>
          <input
            id="slept-at"
            type="date"
            style={inputStyle}
            className="focus:border-[var(--pp-accent)] transition-colors"
            {...form.register("slept_at", { required: true })}
          />
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
