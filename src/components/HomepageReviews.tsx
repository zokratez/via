import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  getReviewsAdminClient,
  type ReviewRow,
} from "@/lib/reviews/admin-client";

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

const eyebrowStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "13px",
  letterSpacing: "0.24em",
  textTransform: "uppercase",
  color: "var(--pp-text-secondary)",
  fontWeight: 500,
};

const cardStyle: React.CSSProperties = {
  background: "var(--pp-surface)",
  border: "0.5px solid var(--pp-border)",
  borderRadius: "8px",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const verifiedBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  fontFamily: SANS,
  fontSize: "10px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  fontWeight: 600,
  color: "var(--pp-accent)",
  border: "0.5px solid var(--pp-accent)",
  borderRadius: "4px",
  padding: "3px 8px",
  alignSelf: "flex-start",
};

function StarRow({ rating }: { rating: number }) {
  return (
    <div
      aria-label={`${rating} / 5`}
      style={{ display: "flex", gap: "2px", color: "var(--pp-accent)" }}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          aria-hidden="true"
          style={{
            fontSize: "16px",
            lineHeight: 1,
            color: n <= rating ? "var(--pp-accent)" : "var(--pp-text-tertiary)",
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export async function HomepageReviews({ locale }: { locale: "es" | "en" }) {
  const t = await getTranslations({ locale, namespace: "home" });

  let reviews: ReviewRow[] = [];
  try {
    const admin = getReviewsAdminClient();
    const { data } = await admin
      .from("user_reviews")
      .select(
        "id, user_id, display_name, rating, review_text, receipt_image_url, verified, status, locale, created_at",
      )
      .eq("status", "approved")
      .eq("verified", true)
      .eq("locale", locale)
      .order("created_at", { ascending: false })
      .limit(6);
    reviews = (data ?? []) as ReviewRow[];
  } catch (err) {
    console.error("[HomepageReviews]", err);
    return null;
  }

  if (reviews.length === 0) return null;

  return (
    <section
      style={{
        maxWidth: "720px",
        margin: "0 auto",
        padding: "0 2rem",
      }}
    >
      <p style={{ ...eyebrowStyle, marginBottom: "1.5rem" }}>
        {t("reviews_section_eyebrow")}
      </p>
      <h2
        style={{
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: "clamp(28px, 5vw, 36px)",
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
          fontWeight: 400,
          color: "var(--pp-text)",
          margin: "0 0 2rem",
        }}
      >
        {t("reviews_section_title")}
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1rem",
        }}
      >
        {reviews.map((r) => (
          <div key={r.id} style={cardStyle}>
            <StarRow rating={r.rating} />
            <p
              style={{
                fontFamily: SERIF,
                fontSize: "15px",
                lineHeight: 1.65,
                color: "#e8ddc8",
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {r.review_text}
            </p>
            <p
              style={{
                fontFamily: SERIF,
                fontStyle: "italic",
                fontSize: "14px",
                color: "var(--pp-text-secondary)",
                margin: 0,
              }}
            >
              — {r.display_name}
            </p>
            {r.verified && (
              <span style={verifiedBadgeStyle}>
                {t("reviews_verified_badge")}
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: "2rem", textAlign: "center" }}>
        <Link
          href="/reviews/submit"
          style={{
            fontFamily: SANS,
            fontSize: "12px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--pp-accent)",
            textDecoration: "none",
          }}
          className="hover:opacity-80 transition-opacity"
        >
          {t("reviews_submit_cta")}
        </Link>
      </div>
    </section>
  );
}
