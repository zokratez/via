"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
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
  const tApp = useTranslations("app");
  const tAuth = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const locale = useLocale();

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
    startSave(async () => {
      const result = await logWeightAction(fd);
      if (result?.error) setErrorMsg(tErrors("generic"));
    });
  }

  const setNow = () => {
    form.setValue("measured_at", nowLocalDateTime());
  };

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

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="weight-kg">{t("weight_kg")}</Label>
            <Input
              id="weight-kg"
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              {...form.register("weight_kg", { required: true })}
              aria-invalid={!!form.formState.errors.weight_kg}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="waist-cm">
              {t("waist_cm")}{" "}
              <span className="font-normal text-muted-foreground">
                {t("optional")}
              </span>
            </Label>
            <Input
              id="waist-cm"
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              {...form.register("waist_cm")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="body-fat">
              {t("body_fat_pct")}{" "}
              <span className="font-normal text-muted-foreground">
                {t("optional")}
              </span>
            </Label>
            <Input
              id="body-fat"
              type="number"
              step="0.1"
              min="0"
              max="80"
              inputMode="decimal"
              {...form.register("body_fat_pct")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="measured-at">{t("measured_at")}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="measured-at"
                type="datetime-local"
                {...form.register("measured_at", { required: true })}
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

          <Button type="submit" disabled={isSaving} className="rounded-full">
            {isSaving ? t("saving") : t("save")}
          </Button>

          {errorMsg && (
            <p className="text-sm text-destructive" role="alert">
              {errorMsg}
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
