import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { FoodPhotosClient } from "@/components/FoodPhotosClient";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import {
  deriveNutritionTargets,
  type GoalType,
  type Sex,
} from "@/lib/nutrition/targets";
import { createClient } from "@/lib/supabase/server";
import { enforceActiveSubscription } from "@/lib/subscription-guard";

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

type FoodPhotoRow = {
  id: string;
  eaten_at: string;
  storage_path: string | null;
  meal_type: string;
  description: string | null;
  calories_estimate: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

type NutritionTargets = {
  dailyCalories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  source: "profile" | "tdee" | "goal_fallback";
};

function numericValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSex(value: unknown): Sex | null {
  if (value === "m" || value === "male") return "male";
  if (value === "f" || value === "female") return "female";
  if (value === "other") return "other";
  return null;
}

function normalizeGoal(value: unknown): GoalType | null {
  return value === "lose" || value === "maintain" || value === "gain"
    ? value
    : null;
}

export default async function FoodPage({
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
    .select(
      "subscription_tier,sex,birth_year,height_cm,goal_weight_kg,daily_calorie_target,protein_target_g,carbs_target_g,fat_target_g,nutrition_goal_type",
    )
    .eq("id", user!.id)
    .maybeSingle();

  await enforceActiveSubscription({
    tier: profile?.subscription_tier,
    locale: locale as "es" | "en",
  });

  const t = await getTranslations("food");
  const tApp = await getTranslations("app");
  const tAuth = await getTranslations("auth");

  const { data } = await supabase
    .from("food_photos")
    .select(
      "id,eaten_at,storage_path,meal_type,description,calories_estimate,protein_g,carbs_g,fat_g",
    )
    .eq("user_id", user!.id)
    .order("eaten_at", { ascending: false })
    .limit(24);

  const { data: latestWeight } = await supabase
    .from("weight_entries")
    .select("weight_kg")
    .eq("user_id", user!.id)
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const photos = await Promise.all(
    ((data ?? []) as FoodPhotoRow[]).map(async (photo) => {
      if (!photo.storage_path) return { ...photo, signedUrl: null };
      const { data: signed } = await supabase.storage
        .from("food-photos")
        .createSignedUrl(photo.storage_path, 60 * 10);
      return { ...photo, signedUrl: signed?.signedUrl ?? null };
    }),
  );

  const currentYear = new Date().getFullYear();
  const birthYear = numericValue(profile?.birth_year);
  const age =
    birthYear && birthYear > 1900 && birthYear < currentYear
      ? currentYear - birthYear
      : null;
  const derivedTargets = deriveNutritionTargets({
    sex: normalizeSex(profile?.sex),
    age,
    heightCm: numericValue(profile?.height_cm),
    weightKg:
      numericValue(latestWeight?.weight_kg) ??
      numericValue(profile?.goal_weight_kg),
    goalWeightKg: numericValue(profile?.goal_weight_kg),
    goalType: normalizeGoal(profile?.nutrition_goal_type),
    persistedTargets: {
      dailyCalories: numericValue(profile?.daily_calorie_target),
      proteinG: numericValue(profile?.protein_target_g),
      carbsG: numericValue(profile?.carbs_target_g),
      fatG: numericValue(profile?.fat_target_g),
    },
  });
  const nutritionTargets: NutritionTargets = {
    ...derivedTargets.targets,
    source: derivedTargets.source,
  };

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
            border: "0.5px solid rgba(136, 211, 159, 0.32)",
            borderRadius: "14px",
            padding: "1.25rem",
            background:
              "radial-gradient(circle at 85% 0%, rgba(136, 211, 159, 0.18), transparent 34%), linear-gradient(135deg, rgba(136, 211, 159, 0.11), rgba(34, 28, 25, 0.96) 44%, rgba(26, 22, 20, 0.98))",
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

        <FoodPhotosClient
          initialPhotos={photos}
          nutritionTargets={nutritionTargets}
        />
      </main>
    </div>
  );
}
