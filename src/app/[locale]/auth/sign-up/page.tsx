"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Link, useRouter } from "@/i18n/navigation";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = { email: string; password: string };

export default function SignUpPage() {
  const t = useTranslations("auth");
  const tApp = useTranslations("app");
  const tErrors = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ mode: "onSubmit" });

  async function onSubmit(values: FormValues) {
    setErrorMsg(null);
    const parsed = credentialsSchema.safeParse(values);
    if (!parsed.success) {
      setErrorMsg(t("error_invalid_credentials"));
      return;
    }

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (signUpError) {
      setErrorMsg(signUpError.message);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (signInError) {
      setErrorMsg(signInError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function signInWithGoogle() {
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
            <CardTitle className="text-xl">{t("sign_up_title")}</CardTitle>
          </CardHeader>
          <CardContent>
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

              <div className="flex flex-col gap-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={t("password_placeholder")}
                  {...register("password", { required: true, minLength: 8 })}
                  aria-invalid={!!errors.password}
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full"
              >
                {t("sign_up")}
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

              <p className="text-center text-sm text-muted-foreground">
                {t("already_have_account")}{" "}
                <Link
                  href="/auth/sign-in"
                  className="text-foreground hover:underline"
                >
                  {t("sign_in")}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
