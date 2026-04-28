"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
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
  const tApp = useTranslations("app");
  const tAuth = useTranslations("auth");
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
    <div className="flex flex-col flex-1">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          {tApp("name")}
        </Link>
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <SignOutButton label={tAuth("sign_out")} />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-xl px-6 py-10">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {t("back")}
          </Link>
        </div>

        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-8">
          {t("title")}
        </h1>

        {isLoadingMeds ? (
          <div className="text-sm text-muted-foreground">…</div>
        ) : hasNoMeds ? (
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">
                {t("add_first_medication")}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("add_first_medication_sub")}
              </p>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={medForm.handleSubmit(onAddMedication)}
                className="flex flex-col gap-4"
                noValidate
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="med-name">{t("medication_name")}</Label>
                  <Input
                    id="med-name"
                    placeholder={t("medication_name_placeholder")}
                    {...medForm.register("name", { required: true })}
                    aria-invalid={!!medForm.formState.errors.name}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="med-generic">{t("medication_generic")}</Label>
                  <select
                    id="med-generic"
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                    {...medForm.register("generic_name", { required: true })}
                  >
                    {GENERICS.map((g) => (
                      <option key={g} value={g}>
                        {t(`medication_generic_${g}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="med-conc">
                    {t("medication_concentration")}{" "}
                    <span className="font-normal text-muted-foreground">
                      {t("medication_concentration_hint")}
                    </span>
                  </Label>
                  <Input
                    id="med-conc"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    {...medForm.register("concentration_mg_per_ml")}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isAddingMed}
                  className="rounded-full"
                >
                  {isAddingMed ? t("saving") : t("add_medication")}
                </Button>

                {errorMsg && (
                  <p className="text-sm text-destructive" role="alert">
                    {errorMsg}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        ) : (
          <form
            onSubmit={doseForm.handleSubmit(onSubmitDose)}
            className="flex flex-col gap-6"
            noValidate
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="medication">{t("medication")}</Label>
              <select
                id="medication"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
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

            <div className="flex flex-col gap-2">
              <Label htmlFor="dose-mg">{t("dose_mg")}</Label>
              <Input
                id="dose-mg"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                {...doseForm.register("dose_mg", { required: true })}
                aria-invalid={!!doseForm.formState.errors.dose_mg}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="taken-at">{t("when")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="taken-at"
                  type="datetime-local"
                  {...doseForm.register("taken_at", { required: true })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={setNow}
                  className="rounded-full"
                >
                  {t("now")}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t("injection_site")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {SITES.map((s) => {
                  const isActive = selectedSite === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => doseForm.setValue("injection_site", s)}
                      aria-pressed={isActive}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "border-foreground bg-foreground text-background"
                          : "border-border hover:bg-accent",
                      )}
                    >
                      {t(`site_${s}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">{t("notes")}</Label>
              <textarea
                id="notes"
                rows={3}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                {...doseForm.register("notes")}
              />
            </div>

            <Button
              type="submit"
              disabled={isSavingDose}
              className="rounded-full"
            >
              {isSavingDose ? t("saving") : t("save")}
            </Button>

            {errorMsg && (
              <p className="text-sm text-destructive" role="alert">
                {errorMsg}
              </p>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
