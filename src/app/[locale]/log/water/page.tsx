"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
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
  textareaStyle,
} from "@/lib/log-form-styles";
import { logWaterAction } from "./actions";

type WaterFormValues = {
  amount_ml: string;
  drank_at: string;
  note: string;
};

function nowLocalDateTime(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LogWaterPage() {
  const t = useTranslations("water");
  const tErrors = useTranslations("errors");
  const locale = useLocale();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  const form = useForm<WaterFormValues>({
    defaultValues: {
      amount_ml: "",
      drank_at: nowLocalDateTime(),
      note: "",
    },
    mode: "onSubmit",
  });

  function onSubmit(v: WaterFormValues) {
    setErrorMsg(null);
    const fd = new FormData();
    fd.set("amount_ml", v.amount_ml);
    fd.set("drank_at", v.drank_at);
    if (v.note) fd.set("note", v.note);
    fd.set("locale", locale);
    startSave(async () => {
      const result = await logWaterAction(fd);
      if (result?.error) setErrorMsg(tErrors("generic"));
    });
  }

  const setNow = () => {
    form.setValue("drank_at", nowLocalDateTime());
  };

  return (
    <LogShell backLabel={t("back")} title={t("title")}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div style={formGroupStyle}>
          <label htmlFor="amount-ml" style={labelStyle}>
            {t("amount_ml")}
          </label>
          <input
            id="amount-ml"
            type="number"
            step="1"
            min="0"
            inputMode="decimal"
            style={inputStyle}
            className="focus:border-[var(--pp-accent)] transition-colors"
            {...form.register("amount_ml", { required: true })}
            aria-invalid={!!form.formState.errors.amount_ml}
          />
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="drank-at" style={labelStyle}>
            {t("drank_at")}
          </label>
          <div style={inlineRowStyle}>
            <input
              id="drank-at"
              type="datetime-local"
              style={{ ...inputStyle, flex: 1 }}
              className="focus:border-[var(--pp-accent)] transition-colors"
              {...form.register("drank_at", { required: true })}
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
          <label htmlFor="note" style={labelStyle}>
            {t("note")}
            <span style={labelHintStyle}>{t("optional")}</span>
          </label>
          <textarea
            id="note"
            rows={4}
            style={textareaStyle}
            className="focus:border-[var(--pp-accent)] transition-colors"
            {...form.register("note")}
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
