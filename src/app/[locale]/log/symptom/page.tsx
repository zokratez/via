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
  const tApp = useTranslations("app");
  const tAuth = useTranslations("auth");
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
            <Label>{t("category")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => {
                const isActive = selectedCategory === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => form.setValue("category", c)}
                    aria-pressed={isActive}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    {t(`category_${c}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("severity")}</Label>
            <div className="grid grid-cols-5 gap-2">
              {SEVERITIES.map((s) => {
                const isActive = selectedSeverity === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => form.setValue("severity", s)}
                    aria-pressed={isActive}
                    aria-label={String(s)}
                    className={cn(
                      "rounded-lg border py-3 text-2xl transition-colors",
                      isActive
                        ? "border-foreground bg-accent"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    {SEVERITY_EMOJIS[s]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="occurred-at">{t("occurred_at")}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="occurred-at"
                type="datetime-local"
                {...form.register("occurred_at", { required: true })}
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
