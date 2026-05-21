"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type ProgressPhoto = {
  id: string;
  captured_at: string;
  storage_path: string;
  angle: string;
  notes: string | null;
  signedUrl: string | null;
};

const ANGLES = ["front", "side", "back", "face", "other"] as const;
type Angle = (typeof ANGLES)[number];

function fileExtension(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function todayLocalDateTime(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ProgressPhotosClient({
  initialPhotos,
}: {
  initialPhotos: ProgressPhoto[];
}) {
  const t = useTranslations("progress");
  const locale = useLocale();
  const [photos, setPhotos] = useState(initialPhotos);
  const [angle, setAngle] = useState<Angle>("front");
  const [capturedAt, setCapturedAt] = useState(todayLocalDateTime());
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refreshPhotos(userId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("progress_photos")
      .select("id,captured_at,storage_path,angle,notes")
      .eq("user_id", userId)
      .order("captured_at", { ascending: false })
      .limit(24);

    const rows = (data ?? []) as Omit<ProgressPhoto, "signedUrl">[];
    const withUrls = await Promise.all(
      rows.map(async (photo) => {
        const { data: signed } = await supabase.storage
          .from("progress-photos")
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
        .from("progress-photos")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (upload.error) {
        setMessage(t("error_upload"));
        return;
      }

      const inserted = await supabase.from("progress_photos").insert({
        id,
        user_id: user.id,
        captured_at: new Date(capturedAt).toISOString(),
        storage_path: storagePath,
        angle,
        notes: notes.trim().length > 0 ? notes.trim() : null,
      });

      if (inserted.error) {
        await supabase.storage.from("progress-photos").remove([storagePath]);
        setMessage(t("error_save"));
        return;
      }

      setFile(null);
      setNotes("");
      setCapturedAt(todayLocalDateTime());
      setAngle("front");
      setMessage(t("saved"));
      await refreshPhotos(user.id);
    });
  }

  async function onDelete(photo: ProgressPhoto) {
    setMessage(null);
    startTransition(async () => {
      const supabase = createClient();
      const removed = await supabase
        .from("progress_photos")
        .delete()
        .eq("id", photo.id);
      if (removed.error) {
        setMessage(t("error_delete"));
        return;
      }
      await supabase.storage.from("progress-photos").remove([photo.storage_path]);
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
          border: "0.5px solid rgba(201, 150, 107, 0.28)",
          borderRadius: "14px",
          padding: "1rem",
          background:
            "linear-gradient(135deg, rgba(201, 150, 107, 0.12), rgba(34, 28, 25, 0.96))",
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
          <div>
            <label className="sr-only" htmlFor="progress-angle">
              {t("angle")}
            </label>
            <select
              id="progress-angle"
              value={angle}
              onChange={(e) => setAngle(e.target.value as Angle)}
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
              {ANGLES.map((item) => (
                <option key={item} value={item}>
                  {t(`angle_${item}`)}
                </option>
              ))}
            </select>
          </div>

          <input
            type="datetime-local"
            value={capturedAt}
            onChange={(e) => setCapturedAt(e.target.value)}
            aria-label={t("captured_at")}
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
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("notes_placeholder")}
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

        <button
          type="submit"
          disabled={isPending}
          className="pp-action-card"
          style={{
            width: "100%",
            marginTop: "1rem",
            border: "0.5px solid var(--pp-accent)",
            borderRadius: "999px",
            background: "var(--pp-accent)",
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
              color: "var(--pp-accent)",
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
                  alt={t("photo_alt", { angle: t(`angle_${photo.angle}`) })}
                  style={{
                    display: "block",
                    width: "100%",
                    aspectRatio: "3 / 4",
                    objectFit: "cover",
                    background: "rgba(0,0,0,0.2)",
                  }}
                />
              ) : (
                <div style={{ aspectRatio: "3 / 4" }} />
              )}
              <div style={{ padding: "0.85rem" }}>
                <p
                  style={{
                    fontFamily: SANS,
                    color: "var(--pp-accent)",
                    fontSize: "11px",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    margin: 0,
                  }}
                >
                  {t(`angle_${photo.angle}`)} ·{" "}
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                  }).format(new Date(photo.captured_at))}
                </p>
                {photo.notes && (
                  <p
                    style={{
                      fontFamily: SERIF,
                      color: "var(--pp-text-secondary)",
                      fontSize: "14px",
                      margin: "0.55rem 0 0",
                    }}
                  >
                    {photo.notes}
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
