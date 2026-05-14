import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { AdminReviewActions } from "@/components/AdminReviewActions";
import { isAdmin } from "@/lib/admin/auth";
import {
  getReviewsAdminClient,
  type ReviewRow,
} from "@/lib/reviews/admin-client";

export const dynamic = "force-dynamic";

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

const statusColors: Record<ReviewRow["status"], string> = {
  pending: "#d4a050",
  approved: "#7c9968",
  rejected: "#c0735c",
};

function StarRow({ rating }: { rating: number }) {
  return (
    <div
      aria-label={`${rating} / 5`}
      style={{ display: "flex", gap: "2px" }}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          aria-hidden="true"
          style={{
            fontSize: "16px",
            lineHeight: 1,
            color:
              n <= rating ? "var(--pp-accent)" : "var(--pp-text-tertiary)",
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default async function AdminReviewsPage({
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
  if (!isAdmin(user!.email)) {
    redirect({ href: "/dashboard", locale });
  }

  const t = await getTranslations("admin");
  const tApp = await getTranslations("app");
  const tAuth = await getTranslations("auth");

  const admin = getReviewsAdminClient();
  const { data } = await admin
    .from("user_reviews")
    .select(
      "id, user_id, display_name, rating, review_text, receipt_image_url, verified, status, locale, created_at",
    )
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as ReviewRow[];

  const dateFmt = new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const navLinkStyle: React.CSSProperties = {
    fontFamily: SANS,
    fontSize: "12px",
    letterSpacing: "0.24em",
    textTransform: "uppercase",
    color: "var(--pp-text-secondary)",
    textDecoration: "none",
  };

  const eyebrowStyle: React.CSSProperties = {
    fontFamily: SANS,
    fontSize: "11px",
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: "var(--pp-text-secondary)",
    fontWeight: 500,
    margin: 0,
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--pp-surface)",
    border: "0.5px solid var(--pp-border)",
    borderRadius: "6px",
    padding: "1.5rem",
  };

  const pillStyle = (color: string): React.CSSProperties => ({
    fontFamily: SANS,
    fontSize: "10px",
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    fontWeight: 600,
    color,
    border: `0.5px solid ${color}`,
    borderRadius: "4px",
    padding: "4px 8px",
  });

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
          <LocaleSwitcher />
          <SignOutButton label={tAuth("sign_out")} />
        </div>
      </header>

      <main
        className="flex-1 mx-auto w-full"
        style={{ maxWidth: "880px", padding: "2.5rem 2rem 5rem" }}
      >
        <h1
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "clamp(36px, 6vw, 48px)",
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            fontWeight: 400,
            color: "var(--pp-text)",
            margin: 0,
          }}
        >
          {t("reviews_title")}
        </h1>
        <p
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "17px",
            color: "var(--pp-text-secondary)",
            margin: "0.5rem 0 0",
          }}
        >
          {t("reviews_subtitle")}
        </p>

        <div style={{ marginTop: "2.5rem", display: "grid", gap: "1rem" }}>
          {rows.length === 0 ? (
            <div style={cardStyle}>
              <p
                style={{
                  fontFamily: SERIF,
                  fontStyle: "italic",
                  fontSize: "16px",
                  color: "var(--pp-text-secondary)",
                  margin: 0,
                }}
              >
                {t("reviews_empty")}
              </p>
            </div>
          ) : (
            rows.map((r) => {
              const statusColor = statusColors[r.status];
              const statusLabel = t(`reviews_status_${r.status}`);
              const verifiedColor = r.verified
                ? "var(--pp-accent)"
                : "var(--pp-text-tertiary)";
              const verifiedLabel = r.verified
                ? t("reviews_verified_yes")
                : t("reviews_verified_no");
              return (
                <div key={r.id} style={cardStyle}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                      alignItems: "center",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <span style={pillStyle(statusColor)}>{statusLabel}</span>
                    <span style={pillStyle(verifiedColor)}>
                      {verifiedLabel}
                    </span>
                    <span
                      style={{
                        fontFamily: SANS,
                        fontSize: "10px",
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        color: "var(--pp-text-tertiary)",
                        border: "0.5px solid var(--pp-border)",
                        borderRadius: "4px",
                        padding: "4px 8px",
                      }}
                    >
                      {r.locale}
                    </span>
                    <span style={{ ...eyebrowStyle, fontSize: "10px" }}>
                      {dateFmt.format(new Date(r.created_at))}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <StarRow rating={r.rating} />
                    <span
                      style={{
                        fontFamily: SERIF,
                        fontStyle: "italic",
                        fontSize: "16px",
                        color: "var(--pp-text)",
                      }}
                    >
                      {r.display_name}
                    </span>
                  </div>

                  <p
                    style={{
                      fontFamily: SERIF,
                      fontSize: "15px",
                      lineHeight: 1.6,
                      color: "var(--pp-text-secondary)",
                      margin: 0,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {r.review_text}
                  </p>

                  {r.receipt_image_url && (
                    <div style={{ marginTop: "0.875rem" }}>
                      <a
                        href={r.receipt_image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t("reviews_view_receipt")}
                        style={{ display: "inline-block" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.receipt_image_url}
                          alt={t("reviews_view_receipt")}
                          style={{
                            width: "120px",
                            height: "120px",
                            objectFit: "cover",
                            borderRadius: "4px",
                            border: "0.5px solid var(--pp-border)",
                            cursor: "pointer",
                          }}
                        />
                      </a>
                    </div>
                  )}

                  <AdminReviewActions
                    reviewId={r.id}
                    showApproveReject={r.status === "pending"}
                    labels={{
                      approve: t("action_approve"),
                      reject: t("action_reject"),
                      toggle_verified: t("reviews_action_toggle_verified"),
                      pending: t("action_pending"),
                      error: t("action_error"),
                    }}
                  />
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
