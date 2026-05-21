"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type FoodPhoto = {
  id: string;
  eaten_at: string;
  storage_path: string;
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

function optionalNumber(value: string): number | null {
  if (value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function FoodPhotosClient({
  initialPhotos,
}: {
  initialPhotos: FoodPhoto[];
}) {
  const t = useTranslations("food");
  const locale = useLocale();
  const [photos, setPhotos] = useState(initialPhotos);
  const [mealType, setMealType] = useState<MealType>("meal");
  const [eatenAt, setEatenAt] = useState(nowLocalDateTime());
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
    if (!file) {
      setMessage(t("error_file"));
      return;
    }
    if (!file.type.startsWith("image/")) {
      setMessage(t("error_image"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
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
      const storagePath = `${user.id}/${id}.${fileExtension(file)}`;
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
        await supabase.storage.from("food-photos").remove([storagePath]);
        setMessage(t("error_save"));
        return;
      }

      setFile(null);
      setDescription("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
      setMealType("meal");
      setEatenAt(nowLocalDateTime());
      setMessage(t("saved"));
      await refreshPhotos(user.id);
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
      await supabase.storage.from("food-photos").remove([photo.storage_path]);
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      setMessage(t("deleted"));
    });
  }

  const SANS = "var(--pp-font-sans)";
  const SERIF = "var(--pp-font-serif)";

  return (
    <div>
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
        <label
          style={{
            display: "block",
            fontFamily: SANS,
            fontSize: "11px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--pp-text-secondary)",
            marginBottom: "0.65rem",
          }}
        >
          {t("file")}
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{
            width: "100%",
            color: "var(--pp-text-secondary)",
            fontFamily: SANS,
            fontSize: "13px",
          }}
        />

        <div className="grid gap-3 sm:grid-cols-2" style={{ marginTop: "1rem" }}>
          <select
            value={mealType}
            onChange={(e) => setMealType(e.target.value as MealType)}
            aria-label={t("meal_type")}
            style={{
              width: "100%",
              background: "rgba(26, 22, 20, 0.82)",
              border: "0.5px solid var(--pp-border)",
              borderRadius: "8px",
              color: "var(--pp-text)",
              fontFamily: SANS,
              padding: "0.8rem",
            }}
          >
            {MEAL_TYPES.map((item) => (
              <option key={item} value={item}>
                {t(`meal_${item}`)}
              </option>
            ))}
          </select>

          <input
            type="datetime-local"
            value={eatenAt}
            onChange={(e) => setEatenAt(e.target.value)}
            aria-label={t("eaten_at")}
            style={{
              width: "100%",
              background: "rgba(26, 22, 20, 0.82)",
              border: "0.5px solid var(--pp-border)",
              borderRadius: "8px",
              color: "var(--pp-text)",
              fontFamily: SANS,
              padding: "0.8rem",
            }}
          />
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("description_placeholder")}
          rows={3}
          style={{
            width: "100%",
            marginTop: "1rem",
            background: "rgba(26, 22, 20, 0.82)",
            border: "0.5px solid var(--pp-border)",
            borderRadius: "8px",
            color: "var(--pp-text)",
            fontFamily: SERIF,
            fontSize: "15px",
            padding: "0.85rem",
            resize: "vertical",
          }}
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
            <input
              key={field.label}
              type="number"
              min="0"
              step={field.step}
              value={field.value}
              onChange={(e) => field.setValue(e.target.value)}
              placeholder={field.label}
              aria-label={field.label}
              style={{
                width: "100%",
                background: "rgba(26, 22, 20, 0.82)",
                border: "0.5px solid var(--pp-border)",
                borderRadius: "8px",
                color: "var(--pp-text)",
                fontFamily: SANS,
                padding: "0.8rem",
              }}
            />
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
          {t("manual_hint")}
        </p>

        <button
          type="submit"
          disabled={isPending}
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

      <div className="grid gap-3 sm:grid-cols-2" style={{ marginTop: "1rem" }}>
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
          photos.map((photo) => (
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
                  alt={t("photo_alt", { meal: t(`meal_${photo.meal_type}`) })}
                  style={{
                    display: "block",
                    width: "100%",
                    aspectRatio: "4 / 3",
                    objectFit: "cover",
                    background: "rgba(0,0,0,0.2)",
                  }}
                />
              ) : (
                <div style={{ aspectRatio: "4 / 3" }} />
              )}
              <div style={{ padding: "0.85rem" }}>
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
                    dateStyle: "medium",
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
                    {photo.protein_g ?? "—"} · C {photo.carbs_g ?? "—"} · F{" "}
                    {photo.fat_g ?? "—"}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(photo)}
                  disabled={isPending}
                  style={{
                    marginTop: "0.75rem",
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
            </article>
          ))
        )}
      </div>
    </div>
  );
}
