import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { AdminDraftActions } from "@/components/AdminDraftActions";
import { isAdmin } from "@/lib/admin/auth";
import {
  getDraftsAdminClient,
  type DraftRow,
} from "@/lib/admin/drafts-admin-client";

export const dynamic = "force-dynamic";

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

const statusColors: Record<DraftRow["status"], string> = {
  pending_review: "#d4a050",
  approved: "#7c9968",
  published: "var(--pp-accent)",
  rejected: "#c0735c",
};

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s;
}

export default async function AdminDraftsPage({
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
  if (!(await isAdmin(user!.email))) {
    redirect({ href: "/dashboard", locale });
  }

  const t = await getTranslations("admin");
  const tApp = await getTranslations("app");
  const tAuth = await getTranslations("auth");

  const admin = getDraftsAdminClient();
  const { data: drafts } = await admin
    .from("article_drafts")
    .select(
      "id, language, status, title, slug, summary, generated_at, reviewed_at, published_at, source_pubmed_id",
    )
    .order("generated_at", { ascending: false });
  const rows = (drafts ?? []) as DraftRow[];

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
          {t("title")}
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
          {t("subtitle")}
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
                {t("empty")}
              </p>
            </div>
          ) : (
            rows.map((d) => {
              const statusColor = statusColors[d.status];
              const statusLabel = t(`status_${d.status}`);
              return (
                <div key={d.id} style={cardStyle}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                      alignItems: "center",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: SANS,
                        fontSize: "10px",
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        fontWeight: 600,
                        color: statusColor,
                        border: `0.5px solid ${statusColor}`,
                        borderRadius: "4px",
                        padding: "4px 8px",
                      }}
                    >
                      {statusLabel}
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
                      {d.language}
                    </span>
                    <span style={{ ...eyebrowStyle, fontSize: "10px" }}>
                      {dateFmt.format(new Date(d.generated_at))}
                    </span>
                  </div>

                  <h2
                    style={{
                      fontFamily: SERIF,
                      fontStyle: "italic",
                      fontSize: "22px",
                      lineHeight: 1.25,
                      color: "var(--pp-text)",
                      margin: "0 0 0.5rem",
                    }}
                  >
                    {d.title}
                  </h2>
                  <p
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                      fontSize: "12px",
                      color: "var(--pp-text-tertiary)",
                      margin: "0 0 0.75rem",
                    }}
                  >
                    {d.slug}
                  </p>
                  <p
                    style={{
                      fontFamily: SERIF,
                      fontSize: "15px",
                      lineHeight: 1.6,
                      color: "var(--pp-text-secondary)",
                      margin: 0,
                    }}
                  >
                    {truncate(d.summary, 240)}
                  </p>

                  {d.status === "pending_review" && (
                    <AdminDraftActions
                      draftId={d.id}
                      labels={{
                        approve: t("action_approve"),
                        reject: t("action_reject"),
                        pending: t("action_pending"),
                        error: t("action_error"),
                      }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
