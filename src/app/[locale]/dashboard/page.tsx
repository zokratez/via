import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Link, redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SignOutButton } from "@/components/SignOutButton";

function greetingKey(now = new Date()): "morning" | "afternoon" | "evening" {
  const h = now.getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const showSavedToast =
    sp.ok === "dose" || sp.ok === "weight" || sp.ok === "symptom";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/auth/sign-in", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user!.id)
    .maybeSingle();

  const name =
    profile?.display_name?.trim() ||
    (user!.email ? user!.email.split("@")[0] : "");

  const t = await getTranslations("dashboard");
  const tApp = await getTranslations("app");
  const tAuth = await getTranslations("auth");

  const key = greetingKey();
  const greeting =
    key === "morning"
      ? t("greeting_morning", { name })
      : key === "afternoon"
        ? t("greeting_afternoon", { name })
        : t("greeting_evening", { name });

  const actions = [
    { href: "/log/dose", label: t("log_dose") },
    { href: "/log/weight", label: t("log_weight") },
    { href: "/log/symptom", label: t("log_symptom") },
    { href: "/coach", label: t("ask_coach") },
  ] as const;

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

      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-10">
        {showSavedToast && (
          <div
            role="status"
            className="mb-6 rounded-lg border border-border/60 bg-accent/40 px-4 py-3 text-sm"
          >
            {t("toast_saved")}
          </div>
        )}
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          {greeting}
        </h1>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className="block">
              <Card className="border-border/60 transition-colors hover:bg-accent/40">
                <CardContent className="py-8">
                  <CardTitle className="text-base font-medium">
                    {a.label}
                  </CardTitle>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
