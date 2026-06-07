"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CustomSelect } from "@/components/CustomSelect";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics/client";
import type { AnalyticsLocale } from "@/lib/analytics/events";
import {
  cardStyle,
  inputStyle,
  labelStyle,
  selectStyle,
  secondaryBtnStyle,
  textareaStyle,
} from "@/lib/log-form-styles";

type FoodPhoto = {
  id: string;
  eaten_at: string;
  storage_path: string | null;
  meal_type: string;
  description: string | null;
  calories_estimate: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  signedUrl: string | null;
};

const MEAL_TYPES = ["meal", "breakfast", "lunch", "dinner", "snack"] as const;
type MealType = (typeof MEAL_TYPES)[number];
type NutritionField = {
  value: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  label: string;
  step: string;
};
type FoodEstimate = {
  description: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  confidence: "low" | "medium" | "high";
  uncertainty: string;
};
type BarcodeProduct = {
  barcode: string;
  description: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  source: string;
  serving_size: string | null;
};
type NutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealsWithNutrition: number;
};
type NutritionTargets = {
  dailyCalories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  source: "profile" | "tdee" | "goal_fallback";
};

function fileExtension(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function nowLocalDateTime(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalDateTimeInput(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return nowLocalDateTime();
  d.setSeconds(0, 0);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function optionalNumber(value: string): number | null {
  if (value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function sumNutrition(items: FoodPhoto[]): NutritionTotals {
  return items.reduce<NutritionTotals>(
    (acc, item) => {
      const hasNutrition =
        item.calories_estimate !== null ||
        item.protein_g !== null ||
        item.carbs_g !== null ||
        item.fat_g !== null;
      return {
        calories: acc.calories + (item.calories_estimate ?? 0),
        protein: acc.protein + (item.protein_g ?? 0),
        carbs: acc.carbs + (item.carbs_g ?? 0),
        fat: acc.fat + (item.fat_g ?? 0),
        mealsWithNutrition: acc.mealsWithNutrition + (hasNutrition ? 1 : 0),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, mealsWithNutrition: 0 },
  );
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function FoodPhotosClient({
  initialPhotos,
  nutritionTargets,
}: {
  initialPhotos: FoodPhoto[];
  nutritionTargets: NutritionTargets;
}) {
  const t = useTranslations("food");
  const locale = useLocale() as AnalyticsLocale;
  const [photos, setPhotos] = useState(initialPhotos);
  const [mealType, setMealType] = useState<MealType>("meal");
  const [eatenAt, setEatenAt] = useState(nowLocalDateTime());
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [barcode, setBarcode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [estimate, setEstimate] = useState<FoodEstimate | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<BarcodeProduct | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMealType, setEditMealType] = useState<MealType>("meal");
  const [editEatenAt, setEditEatenAt] = useState(nowLocalDateTime());
  const [editDescription, setEditDescription] = useState("");
  const [editCalories, setEditCalories] = useState("");
  const [editProtein, setEditProtein] = useState("");
  const [editCarbs, setEditCarbs] = useState("");
  const [editFat, setEditFat] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isAnalyzing, startAnalyze] = useTransition();
  const [isLookingUpBarcode, startBarcodeLookup] = useTransition();
  const today = useMemo(() => new Date(), []);
  const todayPhotos = useMemo(
    () => photos.filter((photo) => sameLocalDay(new Date(photo.eaten_at), today)),
    [photos, today],
  );
  const sevenDayPhotos = useMemo(() => {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return photos.filter((photo) => new Date(photo.eaten_at) >= start);
  }, [photos, today]);
  const todayTotals = useMemo(() => sumNutrition(todayPhotos), [todayPhotos]);
  const sevenDayTotals = useMemo(() => sumNutrition(sevenDayPhotos), [sevenDayPhotos]);
  const groupedPhotos = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return photos.reduce<
      Array<{
        key: string;
        label: string;
        totals: NutritionTotals;
        items: FoodPhoto[];
      }>
    >((groups, photo) => {
      const date = new Date(photo.eaten_at);
      const key = localDayKey(date);
      const existing = groups.find((group) => group.key === key);
      if (existing) {
        existing.items.push(photo);
        existing.totals = sumNutrition(existing.items);
        return groups;
      }
      groups.push({
        key,
        label: formatter.format(date),
        totals: sumNutrition([photo]),
        items: [photo],
      });
      return groups;
    }, []);
  }, [photos, locale]);
  const weeklyNutrition = useMemo(() => {
    const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      date.setHours(0, 0, 0, 0);
      const items = photos.filter((photo) =>
        localDayKey(new Date(photo.eaten_at)) === localDayKey(date),
      );
      return {
        key: localDayKey(date),
        label:
          index === 6
            ? t("rhythm_today")
            : weekdayFormatter.format(date).replace(".", ""),
        totals: sumNutrition(items),
        meals: items.length,
      };
    });
  }, [photos, today, locale, t]);
  const weeklyMaxCalories = Math.max(
    1,
    ...weeklyNutrition.map((day) => day.totals.calories),
  );
  const weeklyMaxProtein = Math.max(
    1,
    ...weeklyNutrition.map((day) => day.totals.protein),
  );
  const hasWeeklyNutrition = weeklyNutrition.some(
    (day) => day.totals.mealsWithNutrition > 0,
  );
  const todayInsight =
    todayPhotos.length === 0
      ? {
          title: t("insight_empty_title"),
          body: t("insight_empty_body"),
          color: "#d6a06f",
        }
      : todayTotals.protein < 30
        ? {
            title: t("insight_protein_title"),
            body: t("insight_protein_body", {
              protein: formatNumber(todayTotals.protein, 1),
            }),
            color: "#88d39f",
          }
        : todayPhotos.length < 2
          ? {
              title: t("insight_next_meal_title"),
              body: t("insight_next_meal_body", {
                meals: todayPhotos.length,
                protein: formatNumber(todayTotals.protein, 1),
              }),
              color: "#d6a06f",
            }
          : {
              title: t("insight_tracked_title"),
              body: t("insight_tracked_body", {
                meals: todayPhotos.length,
                calories: formatNumber(todayTotals.calories),
                protein: formatNumber(todayTotals.protein, 1),
              }),
              color: "#88d39f",
            };

  const macroTotal = todayTotals.protein + todayTotals.carbs + todayTotals.fat;
  const macroSegments =
    macroTotal > 0
      ? [
          {
            label: t("protein"),
            value: todayTotals.protein,
            color: "#88d39f",
            width: (todayTotals.protein / macroTotal) * 100,
          },
          {
            label: t("carbs"),
            value: todayTotals.carbs,
            color: "#d6a06f",
            width: (todayTotals.carbs / macroTotal) * 100,
          },
          {
            label: t("fat"),
            value: todayTotals.fat,
            color: "#b58cff",
            width: (todayTotals.fat / macroTotal) * 100,
          },
        ]
      : [];
  const calorieTarget = nutritionTargets.dailyCalories;
  const caloriesRemaining =
    calorieTarget === null ? null : calorieTarget - todayTotals.calories;
  const macroTargets = [
    {
      key: "protein",
      label: t("protein"),
      consumed: todayTotals.protein,
      target: nutritionTargets.proteinG,
      color: "#88d39f",
    },
    {
      key: "carbs",
      label: t("carbs"),
      consumed: todayTotals.carbs,
      target: nutritionTargets.carbsG,
      color: "#d6a06f",
    },
    {
      key: "fat",
      label: t("fat"),
      consumed: todayTotals.fat,
      target: nutritionTargets.fatG,
      color: "#b58cff",
    },
  ] as const;

  async function refreshPhotos(userId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("food_photos")
      .select(
        "id,eaten_at,storage_path,meal_type,description,calories_estimate,protein_g,carbs_g,fat_g",
      )
      .eq("user_id", userId)
      .order("eaten_at", { ascending: false })
      .limit(24);

    const rows = (data ?? []) as Omit<FoodPhoto, "signedUrl">[];
    const withUrls = await Promise.all(
      rows.map(async (photo) => {
        if (!photo.storage_path) return { ...photo, signedUrl: null };
        const { data: signed } = await supabase.storage
          .from("food-photos")
          .createSignedUrl(photo.storage_path, 60 * 10);
        return { ...photo, signedUrl: signed?.signedUrl ?? null };
      }),
    );
    setPhotos(withUrls);
  }

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const hasManualData =
      description.trim().length > 0 ||
      calories.trim().length > 0 ||
      protein.trim().length > 0 ||
      carbs.trim().length > 0 ||
      fat.trim().length > 0;
    if (!file && !hasManualData) {
      setMessage(t("error_food_data"));
      return;
    }
    if (file && !file.type.startsWith("image/")) {
      setMessage(t("error_image"));
      return;
    }
    if (file && file.size > 10 * 1024 * 1024) {
      setMessage(t("error_size"));
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMessage(t("error_auth"));
        return;
      }

      const id = crypto.randomUUID();
      let storagePath: string | null = null;

      if (file) {
        storagePath = `${user.id}/${id}.${fileExtension(file)}`;
        const upload = await supabase.storage
          .from("food-photos")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (upload.error) {
          setMessage(t("error_upload"));
          return;
        }
      }

      const inserted = await supabase.from("food_photos").insert({
        id,
        user_id: user.id,
        eaten_at: new Date(eatenAt).toISOString(),
        storage_path: storagePath,
        meal_type: mealType,
        description: description.trim().length > 0 ? description.trim() : null,
        calories_estimate: optionalNumber(calories),
        protein_g: optionalNumber(protein),
        carbs_g: optionalNumber(carbs),
        fat_g: optionalNumber(fat),
      });

      if (inserted.error) {
        if (storagePath) {
          await supabase.storage.from("food-photos").remove([storagePath]);
        }
        setMessage(t("error_save"));
        return;
      }

      setFile(null);
      setDescription("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
      setBarcode("");
      setEstimate(null);
      setBarcodeProduct(null);
      setMealType("meal");
      setEatenAt(nowLocalDateTime());
      setMessage(t("saved"));
      track("first_log", { locale, props: { log_type: "food" } });
      await refreshPhotos(user.id);
    });
  }

  async function onBarcodeLookup() {
    setMessage(null);
    setBarcodeProduct(null);
    const normalized = barcode.replace(/\D/g, "");
    if (!normalized) {
      setMessage(t("error_barcode_required"));
      return;
    }

    startBarcodeLookup(async () => {
      const res = await fetch("/api/food/barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: normalized, locale }),
      });
      if (res.status === 404) {
        setMessage(t("error_barcode_not_found"));
        return;
      }
      if (!res.ok) {
        setMessage(t("error_barcode"));
        return;
      }
      const payload = (await res.json()) as { product?: BarcodeProduct };
      if (!payload.product) {
        setMessage(t("error_barcode"));
        return;
      }
      setBarcodeProduct(payload.product);
      setBarcode(normalized);
      setDescription(payload.product.description);
      if (payload.product.calories !== null) {
        setCalories(String(payload.product.calories));
      }
      if (payload.product.protein_g !== null) {
        setProtein(String(payload.product.protein_g));
      }
      if (payload.product.carbs_g !== null) {
        setCarbs(String(payload.product.carbs_g));
      }
      if (payload.product.fat_g !== null) {
        setFat(String(payload.product.fat_g));
      }
      setMessage(t("barcode_found"));
    });
  }

  async function onAnalyze() {
    setMessage(null);
    setEstimate(null);
    if (!file && description.trim().length === 0) {
      setMessage(t("error_analyze_context"));
      return;
    }
    if (file && !file.type.startsWith("image/")) {
      setMessage(t("error_image"));
      return;
    }
    if (file && file.size > 10 * 1024 * 1024) {
      setMessage(t("error_size"));
      return;
    }

    startAnalyze(async () => {
      const fd = new FormData();
      if (file) fd.set("file", file);
      fd.set("description", description);
      fd.set("locale", locale);
      const res = await fetch("/api/food/analyze", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        setMessage(t("error_analyze"));
        return;
      }
      const payload = (await res.json()) as { estimate?: FoodEstimate };
      if (!payload.estimate) {
        setMessage(t("error_analyze"));
        return;
      }
      setEstimate(payload.estimate);
      if (payload.estimate.description) {
        setDescription(payload.estimate.description);
      }
      if (payload.estimate.calories !== null) {
        setCalories(String(payload.estimate.calories));
      }
      if (payload.estimate.protein_g !== null) {
        setProtein(String(payload.estimate.protein_g));
      }
      if (payload.estimate.carbs_g !== null) {
        setCarbs(String(payload.estimate.carbs_g));
      }
      if (payload.estimate.fat_g !== null) {
        setFat(String(payload.estimate.fat_g));
      }
      setMessage(t("analyzed"));
    });
  }

  async function onDelete(photo: FoodPhoto) {
    setMessage(null);
    startTransition(async () => {
      const supabase = createClient();
      const removed = await supabase
        .from("food_photos")
        .delete()
        .eq("id", photo.id);
      if (removed.error) {
        setMessage(t("error_delete"));
        return;
      }
      if (photo.storage_path) {
        await supabase.storage.from("food-photos").remove([photo.storage_path]);
      }
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      setMessage(t("deleted"));
    });
  }

  function startEditing(photo: FoodPhoto) {
    setEditingId(photo.id);
    setEditMealType(
      MEAL_TYPES.includes(photo.meal_type as MealType)
        ? (photo.meal_type as MealType)
        : "meal",
    );
    setEditEatenAt(toLocalDateTimeInput(photo.eaten_at));
    setEditDescription(photo.description ?? "");
    setEditCalories(photo.calories_estimate === null ? "" : String(photo.calories_estimate));
    setEditProtein(photo.protein_g === null ? "" : String(photo.protein_g));
    setEditCarbs(photo.carbs_g === null ? "" : String(photo.carbs_g));
    setEditFat(photo.fat_g === null ? "" : String(photo.fat_g));
    setMessage(null);
  }

  async function onUpdate(photo: FoodPhoto) {
    setMessage(null);
    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMessage(t("error_auth"));
        return;
      }
      const updated = await supabase
        .from("food_photos")
        .update({
          eaten_at: new Date(editEatenAt).toISOString(),
          meal_type: editMealType,
          description:
            editDescription.trim().length > 0 ? editDescription.trim() : null,
          calories_estimate: optionalNumber(editCalories),
          protein_g: optionalNumber(editProtein),
          carbs_g: optionalNumber(editCarbs),
          fat_g: optionalNumber(editFat),
        })
        .eq("id", photo.id);
      if (updated.error) {
        setMessage(t("error_update"));
        return;
      }
      setEditingId(null);
      setMessage(t("updated"));
      await refreshPhotos(user.id);
    });
  }

  async function onRepeat(photo: FoodPhoto) {
    setMessage(null);
    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMessage(t("error_auth"));
        return;
      }

      const inserted = await supabase.from("food_photos").insert({
        id: crypto.randomUUID(),
        user_id: user.id,
        eaten_at: new Date().toISOString(),
        storage_path: null,
        meal_type: MEAL_TYPES.includes(photo.meal_type as MealType)
          ? photo.meal_type
          : "meal",
        description: photo.description,
        calories_estimate: photo.calories_estimate,
        protein_g: photo.protein_g,
        carbs_g: photo.carbs_g,
        fat_g: photo.fat_g,
      });

      if (inserted.error) {
        setMessage(t("error_save"));
        return;
      }

      setMessage(t("repeated"));
      track("first_log", { locale, props: { log_type: "food" } });
      await refreshPhotos(user.id);
    });
  }

  const SANS = "var(--pp-font-sans)";
  const SERIF = "var(--pp-font-serif)";

  return (
    <div>
      <section
        className="pp-fade-up"
        style={{
          border: "0.5px solid rgba(214, 160, 111, 0.34)",
          borderRadius: "18px",
          padding: "1rem",
          marginBottom: "1rem",
          background:
            "radial-gradient(circle at 82% 0%, rgba(214, 160, 111, 0.18), transparent 36%), linear-gradient(150deg, rgba(58, 37, 25, 0.78), rgba(24, 19, 17, 0.98) 48%, rgba(12, 10, 9, 0.92))",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.08), 0 20px 48px rgba(0,0,0,0.24)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            alignItems: "start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                fontFamily: SANS,
                color: "var(--pp-text-tertiary)",
                fontSize: "10px",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              {t("command_eyebrow")}
            </p>
            <h2
              style={{
                fontFamily: SERIF,
                color: "var(--pp-text)",
                fontSize: "clamp(30px, 9vw, 58px)",
                fontStyle: "italic",
                fontWeight: 400,
                letterSpacing: "-0.03em",
                lineHeight: 0.95,
                margin: "0.6rem 0 0",
              }}
            >
              {t("command_title")}
            </h2>
          </div>
          <p
            style={{
              fontFamily: SANS,
              color: "#d6a06f",
              fontSize: "11px",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            {todayPhotos.length > 0
              ? t("command_meals_today", { count: todayPhotos.length })
              : t("command_no_meals")}
          </p>
        </div>

        <div
          style={{
            border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: "16px",
            padding: "1rem",
            marginTop: "1rem",
            background:
              "linear-gradient(145deg, rgba(214,160,111,0.12), rgba(8,6,5,0.28))",
          }}
        >
          {calorieTarget === null ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <p
                  style={{
                    fontFamily: SANS,
                    color: "var(--pp-text-tertiary)",
                    fontSize: "10px",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    margin: 0,
                  }}
                >
                  {t("remaining_label")}
                </p>
                <p
                  style={{
                    fontFamily: SERIF,
                    color: "var(--pp-text)",
                    fontSize: "clamp(30px, 9vw, 52px)",
                    fontStyle: "italic",
                    lineHeight: 1,
                    margin: "0.5rem 0 0",
                  }}
                >
                  {t("target_missing_title")}
                </p>
                <p
                  style={{
                    fontFamily: SERIF,
                    color: "var(--pp-text-secondary)",
                    fontSize: "15px",
                    lineHeight: 1.5,
                    margin: "0.55rem 0 0",
                  }}
                >
                  {t("target_missing_body")}
                </p>
              </div>
              <Link
                href="/goals"
                className="pp-action-card"
                style={{
                  border: "0.5px solid rgba(214,160,111,0.7)",
                  borderRadius: "999px",
                  color: "#d6a06f",
                  fontFamily: SANS,
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  padding: "0.85rem 1rem",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {t("set_goal_cta")}
              </Link>
            </div>
          ) : (
            <div>
              <p
                style={{
                  fontFamily: SANS,
                  color: "var(--pp-text-tertiary)",
                  fontSize: "10px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                {t("remaining_label")}
              </p>
              <p
                style={{
                  fontFamily: SERIF,
                  color:
                    caloriesRemaining !== null && caloriesRemaining < 0
                      ? "#e08aa8"
                      : "#d6a06f",
                  fontSize: "clamp(46px, 16vw, 92px)",
                  fontStyle: "italic",
                  letterSpacing: "-0.05em",
                  lineHeight: 0.9,
                  margin: "0.55rem 0 0",
                }}
              >
                {formatNumber(caloriesRemaining ?? 0)}
              </p>
              <p
                style={{
                  fontFamily: SANS,
                  color: "var(--pp-text-secondary)",
                  fontSize: "11px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  margin: "0.75rem 0 0",
                }}
              >
                {t("remaining_hint", {
                  consumed: formatNumber(todayTotals.calories),
                  target: formatNumber(calorieTarget),
                })}
              </p>
              <p
                style={{
                  fontFamily: SANS,
                  color: "var(--pp-helper)",
                  fontSize: "11px",
                  lineHeight: 1.5,
                  margin: "0.55rem 0 0",
                }}
              >
                {t(
                  nutritionTargets.source === "profile"
                    ? "target_saved_note"
                    : "target_estimate_note",
                )}
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3" style={{ marginTop: "1rem" }}>
          {macroTargets.map((macro) => {
            const progress =
              macro.target && macro.target > 0
                ? Math.min(100, (macro.consumed / macro.target) * 100)
                : 100;
            return (
              <div
                key={macro.key}
                style={{
                  border: "0.5px solid rgba(255,255,255,0.08)",
                  borderRadius: "14px",
                  padding: "0.85rem",
                  background: "rgba(8, 6, 5, 0.24)",
                }}
              >
                <p
                  style={{
                    fontFamily: SANS,
                    color: macro.color,
                    fontSize: "10px",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    margin: 0,
                  }}
                >
                  {macro.label}
                </p>
                <p
                  style={{
                    fontFamily: SERIF,
                    color: "var(--pp-text)",
                    fontSize: "28px",
                    fontStyle: "italic",
                    lineHeight: 1,
                    margin: "0.55rem 0 0",
                  }}
                >
                  {formatNumber(macro.consumed, 1)}g
                </p>
                <div
                  aria-label={macro.label}
                  style={{
                    height: "7px",
                    borderRadius: "999px",
                    background: "rgba(255,255,255,0.07)",
                    overflow: "hidden",
                    marginTop: "0.7rem",
                  }}
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: "100%",
                      borderRadius: "999px",
                      background: macro.color,
                      opacity: macro.target === null ? 0.45 : 0.95,
                    }}
                  />
                </div>
                <p
                  style={{
                    fontFamily: SANS,
                    color: "var(--pp-text-tertiary)",
                    fontSize: "10px",
                    lineHeight: 1.4,
                    margin: "0.55rem 0 0",
                  }}
                >
                  {macro.target === null
                    ? t("macro_consumed_only")
                    : t("macro_vs_target", {
                        consumed: formatNumber(macro.consumed, 1),
                        target: formatNumber(macro.target),
                      })}
                </p>
              </div>
            );
          })}
        </div>

        <div
          style={{
            borderTop: "0.5px solid rgba(255,255,255,0.08)",
            marginTop: "1rem",
            paddingTop: "1rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              alignItems: "baseline",
              marginBottom: "0.75rem",
            }}
          >
            <p
              style={{
                fontFamily: SANS,
                color: "var(--pp-text-tertiary)",
                fontSize: "10px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              {t("today_meals_title")}
            </p>
            <p
              style={{
                fontFamily: SANS,
                color: "var(--pp-text-tertiary)",
                fontSize: "10px",
                margin: 0,
              }}
            >
              {t("today_local_hint")}
            </p>
          </div>
          {todayPhotos.length === 0 ? (
            <p
              style={{
                border: "0.5px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                color: "var(--pp-text-secondary)",
                fontFamily: SERIF,
                fontStyle: "italic",
                margin: 0,
                padding: "0.9rem",
              }}
            >
              {t("today_meals_empty")}
            </p>
          ) : (
            <div className="grid gap-2">
              {todayPhotos.map((photo) => (
                <article
                  key={photo.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "0.8rem",
                    border: "0.5px solid rgba(255,255,255,0.08)",
                    borderRadius: "12px",
                    padding: "0.85rem",
                    background: "rgba(8, 6, 5, 0.22)",
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontFamily: SANS,
                        color: "#88d39f",
                        fontSize: "10px",
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        margin: 0,
                      }}
                    >
                      {t(`meal_${photo.meal_type}`)} ·{" "}
                      {new Intl.DateTimeFormat(locale, {
                        timeStyle: "short",
                      }).format(new Date(photo.eaten_at))}
                    </p>
                    <p
                      style={{
                        fontFamily: SERIF,
                        color: "var(--pp-text-secondary)",
                        fontSize: "14px",
                        lineHeight: 1.45,
                        margin: "0.45rem 0 0",
                      }}
                    >
                      {photo.description ?? t("meal_no_description")}
                    </p>
                    <p
                      style={{
                        fontFamily: SANS,
                        color: "var(--pp-text-tertiary)",
                        fontSize: "11px",
                        margin: "0.5rem 0 0",
                      }}
                    >
                      P {formatNumber(photo.protein_g ?? 0, 1)} · C{" "}
                      {formatNumber(photo.carbs_g ?? 0, 1)} · F{" "}
                      {formatNumber(photo.fat_g ?? 0, 1)}
                    </p>
                  </div>
                  <p
                    style={{
                      fontFamily: SERIF,
                      color: "#d6a06f",
                      fontSize: "24px",
                      fontStyle: "italic",
                      lineHeight: 1,
                      margin: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {photo.calories_estimate === null
                      ? "—"
                      : formatNumber(photo.calories_estimate)}
                    <span
                      style={{
                        fontFamily: SANS,
                        color: "var(--pp-text-tertiary)",
                        fontSize: "10px",
                        fontStyle: "normal",
                        letterSpacing: "0.12em",
                        marginLeft: "0.25rem",
                      }}
                    >
                      kcal
                    </span>
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section
        className="pp-fade-up"
        style={{
          border: "0.5px solid rgba(214, 160, 111, 0.36)",
          borderRadius: "16px",
          padding: "1rem",
          marginBottom: "1rem",
          background:
            "radial-gradient(circle at 18% 0%, rgba(214, 160, 111, 0.2), transparent 32%), linear-gradient(135deg, rgba(30, 24, 21, 0.98), rgba(15, 12, 10, 0.92))",
        }}
      >
        <div
          className="grid gap-3 sm:grid-cols-4"
          style={{ alignItems: "stretch" }}
        >
          {[
            {
              label: t("today_calories"),
              value: `${formatNumber(todayTotals.calories)} kcal`,
              color: "#d6a06f",
            },
            {
              label: t("today_protein"),
              value: `${formatNumber(todayTotals.protein, 1)}g`,
              color: "#88d39f",
            },
            {
              label: t("today_carbs"),
              value: `${formatNumber(todayTotals.carbs, 1)}g`,
              color: "#d6a06f",
            },
            {
              label: t("today_fat"),
              value: `${formatNumber(todayTotals.fat, 1)}g`,
              color: "#b58cff",
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="pp-stat-card"
              style={{
                border: "0.5px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                padding: "0.9rem",
                background: "rgba(8, 6, 5, 0.28)",
              }}
            >
              <p
                style={{
                  fontFamily: SANS,
                  color: "var(--pp-text-tertiary)",
                  fontSize: "10px",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                {metric.label}
              </p>
              <p
                style={{
                  fontFamily: SERIF,
                  color: metric.color,
                  fontSize: "clamp(26px, 7vw, 40px)",
                  fontStyle: "italic",
                  lineHeight: 1,
                  margin: "0.55rem 0 0",
                }}
              >
                {metric.value}
              </p>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: "1rem",
            border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
            padding: "0.9rem",
            background: "rgba(8, 6, 5, 0.22)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: SANS,
                  color: "var(--pp-text-tertiary)",
                  fontSize: "10px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                {t("macro_rhythm")}
              </p>
              <p
                style={{
                  fontFamily: SERIF,
                  color: "var(--pp-text-secondary)",
                  fontSize: "14px",
                  lineHeight: 1.5,
                  margin: "0.35rem 0 0",
                }}
              >
                {t("dashboard_hint", {
                  meals: todayPhotos.length,
                  seven: sevenDayPhotos.length,
                })}
              </p>
            </div>
            <p
              style={{
                fontFamily: SANS,
                color: "#d6a06f",
                fontSize: "11px",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              {t("seven_day_total", {
                calories: formatNumber(sevenDayTotals.calories),
              })}
            </p>
          </div>

          <div
            aria-label={t("macro_rhythm")}
            style={{
              height: "14px",
              borderRadius: "999px",
              overflow: "hidden",
              marginTop: "0.85rem",
              background: "rgba(255,255,255,0.06)",
              display: "flex",
              boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.08)",
            }}
          >
            {macroSegments.length === 0 ? (
              <div
                style={{
                  width: "100%",
                  background:
                    "linear-gradient(90deg, rgba(136,211,159,0.12), rgba(214,160,111,0.14), rgba(181,140,255,0.12))",
                }}
              />
            ) : (
              macroSegments.map((segment) => (
                <div
                  key={segment.label}
                  title={`${segment.label}: ${formatNumber(segment.value, 1)}g`}
                  style={{
                    width: `${segment.width}%`,
                    background: segment.color,
                    minWidth: segment.width > 0 ? "6px" : 0,
                  }}
                />
              ))
            )}
          </div>

          <div
            className="grid gap-2 sm:grid-cols-3"
            style={{ marginTop: "0.8rem" }}
          >
            {macroSegments.map((segment) => (
              <p
                key={segment.label}
                style={{
                  fontFamily: SANS,
                  color: "var(--pp-text-secondary)",
                  fontSize: "11px",
                  margin: 0,
                }}
              >
                <span style={{ color: segment.color }}>●</span> {segment.label}:{" "}
                {formatNumber(segment.value, 1)}g
              </p>
            ))}
          </div>
        </div>

        <div
          style={{
            marginTop: "1rem",
            border: `0.5px solid ${todayInsight.color}55`,
            borderRadius: "12px",
            padding: "1rem",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.035), rgba(8,6,5,0.28))",
            boxShadow: `0 18px 40px color-mix(in srgb, ${todayInsight.color} 9%, transparent)`,
          }}
        >
          <p
            style={{
              fontFamily: SANS,
              color: todayInsight.color,
              fontSize: "10px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            {t("today_focus")}
          </p>
          <p
            style={{
              fontFamily: SERIF,
              color: "var(--pp-text)",
              fontSize: "24px",
              fontStyle: "italic",
              lineHeight: 1.1,
              margin: "0.55rem 0 0",
            }}
          >
            {todayInsight.title}
          </p>
          <p
            style={{
              fontFamily: SERIF,
              color: "var(--pp-text-secondary)",
              fontSize: "15px",
              lineHeight: 1.55,
              margin: "0.55rem 0 0",
            }}
          >
            {todayInsight.body}
          </p>
        </div>

        <div
          style={{
            marginTop: "1rem",
            border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
            padding: "0.9rem",
            background:
              "linear-gradient(145deg, rgba(214, 160, 111, 0.08), rgba(8, 6, 5, 0.22))",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              alignItems: "baseline",
              flexWrap: "wrap",
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: SANS,
                  color: "var(--pp-text-tertiary)",
                  fontSize: "10px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                {t("weekly_title")}
              </p>
              <p
                style={{
                  fontFamily: SERIF,
                  color: "var(--pp-text-secondary)",
                  fontSize: "14px",
                  lineHeight: 1.5,
                  margin: "0.35rem 0 0",
                }}
              >
                {t("weekly_hint")}
              </p>
            </div>
            <p
              style={{
                fontFamily: SANS,
                color: "#88d39f",
                fontSize: "11px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              <span style={{ color: "#d6a06f" }}>●</span> {t("calories")} ·{" "}
              <span style={{ color: "#88d39f" }}>●</span> {t("protein")}
            </p>
          </div>

          <div
            data-swipe-nav-ignore="true"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: "0.5rem",
              alignItems: "end",
              minHeight: "168px",
              marginTop: "1rem",
            }}
            aria-label={t("weekly_title")}
          >
            {weeklyNutrition.map((day) => {
              const calorieHeight = hasWeeklyNutrition
                ? Math.max(8, (day.totals.calories / weeklyMaxCalories) * 112)
                : 8;
              const proteinHeight = hasWeeklyNutrition
                ? Math.max(6, (day.totals.protein / weeklyMaxProtein) * 86)
                : 6;
              return (
                <div
                  key={day.key}
                  title={`${day.label}: ${formatNumber(day.totals.calories)} kcal · ${formatNumber(day.totals.protein, 1)}g ${t("protein")}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      height: "122px",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      gap: "0.18rem",
                    }}
                  >
                    <div
                      style={{
                        width: "42%",
                        height: `${calorieHeight}px`,
                        borderRadius: "999px 999px 4px 4px",
                        background:
                          day.totals.calories > 0
                            ? "linear-gradient(180deg, #f3bf85, #a96f3e)"
                            : "rgba(214, 160, 111, 0.16)",
                        boxShadow:
                          day.totals.calories > 0
                            ? "0 0 22px rgba(214,160,111,0.22)"
                            : "none",
                      }}
                    />
                    <div
                      style={{
                        width: "28%",
                        height: `${proteinHeight}px`,
                        borderRadius: "999px 999px 4px 4px",
                        background:
                          day.totals.protein > 0
                            ? "linear-gradient(180deg, #b5f0c3, #4c9b63)"
                            : "rgba(136, 211, 159, 0.14)",
                        boxShadow:
                          day.totals.protein > 0
                            ? "0 0 20px rgba(136,211,159,0.2)"
                            : "none",
                      }}
                    />
                  </div>
                  <p
                    style={{
                      fontFamily: SANS,
                      color: "var(--pp-text-secondary)",
                      fontSize: "10px",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      textAlign: "center",
                      margin: "0.45rem 0 0",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {day.label}
                  </p>
                  <p
                    style={{
                      fontFamily: SANS,
                      color: "var(--pp-text-tertiary)",
                      fontSize: "9px",
                      textAlign: "center",
                      margin: "0.2rem 0 0",
                    }}
                  >
                    {day.meals > 0 ? `${day.meals} ${t("meals_short")}` : "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <form
        onSubmit={onUpload}
        style={{
          border: "0.5px solid rgba(136, 211, 159, 0.28)",
          borderRadius: "14px",
          padding: "1rem",
          background:
            "linear-gradient(135deg, rgba(136, 211, 159, 0.12), rgba(34, 28, 25, 0.96))",
        }}
      >
        <label style={{ ...labelStyle, display: "block", marginBottom: "0.65rem" }}>
          {t("file")}
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setEstimate(null);
          }}
          style={{
            width: "100%",
            color: "var(--pp-text-secondary)",
            fontFamily: SANS,
            fontSize: "13px",
          }}
        />

        <div
          style={{
            ...cardStyle,
            padding: "0.9rem",
            marginTop: "1rem",
          }}
        >
          <label
            htmlFor="food-barcode"
            style={{ ...labelStyle, display: "block", marginBottom: "0.45rem" }}
          >
            {t("barcode")}
          </label>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              id="food-barcode"
              type="text"
              inputMode="numeric"
              value={barcode}
              onChange={(e) => {
                setBarcode(e.target.value);
                setBarcodeProduct(null);
              }}
              placeholder={t("barcode_placeholder")}
              style={{ ...inputStyle, borderRadius: "999px" }}
            />
            <button
              type="button"
              onClick={onBarcodeLookup}
              disabled={isPending || isLookingUpBarcode}
              className="pp-action-card"
              style={{ ...secondaryBtnStyle, borderRadius: "999px", padding: "0.85rem 1rem" }}
            >
              {isLookingUpBarcode ? t("barcode_lookup_loading") : t("barcode_lookup")}
            </button>
          </div>
          <p
            style={{
              fontFamily: SANS,
              color: "var(--pp-text-tertiary)",
              fontSize: "11px",
              lineHeight: 1.55,
              margin: "0.65rem 0 0",
            }}
          >
            {barcodeProduct
              ? t("barcode_found_detail", {
                  source: barcodeProduct.source,
                  serving: barcodeProduct.serving_size ?? t("barcode_serving_unknown"),
                })
              : t("barcode_hint")}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2" style={{ marginTop: "1rem" }}>
          <CustomSelect
            value={mealType}
            onChange={(value) => setMealType(value as MealType)}
            ariaLabel={t("meal_type")}
            style={selectStyle}
            options={MEAL_TYPES.map((item) => ({
              value: item,
              label: t(`meal_${item}`),
            }))}
          />

          <input
            type="datetime-local"
            value={eatenAt}
            onChange={(e) => setEatenAt(e.target.value)}
            aria-label={t("eaten_at")}
            style={inputStyle}
          />
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("description_placeholder")}
          rows={3}
          style={{ ...textareaStyle, marginTop: "1rem" }}
        />

        <div className="grid gap-3 sm:grid-cols-4" style={{ marginTop: "1rem" }}>
          {(
            [
              {
                value: calories,
                setValue: setCalories,
                label: t("calories"),
                step: "1",
              },
              {
                value: protein,
                setValue: setProtein,
                label: t("protein"),
                step: "0.1",
              },
              {
                value: carbs,
                setValue: setCarbs,
                label: t("carbs"),
                step: "0.1",
              },
              {
                value: fat,
                setValue: setFat,
                label: t("fat"),
                step: "0.1",
              },
            ] satisfies NutritionField[]
          ).map((field) => (
            <label
              key={field.label}
              style={{
                ...labelStyle,
                display: "block",
              }}
            >
              <span
                style={{
                  display: "block",
                  marginBottom: "0.35rem",
                }}
              >
                {field.label}
              </span>
              <input
                type="number"
                min="0"
                step={field.step}
                value={field.value}
                onChange={(e) => field.setValue(e.target.value)}
                placeholder={field.label}
                aria-label={field.label}
                style={inputStyle}
              />
            </label>
          ))}
        </div>

        <p
          style={{
            fontFamily: SANS,
            color: "var(--pp-text-tertiary)",
            fontSize: "11px",
            lineHeight: 1.6,
            margin: "0.8rem 0 0",
          }}
        >
          {file ? t("manual_hint") : t("manual_entry_hint")}
        </p>

        <button
          type="button"
          onClick={onAnalyze}
          disabled={isPending || isAnalyzing || (!file && description.trim().length === 0)}
          className="pp-action-card"
          style={{
            width: "100%",
            marginTop: "1rem",
            border: "0.5px solid rgba(136, 211, 159, 0.66)",
            borderRadius: "999px",
            background: "rgba(136, 211, 159, 0.12)",
            color: "#88d39f",
            fontFamily: SANS,
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            padding: "0.95rem",
            cursor: file || description.trim().length > 0 ? "pointer" : "not-allowed",
            opacity: file || description.trim().length > 0 ? 1 : 0.55,
          }}
        >
          {isAnalyzing ? t("analyzing") : t("analyze")}
        </button>

        {estimate && (
          <div
            style={{
              border: "0.5px solid rgba(136, 211, 159, 0.28)",
              borderRadius: "10px",
              padding: "0.9rem",
              marginTop: "0.85rem",
              background: "rgba(8, 6, 5, 0.28)",
            }}
          >
            <p
              style={{
                fontFamily: SANS,
                color: "#88d39f",
                fontSize: "11px",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              {t("estimate_title", {
                confidence: t(`confidence_${estimate.confidence}`),
              })}
            </p>
            <div
              className="grid gap-2 sm:grid-cols-4"
              style={{ marginTop: "0.75rem" }}
            >
              {[
                {
                  label: t("calories"),
                  value:
                    estimate.calories === null ? "—" : `${estimate.calories}`,
                  color: "#d6a06f",
                },
                {
                  label: t("protein"),
                  value:
                    estimate.protein_g === null ? "—" : `${estimate.protein_g}g`,
                  color: "#88d39f",
                },
                {
                  label: t("carbs"),
                  value:
                    estimate.carbs_g === null ? "—" : `${estimate.carbs_g}g`,
                  color: "#d6a06f",
                },
                {
                  label: t("fat"),
                  value: estimate.fat_g === null ? "—" : `${estimate.fat_g}g`,
                  color: "#b58cff",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    border: "0.5px solid rgba(255,255,255,0.08)",
                    borderRadius: "9px",
                    padding: "0.65rem",
                    background: "rgba(255,255,255,0.035)",
                  }}
                >
                  <p
                    style={{
                      fontFamily: SANS,
                      color: "var(--pp-text-tertiary)",
                      fontSize: "9px",
                      letterSpacing: "0.14em",
                      margin: 0,
                      textTransform: "uppercase",
                    }}
                  >
                    {item.label}
                  </p>
                  <p
                    style={{
                      fontFamily: SERIF,
                      color: item.color,
                      fontSize: "20px",
                      fontStyle: "italic",
                      lineHeight: 1,
                      margin: "0.35rem 0 0",
                    }}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            <p
              style={{
                fontFamily: SERIF,
                color: "var(--pp-text-secondary)",
                fontSize: "14px",
                lineHeight: 1.55,
                margin: "0.55rem 0 0",
              }}
            >
              {estimate.uncertainty || t("estimate_hint")}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || isAnalyzing}
          className="pp-action-card"
          style={{
            width: "100%",
            marginTop: "1rem",
            border: "0.5px solid #88d39f",
            borderRadius: "999px",
            background: "#88d39f",
            color: "var(--pp-bg)",
            fontFamily: SANS,
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            padding: "0.95rem",
            cursor: "pointer",
          }}
        >
          {isPending ? t("saving") : t("save")}
        </button>

        {message && (
          <p
            role="status"
            style={{
              fontFamily: SANS,
              color: "#88d39f",
              fontSize: "12px",
              margin: "0.85rem 0 0",
            }}
          >
            {message}
          </p>
        )}
      </form>

      <div style={{ marginTop: "1.25rem" }}>
        {photos.length === 0 ? (
          <p
            style={{
              border: "0.5px solid var(--pp-border)",
              borderRadius: "12px",
              color: "var(--pp-text-secondary)",
              fontFamily: SERIF,
              fontStyle: "italic",
              margin: 0,
              padding: "1rem",
            }}
          >
            {t("empty")}
          </p>
        ) : (
          groupedPhotos.map((group) => (
            <section key={group.key} style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  alignItems: "baseline",
                  marginBottom: "0.6rem",
                }}
              >
                <h2
                  style={{
                    fontFamily: SANS,
                    color: "var(--pp-text-secondary)",
                    fontSize: "11px",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    margin: 0,
                  }}
                >
                  {group.label}
                </h2>
                <p
                  style={{
                    fontFamily: SANS,
                    color: "var(--pp-text-tertiary)",
                    fontSize: "11px",
                    margin: 0,
                  }}
                >
                  {formatNumber(group.totals.calories)} kcal ·{" "}
                  {group.items.length} {t("meals")}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.items.map((photo) => {
                  const isEditing = editingId === photo.id;
                  return (
                    <article
                      key={photo.id}
                      className="pp-stat-card"
                      style={{
                        border: "0.5px solid var(--pp-border)",
                        borderRadius: "12px",
                        overflow: "hidden",
                        background: "var(--pp-surface)",
                      }}
                    >
                      {photo.signedUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.signedUrl}
                          alt={t("photo_alt", {
                            meal: t(`meal_${photo.meal_type}`),
                          })}
                          style={{
                            display: "block",
                            width: "100%",
                            aspectRatio: "4 / 3",
                            objectFit: "cover",
                            background: "rgba(0,0,0,0.2)",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            aspectRatio: "4 / 3",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background:
                              "radial-gradient(circle at 50% 20%, rgba(136, 211, 159, 0.16), transparent 38%), rgba(8,6,5,0.36)",
                          }}
                        >
                          <p
                            style={{
                              fontFamily: SANS,
                              color: "#88d39f",
                              fontSize: "11px",
                              letterSpacing: "0.18em",
                              textTransform: "uppercase",
                              margin: 0,
                            }}
                          >
                            {t("manual_badge")}
                          </p>
                        </div>
                      )}
                      <div style={{ padding: "0.85rem" }}>
                        {isEditing ? (
                          <div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <CustomSelect
                                value={editMealType}
                                onChange={(value) =>
                                  setEditMealType(value as MealType)
                                }
                                ariaLabel={t("meal_type")}
                                style={selectStyle}
                                options={MEAL_TYPES.map((item) => ({
                                  value: item,
                                  label: t(`meal_${item}`),
                                }))}
                              />
                              <input
                                type="datetime-local"
                                value={editEatenAt}
                                onChange={(e) => setEditEatenAt(e.target.value)}
                                aria-label={t("eaten_at")}
                                style={inputStyle}
                              />
                            </div>
                            <textarea
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              rows={3}
                              style={{ ...textareaStyle, marginTop: "0.7rem" }}
                            />
                            <div
                              className="grid gap-2 sm:grid-cols-4"
                              style={{ marginTop: "0.7rem" }}
                            >
                              {[
                                {
                                  value: editCalories,
                                  setValue: setEditCalories,
                                  label: t("calories"),
                                  step: "1",
                                },
                                {
                                  value: editProtein,
                                  setValue: setEditProtein,
                                  label: t("protein"),
                                  step: "0.1",
                                },
                                {
                                  value: editCarbs,
                                  setValue: setEditCarbs,
                                  label: t("carbs"),
                                  step: "0.1",
                                },
                                {
                                  value: editFat,
                                  setValue: setEditFat,
                                  label: t("fat"),
                                  step: "0.1",
                                },
                              ].map((field) => (
                                <label
                                  key={field.label}
                                  style={{
                                    display: "block",
                                    fontFamily: SANS,
                                  }}
                                >
                                  <span
                                    style={{
                                      display: "block",
                                      color: "var(--pp-text-tertiary)",
                                      fontSize: "9px",
                                      letterSpacing: "0.14em",
                                      marginBottom: "0.3rem",
                                      textTransform: "uppercase",
                                    }}
                                  >
                                    {field.label}
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    step={field.step}
                                    value={field.value}
                                    onChange={(e) =>
                                      field.setValue(e.target.value)
                                    }
                                    placeholder={field.label}
                                    aria-label={field.label}
                                    style={inputStyle}
                                  />
                                </label>
                              ))}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "0.8rem",
                                marginTop: "0.8rem",
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => onUpdate(photo)}
                                disabled={isPending}
                                style={{
                                  background: "#88d39f",
                                  border: "0.5px solid #88d39f",
                                  borderRadius: "999px",
                                  color: "var(--pp-bg)",
                                  fontFamily: SANS,
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  letterSpacing: "0.14em",
                                  textTransform: "uppercase",
                                  cursor: "pointer",
                                  padding: "0.65rem 0.9rem",
                                }}
                              >
                                {t("update")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                disabled={isPending}
                                style={{
                                  background: "transparent",
                                  border: "0.5px solid var(--pp-border)",
                                  borderRadius: "999px",
                                  color: "var(--pp-text-secondary)",
                                  fontFamily: SANS,
                                  fontSize: "11px",
                                  letterSpacing: "0.14em",
                                  textTransform: "uppercase",
                                  cursor: "pointer",
                                  padding: "0.65rem 0.9rem",
                                }}
                              >
                                {t("cancel")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p
                              style={{
                                fontFamily: SANS,
                                color: "#88d39f",
                                fontSize: "11px",
                                letterSpacing: "0.16em",
                                textTransform: "uppercase",
                                margin: 0,
                              }}
                            >
                              {t(`meal_${photo.meal_type}`)} ·{" "}
                              {new Intl.DateTimeFormat(locale, {
                                timeStyle: "short",
                              }).format(new Date(photo.eaten_at))}
                            </p>
                            {photo.description && (
                              <p
                                style={{
                                  fontFamily: SERIF,
                                  color: "var(--pp-text-secondary)",
                                  fontSize: "14px",
                                  margin: "0.55rem 0 0",
                                }}
                              >
                                {photo.description}
                              </p>
                            )}
                            {(photo.calories_estimate !== null ||
                              photo.protein_g !== null ||
                              photo.carbs_g !== null ||
                              photo.fat_g !== null) && (
                              <p
                                style={{
                                  fontFamily: SANS,
                                  color: "var(--pp-text-tertiary)",
                                  fontSize: "11px",
                                  lineHeight: 1.6,
                                  margin: "0.55rem 0 0",
                                }}
                              >
                                {photo.calories_estimate ?? "—"} kcal · P{" "}
                                {photo.protein_g ?? "—"} · C{" "}
                                {photo.carbs_g ?? "—"} · F {photo.fat_g ?? "—"}
                              </p>
                            )}
                            <div
                              style={{
                                display: "flex",
                                gap: "1rem",
                                flexWrap: "wrap",
                                marginTop: "0.75rem",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => startEditing(photo)}
                                disabled={isPending}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#d6a06f",
                                  fontFamily: SANS,
                                  fontSize: "11px",
                                  letterSpacing: "0.16em",
                                  textTransform: "uppercase",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                {t("edit")}
                              </button>
                              <button
                                type="button"
                                onClick={() => onRepeat(photo)}
                                disabled={isPending}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#88d39f",
                                  fontFamily: SANS,
                                  fontSize: "11px",
                                  letterSpacing: "0.16em",
                                  textTransform: "uppercase",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                {t("repeat")}
                              </button>
                              <button
                                type="button"
                                onClick={() => onDelete(photo)}
                                disabled={isPending}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "var(--pp-text-tertiary)",
                                  fontFamily: SANS,
                                  fontSize: "11px",
                                  letterSpacing: "0.16em",
                                  textTransform: "uppercase",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                {t("delete")}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
