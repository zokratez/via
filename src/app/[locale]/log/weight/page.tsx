"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { LogShell } from "@/components/LogShell";
import {
  errorMessageStyle,
  formGroupStyle,
  inlineRowStyle,
  inputStyle,
  labelHintStyle,
  labelStyle,
  saveBtnStyle,
  secondaryBtnStyle,
} from "@/lib/log-form-styles";
import { logWeightAction } from "./actions";

type WeightFormValues = {
  weight_kg: string;
  waist_cm: string;
  body_fat_pct: string;
  measured_at: string;
};

function nowLocalDateTime(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LogWeightPage() {
  const t = useTranslations("weight");
  const tErrors = useTranslations("errors");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const returnToOnboarding = searchParams.get("from") === "onboarding";

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  const form = useForm<WeightFormValues>({
    defaultValues: {
      weight_kg: "",
      waist_cm: "",
      body_fat_pct: "",
      measured_at: nowLocalDateTime(),
    },
    mode: "onSubmit",
  });

  function onSubmit(v: WeightFormValues) {
    setErrorMsg(null);
    const fd = new FormData();
    fd.set("weight_kg", v.weight_kg);
    if (v.waist_cm) fd.set("waist_cm", v.waist_cm);
    if (v.body_fat_pct) fd.set("body_fat_pct", v.body_fat_pct);
    fd.set("measured_at", v.measured_at);
    fd.set("locale", locale);
    if (returnToOnboarding) fd.set("return_to", "onboarding");
    startSave(async () => {
      const result = await logWeightAction(fd);
      if (result?.error) setErrorMsg(tErrors("generic"));
    });
  }

  const setNow = () => {
    form.setValue("measured_at", nowLocalDateTime());
  };

  return (
    <LogShell backLabel={t("back")} title={t("title")}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div style={formGroupStyle}>
          <label htmlFor="weight-kg" style={labelStyle}>
            {t("weight_kg")}
          </label>
          <input
            id="weight-kg"
            type="number"
            step="0.1"
            min="0"
            inputMode="decimal"
            style={inputStyle}
            className="focus:border-[var(--pp-accent)] transition-colors"
            {...form.register("weight_kg", { required: true })}
            aria-invalid={!!form.formState.errors.weight_kg}
          />
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="waist-cm" style={labelStyle}>
            {t("waist_cm")}
            <span style={labelHintStyle}>{t("optional")}</span>
          </label>
          <input
            id="waist-cm"
            type="number"
            step="0.1"
            min="0"
            inputMode="decimal"
            style={inputStyle}
            className="focus:border-[var(--pp-accent)] transition-colors"
            {...form.register("waist_cm")}
          />
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="body-fat" style={labelStyle}>
            {t("body_fat_pct")}
            <span style={labelHintStyle}>{t("optional")}</span>
          </label>
          <input
            id="body-fat"
            type="number"
            step="0.1"
            min="0"
            max="80"
            inputMode="decimal"
            style={inputStyle}
            className="focus:border-[var(--pp-accent)] transition-colors"
            {...form.register("body_fat_pct")}
          />
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="measured-at" style={labelStyle}>
            {t("measured_at")}
          </label>
          <div style={inlineRowStyle}>
            <input
              id="measured-at"
              type="datetime-local"
              style={{ ...inputStyle, flex: 1 }}
              className="focus:border-[var(--pp-accent)] transition-colors"
              {...form.register("measured_at", { required: true })}
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
