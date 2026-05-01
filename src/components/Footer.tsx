import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function Footer() {
  const t = await getTranslations("footer");
  return (
    <footer className="border-t border-border/60 px-6 py-6 md:px-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:gap-4">
        <p>{t("copyright")}</p>
        <nav className="flex items-center gap-5">
          <Link
            href="/privacy"
            className="hover:text-foreground"
          >
            {t("privacy")}
          </Link>
          <Link
            href="/terms"
            className="hover:text-foreground"
          >
            {t("terms")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
