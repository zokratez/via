"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { LogShell } from "@/components/LogShell";
import { createClient } from "@/lib/supabase/client";
import {
  chipStyle,
  errorMessageStyle,
  formGroupStyle,
  inlineRowStyle,
  inputStyle,
  labelHintStyle,
  labelStyle,
  saveBtnStyle,
  secondaryBtnStyle,
  selectStyle,
  textareaStyle,
} from "@/lib/log-form-styles";
import { addMedicationAction, logDoseAction } from "./actions";

const SITES = [
  "abdomen_left",
  "abdomen_right",
  "thigh_left",
  "thigh_right",
  "arm_left",
  "arm_right",
] as const;
type Site = (typeof SITES)[number];

const GENERICS = ["semaglutide", "tirzepatide", "liraglutide"] as const;
type Generic = (typeof GENERICS)[number];

type Medication = {
  id: string;
  name: string;
  generic_name: string;
  concentration_mg_per_ml: number | null;
};

type DoseFormValues = {
  medication_id: string;
  dose_mg: string;
  taken_at: string;
  injection_site: Site | "";
  notes: string;
};

type MedFormValues = {
  name: string;
  generic_name: Generic;
  concentration_mg_per_ml: string;
};

function nowLocalDateTime(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LogDosePage() {
  const t = useTranslations("dose");
  const tErrors = useTranslations("errors");
  const locale = useLocale();

  const [meds, setMeds] = useState<Medication[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSavingDose, startSaveDose] = useTransition();
  const [isAddingMed, startAddMed] = useTransition();

  const doseForm = useForm<DoseFormValues>({
    defaultValues: {
      medication_id: "",
      dose_mg: "",
      taken_at: nowLocalDateTime(),
      injection_site: "",
      notes: "",
    },
    mode: "onSubmit",
  });

  const medForm = useForm<MedFormValues>({
    defaultValues: {
      name: "",
      generic_name: "semaglutide",
      concentration_mg_per_ml: "",
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("medications")
        .select("id,name,generic_name,concentration_mg_per_ml")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      const list: Medication[] = (data ?? []).map((m) => ({
        id: m.id as string,
        name: m.name as string,
        generic_name: m.generic_name as string,
        concentration_mg_per_ml:
          m.concentration_mg_per_ml === null
            ? null
            : Number(m.concentration_mg_per_ml),
      }));
      setMeds(list);
      if (list.length > 0) {
        doseForm.setValue("medication_id", list[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doseForm]);

  function onAddMedication(v: MedFormValues) {
    setErrorMsg(null);
    const fd = new FormData();
    fd.set("name", v.name);
    fd.set("generic_name", v.generic_name);
    fd.set("concentration_mg_per_ml", v.concentration_mg_per_ml);
    startAddMed(async () => {
      const result = await addMedicationAction(fd);
      if (!result.ok) {
        setErrorMsg(tErrors("generic"));
        return;
      }
      setMeds((prev) => [...(prev ?? []), result.medication]);
      doseForm.setValue("medication_id", result.medication.id);
      medForm.reset();
    });
  }

  function onSubmitDose(v: DoseFormValues) {
    setErrorMsg(null);
    if (!v.medication_id) {
      setErrorMsg(t("validation_failed"));
      return;
    }
    const fd = new FormData();
    fd.set("medication_id", v.medication_id);
    fd.set("dose_mg", v.dose_mg);
    fd.set("taken_at", v.taken_at);
    if (v.injection_site) fd.set("injection_site", v.injection_site);
    if (v.notes) fd.set("notes", v.notes);
    fd.set("locale", locale);
    startSaveDose(async () => {
      const result = await logDoseAction(fd);
      if (result?.error) setErrorMsg(tErrors("generic"));
    });
  }

  const setNow = () => {
    doseForm.setValue("taken_at", nowLocalDateTime());
  };

  const selectedSite = doseForm.watch("injection_site");
  const isLoadingMeds = meds === null;
  const hasNoMeds = !isLoadingMeds && meds.length === 0;

  return (
    <LogShell backLabel={t("back")} title={t("title")}>
      {isLoadingMeds ? (
        <p
          style={{
            fontFamily: "var(--pp-font-serif)",
            fontStyle: "italic",
            fontSize: "15px",
            color: "var(--pp-text-secondary)",
            margin: 0,
          }}
        >
          …
        </p>
      ) : hasNoMeds ? (
        <div
          style={{
            background: "var(--pp-surface)",
            border: "0.5px solid var(--pp-border)",
            borderRadius: "6px",
            padding: "1.5rem",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--pp-font-serif)",
              fontStyle: "italic",
              fontSize: "20px",
              color: "var(--pp-text)",
              margin: "0 0 0.5rem",
            }}
          >
            {t("add_first_medication")}
          </h2>
          <p
            style={{
              fontFamily: "var(--pp-font-serif)",
              fontSize: "14px",
              color: "var(--pp-text-secondary)",
              margin: "0 0 1.5rem",
              lineHeight: 1.5,
            }}
          >
            {t("add_first_medication_sub")}
          </p>

          <form
            onSubmit={medForm.handleSubmit(onAddMedication)}
            noValidate
          >
            <div style={formGroupStyle}>
              <label htmlFor="med-name" style={labelStyle}>
                {t("medication_name")}
              </label>
              <input
                id="med-name"
                placeholder={t("medication_name_placeholder")}
                style={inputStyle}
                className="focus:border-[var(--pp-accent)] transition-colors"
                {...medForm.register("name", { required: true })}
                aria-invalid={!!medForm.formState.errors.name}
              />
            </div>

            <div style={formGroupStyle}>
              <label htmlFor="med-generic" style={labelStyle}>
                {t("medication_generic")}
              </label>
              <select
                id="med-generic"
                style={selectStyle}
                className="focus:border-[var(--pp-accent)] transition-colors"
                {...medForm.register("generic_name", { required: true })}
              >
                {GENERICS.map((g) => (
                  <option key={g} value={g}>
                    {t(`medication_generic_${g}`)}
                  </option>
                ))}
              </select>
            </div>

            <div style={formGroupStyle}>
              <label htmlFor="med-conc" style={labelStyle}>
                {t("medication_concentration")}
                <span style={labelHintStyle}>
                  {t("medication_concentration_hint")}
                </span>
              </label>
              <input
                id="med-conc"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                style={inputStyle}
                className="focus:border-[var(--pp-accent)] transition-colors"
                {...medForm.register("concentration_mg_per_ml")}
              />
            </div>

            <button
              type="submit"
              disabled={isAddingMed}
              style={saveBtnStyle}
            >
              {isAddingMed ? t("saving") : t("add_medication")}
            </button>

            {errorMsg && (
              <p style={errorMessageStyle} role="alert">
                {errorMsg}
              </p>
            )}
          </form>
        </div>
      ) : (
        <form onSubmit={doseForm.handleSubmit(onSubmitDose)} noValidate>
          <div style={formGroupStyle}>
            <label htmlFor="medication" style={labelStyle}>
              {t("medication")}
            </label>
            <select
              id="medication"
              style={selectStyle}
              className="focus:border-[var(--pp-accent)] transition-colors"
              {...doseForm.register("medication_id", { required: true })}
            >
              {(meds ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.concentration_mg_per_ml
                    ? ` — ${m.concentration_mg_per_ml} mg/mL`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="dose-mg" style={labelStyle}>
              {t("dose_mg")}
            </label>
            <input
              id="dose-mg"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              style={inputStyle}
              className="focus:border-[var(--pp-accent)] transition-colors"
              {...doseForm.register("dose_mg", { required: true })}
              aria-invalid={!!doseForm.formState.errors.dose_mg}
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="taken-at" style={labelStyle}>
              {t("when")}
            </label>
            <div style={inlineRowStyle}>
              <input
                id="taken-at"
                type="datetime-local"
                style={{ ...inputStyle, flex: 1 }}
                className="focus:border-[var(--pp-accent)] transition-colors"
                {...doseForm.register("taken_at", { required: true })}
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
            <label style={labelStyle}>{t("injection_site")}</label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "0.5rem",
              }}
            >
              {SITES.map((s) => {
                const isActive = selectedSite === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => doseForm.setValue("injection_site", s)}
                    aria-pressed={isActive}
                    style={chipStyle(isActive)}
                  >
                    {t(`site_${s}`)}
                  </button>
                );
              })}
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
              {...doseForm.register("notes")}
            />
          </div>

          <button type="submit" disabled={isSavingDose} style={saveBtnStyle}>
            {isSavingDose ? t("saving") : t("save")}
          </button>

          {errorMsg && (
            <p style={errorMessageStyle} role="alert">
              {errorMsg}
            </p>
          )}
        </form>
      )}
    </LogShell>
  );
}
