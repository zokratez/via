import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("landing");
  const tApp = await getTranslations("app");

  const features = [
    { key: "log", title: t("feature_log_title"), desc: t("feature_log_desc") },
    {
      key: "coach",
      title: t("feature_coach_title"),
      desc: t("feature_coach_desc"),
    },
    {
      key: "privacy",
      title: t("feature_privacy_title"),
      desc: t("feature_privacy_desc"),
    },
  ];

  return (
    <div className="flex flex-col flex-1">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight"
        >
          {tApp("name")}
        </Link>
        <LocaleSwitcher />
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-6 pt-16 pb-20 md:pt-24 md:pb-28 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
            {t("hero_title")}
          </h1>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-xl md:max-w-2xl md:mx-0 mx-auto">
            {t("hero_sub")}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/auth/sign-in">{t("cta_primary")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <a href="#features">{t("cta_secondary")}</a>
            </Button>
          </div>
        </section>

        <section
          id="features"
          className="mx-auto max-w-5xl px-6 py-16 md:py-24"
        >
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-center md:text-left">
            {t("features_title")}
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {features.map((f) => (
              <Card key={f.key} className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground leading-relaxed">
                  {f.desc}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 px-6 py-8 md:px-10">
        <p className="mx-auto max-w-3xl text-xs text-muted-foreground text-center md:text-left">
          {t("disclaimer")}
        </p>
      </footer>
    </div>
  );
}
