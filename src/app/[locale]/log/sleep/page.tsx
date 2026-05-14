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
import { cn } from "@/lib/utils";
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
  const tApp = useTranslations("app");
  const tAuth = useTranslations("auth");
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
            <Label htmlFor="hours">{t("hours")}</Label>
            <Input
              id="hours"
              type="number"
              step="0.5"
              min="0"
              max="24"
              placeholder="7.5"
              {...form.register("hours", { required: true })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("quality")}</Label>
            <div className="grid grid-cols-5 gap-2">
              {QUALITIES.map((q) => {
                const isActive = selectedQuality === q;
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => form.setValue("quality", q)}
                    aria-pressed={isActive}
                    aria-label={t(`quality_${q}`)}
                    className={cn(
                      "rounded-lg border py-3 text-2xl transition-colors",
                      isActive
                        ? "border-foreground bg-accent"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    {QUALITY_EMOJIS[q]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="slept-at">{t("slept_at")}</Label>
            <Input
              id="slept-at"
              type="date"
              {...form.register("slept_at", { required: true })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">{t("notes")}</Label>
            <textarea
              id="notes"
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              {...form.register("notes")}
            />
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
