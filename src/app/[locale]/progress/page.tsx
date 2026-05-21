import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ProgressPhotosClient } from "@/components/ProgressPhotosClient";
import { SignOutButton } from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/server";
import { enforceActiveSubscription } from "@/lib/subscription-guard";

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

type ProgressPhotoRow = {
  id: string;
  captured_at: string;
  storage_path: string;
  angle: string;
  notes: string | null;
};

export default async function ProgressPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: "/auth/sign-in", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user!.id)
    .maybeSingle();

  await enforceActiveSubscription({
    tier: profile?.subscription_tier,
    locale: locale as "es" | "en",
  });

  const t = await getTranslations("progress");
  const tApp = await getTranslations("app");
  const tAuth = await getTranslations("auth");

  const { data } = await supabase
    .from("progress_photos")
    .select("id,captured_at,storage_path,angle,notes")
    .eq("user_id", user!.id)
    .order("captured_at", { ascending: false })
    .limit(24);

  const photos = await Promise.all(
    ((data ?? []) as ProgressPhotoRow[]).map(async (photo) => {
      const { data: signed } = await supabase.storage
        .from("progress-photos")
        .createSignedUrl(photo.storage_path, 60 * 10);
      return { ...photo, signedUrl: signed?.signedUrl ?? null };
    }),
  );

  const navLinkStyle: React.CSSProperties = {
    fontFamily: SANS,
    fontSize: "12px",
    letterSpacing: "0.24em",
    textTransform: "uppercase",
    color: "var(--pp-text-secondary)",
    textDecoration: "none",
  };

  return (
    <div
      className="flex flex-col flex-1"
      style={{
        background: "var(--pp-bg)",
        color: "var(--pp-text)",
        fontFamily: SERIF,
        minHeight: "100vh",
      }}
    >
      <header
        className="mx-auto w-full"
        style={{
          maxWidth: "880px",
          padding: "1.5rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link href="/dashboard" style={navLinkStyle}>
          {tApp("name")}
        </Link>
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            alignItems: "center",
          }}
        >
          <Link href="/check-in" style={navLinkStyle}>
            {t("nav_checkin")}
          </Link>
          <LocaleSwitcher />
          <SignOutButton label={tAuth("sign_out")} />
        </div>
      </header>

      <main
        className="flex-1 mx-auto w-full"
        style={{ maxWidth: "760px", padding: "2.5rem 1.5rem 5rem" }}
      >
        <Link
          href="/check-in"
          style={{
            ...navLinkStyle,
            display: "inline-block",
            marginBottom: "1.5rem",
          }}
          className="hover:text-[var(--pp-accent)]"
        >
          {t("back")}
        </Link>

        <section
          style={{
            border: "0.5px solid rgba(201, 150, 107, 0.32)",
            borderRadius: "14px",
            padding: "1.25rem",
            background:
              "radial-gradient(circle at 85% 0%, rgba(201, 150, 107, 0.2), transparent 34%), linear-gradient(135deg, rgba(201, 150, 107, 0.12), rgba(34, 28, 25, 0.96) 44%, rgba(26, 22, 20, 0.98))",
            marginBottom: "1rem",
          }}
          className="pp-fade-up"
        >
          <p
            style={{
              fontFamily: SANS,
              fontSize: "11px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--pp-text-secondary)",
              margin: 0,
            }}
          >
            {t("eyebrow")}
          </p>
          <h1
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "clamp(42px, 11vw, 72px)",
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              fontWeight: 400,
              color: "var(--pp-text)",
              margin: "0.8rem 0 0",
            }}
          >
            {t("title")}
          </h1>
          <p
            style={{
              fontFamily: SERIF,
              color: "var(--pp-text-secondary)",
              fontSize: "18px",
              lineHeight: 1.55,
              maxWidth: "620px",
              margin: "1rem 0 0",
            }}
          >
            {t("body")}
          </p>
        </section>

        <ProgressPhotosClient initialPhotos={photos} />
      </main>
    </div>
  );
}
