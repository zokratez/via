"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Link } from "@/i18n/navigation";

const emailSchema = z.string().email();

type FormValues = { email: string };

export default function SignInPage() {
  const t = useTranslations("auth");
  const tApp = useTranslations("app");
  const tErrors = useTranslations("errors");
  const locale = useLocale();

  const [status, setStatus] = useState<"idle" | "sent">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    mode: "onSubmit",
  });

  async function onSubmit({ email }: FormValues) {
    setErrorMsg(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setErrorMsg(tErrors("auth_invalid"));
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/${locale}/dashboard`,
      },
    });
    if (error) {
      setErrorMsg(tErrors("generic"));
      return;
    }
    setStatus("sent");
  }

  async function signInWithGoogle() {
    // TODO(day-2): configure Google OAuth client in the Supabase dashboard
    setErrorMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/${locale}/dashboard`,
      },
    });
    if (error) setErrorMsg(tErrors("generic"));
  }

  return (
    <div className="flex flex-col flex-1">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          {tApp("name")}
        </Link>
        <LocaleSwitcher />
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <Card className="w-full max-w-sm border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("sign_in_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {status === "sent" ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("magic_link_sent")}
              </p>
            ) : (
              <form
                className="flex flex-col gap-4"
                onSubmit={handleSubmit(onSubmit)}
                noValidate
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...register("email", { required: true })}
                    aria-invalid={!!errors.email}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full"
                >
                  {t("continue")}
                </Button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/60" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-wide">
                    <span className="bg-card px-2 text-muted-foreground">
                      {t("or_continue_with")}
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={signInWithGoogle}
                  className="rounded-full"
                >
                  {t("google")}
                </Button>

                {errorMsg && (
                  <p className="text-sm text-destructive" role="alert">
                    {errorMsg}
                  </p>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
