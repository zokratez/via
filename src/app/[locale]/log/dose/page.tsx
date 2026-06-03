"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { LogShell } from "@/components/LogShell";
import { KNOWN_PEPTIDES } from "@/lib/peptides/known-peptides";
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
import { logDoseAction } from "./actions";

const SITES = [
  "abdomen_left",
  "abdomen_right",
  "thigh_left",
  "thigh_right",
  "arm_left",
  "arm_right",
] as const;
type Site = (typeof SITES)[number];
const DOSE_UNITS = ["mg", "mcg"] as const;
type DoseUnit = (typeof DOSE_UNITS)[number];

type Medication = {
  id: string;
  name: string;
  generic_name: string;
  concentration_mg_per_ml: number | null;
};

type UserPeptide = {
  id: string;
  name: string;
  default_freq: string;
  default_unit: DoseUnit;
};

type Suggestion = {
  key: string;
  name: string;
  aliases: readonly string[];
  defaultFreq: string;
  units: readonly DoseUnit[];
  medicationId?: string;
  concentration?: number | null;
  source: "known" | "custom" | "saved";
};

type DoseFormValues = {
  medication_id: string;
  peptide_name: string;
  default_freq: string;
  dose_amount: string;
  dose_unit: DoseUnit;
  taken_at: string;
  injection_site: Site | "";
  notes: string;
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
  const [userPeptides, setUserPeptides] = useState<UserPeptide[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSavingDose, startSaveDose] = useTransition();

  const doseForm = useForm<DoseFormValues>({
    defaultValues: {
      medication_id: "",
      peptide_name: "",
      default_freq: "custom",
      dose_amount: "",
      dose_unit: "mg",
      taken_at: nowLocalDateTime(),
      injection_site: "",
      notes: "",
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const [medicationsRes, customPeptidesRes] = await Promise.all([
        supabase
          .from("medications")
          .select("id,name,generic_name,concentration_mg_per_ml")
          .eq("is_active", true)
          .order("created_at", { ascending: true }),
        supabase
          .from("user_peptides")
          .select("id,name,default_freq,default_unit")
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      const list: Medication[] = (medicationsRes.data ?? []).map((m) => ({
        id: m.id as string,
        name: m.name as string,
        generic_name: m.generic_name as string,
        concentration_mg_per_ml:
          m.concentration_mg_per_ml === null
            ? null
            : Number(m.concentration_mg_per_ml),
      }));
      setMeds(list);
      setUserPeptides(
        (customPeptidesRes.data ?? []).map((p) => ({
          id: p.id as string,
          name: p.name as string,
          default_freq: (p.default_freq as string | null) ?? "custom",
          default_unit:
            p.default_unit === "mcg" || p.default_unit === "mg"
              ? p.default_unit
              : "mg",
        })),
      );
      if (list.length > 0) {
        doseForm.setValue("peptide_name", list[0].name);
        doseForm.setValue("medication_id", list[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doseForm]);

  function onSubmitDose(v: DoseFormValues) {
    setErrorMsg(null);
    if (!v.peptide_name.trim()) {
      setErrorMsg(t("validation_failed"));
      return;
    }
    const fd = new FormData();
    if (v.medication_id) fd.set("medication_id", v.medication_id);
    fd.set("peptide_name", v.peptide_name);
    fd.set("default_freq", v.default_freq);
    fd.set("dose_amount", v.dose_amount);
    fd.set("dose_unit", v.dose_unit);
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
  const peptideName = doseForm.watch("peptide_name");
  const peptideQuery = peptideName.trim().toLowerCase();
  const isLoadingMeds = meds === null;
  const suggestions = useMemo<Suggestion[]>(() => {
    const known: Suggestion[] = KNOWN_PEPTIDES.map((peptide) => ({
      key: `known:${peptide.name}`,
      name: peptide.name,
      aliases: peptide.aliases,
      defaultFreq: peptide.defaultFreq,
      units: peptide.units,
      source: "known",
    }));
    const custom: Suggestion[] = userPeptides.map((peptide) => ({
      key: `custom:${peptide.id}`,
      name: peptide.name,
      aliases: [],
      defaultFreq: peptide.default_freq,
      units: [peptide.default_unit],
      source: "custom",
    }));
    const saved: Suggestion[] = (meds ?? []).map((medication) => ({
      key: `saved:${medication.id}`,
      name: medication.name,
      aliases: medication.generic_name ? [medication.generic_name] : [],
      defaultFreq: "custom",
      units: ["mg"],
      medicationId: medication.id,
      concentration: medication.concentration_mg_per_ml,
      source: "saved",
    }));
    const deduped = new Map<string, Suggestion>();
    for (const item of [...custom, ...saved, ...known]) {
      const key = item.name.toLowerCase();
      if (!deduped.has(key)) deduped.set(key, item);
    }
    return [...deduped.values()];
  }, [meds, userPeptides]);
  const filteredSuggestions = suggestions
    .filter((suggestion) => {
      if (!peptideQuery) return true;
      if (suggestion.name.toLowerCase().includes(peptideQuery)) return true;
      return suggestion.aliases.some((alias) =>
        alias.toLowerCase().includes(peptideQuery),
      );
    })
    .slice(0, 12);
  const selectedSuggestion = suggestions.find(
    (suggestion) => suggestion.name.toLowerCase() === peptideQuery,
  );
  const unitOptions = selectedSuggestion?.units ?? DOSE_UNITS;

  function selectSuggestion(suggestion: Suggestion) {
    doseForm.setValue("peptide_name", suggestion.name);
    doseForm.setValue("medication_id", suggestion.medicationId ?? "");
    doseForm.setValue("default_freq", suggestion.defaultFreq);
    doseForm.setValue("dose_unit", suggestion.units[0] ?? "mg");
  }

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
      ) : (
        <form onSubmit={doseForm.handleSubmit(onSubmitDose)} noValidate>
          <div style={formGroupStyle}>
            <label htmlFor="peptide-name" style={labelStyle}>
              {t("peptide_name")}
            </label>
            <input
              id="peptide-name"
              placeholder={t("peptide_name_placeholder")}
              style={inputStyle}
              className="focus:border-[var(--pp-accent)] transition-colors"
              {...doseForm.register("peptide_name", { required: true })}
              onChange={(event) => {
                doseForm.setValue("medication_id", "");
                doseForm.setValue("peptide_name", event.target.value);
              }}
              aria-invalid={!!doseForm.formState.errors.peptide_name}
            />
            <input type="hidden" {...doseForm.register("medication_id")} />
            <input type="hidden" {...doseForm.register("default_freq")} />
            <p style={labelHintStyle}>{t("peptide_picker_hint")}</p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
                marginTop: "0.75rem",
              }}
            >
              {filteredSuggestions.map((suggestion) => (
                <button
                  key={suggestion.key}
                  type="button"
                  onClick={() => selectSuggestion(suggestion)}
                  style={chipStyle(
                    suggestion.name.toLowerCase() === peptideQuery,
                  )}
                >
                  {suggestion.name}
                  {suggestion.concentration
                    ? ` · ${suggestion.concentration} mg/mL`
                    : ""}
                </button>
              ))}
            </div>
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="dose-amount" style={labelStyle}>
              {t("dose_amount")}
            </label>
            <div style={inlineRowStyle}>
              <input
                id="dose-amount"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                style={{ ...inputStyle, flex: 1 }}
                className="focus:border-[var(--pp-accent)] transition-colors"
                {...doseForm.register("dose_amount", { required: true })}
                aria-invalid={!!doseForm.formState.errors.dose_amount}
              />
              <select
                aria-label={t("dose_unit")}
                style={{ ...selectStyle, width: "108px" }}
                className="focus:border-[var(--pp-accent)] transition-colors"
                {...doseForm.register("dose_unit", { required: true })}
              >
                {unitOptions.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
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
