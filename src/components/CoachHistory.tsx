"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { inputStyle } from "@/lib/log-form-styles";

export type CoachMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type CoachThread = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  messages: CoachMessage[];
};

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

function questionPrefix(thread: CoachThread): string {
  const firstUser = thread.messages.find((m) => m.role === "user");
  if (!firstUser) return "";
  return firstUser.content.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 40);
}

function firstUserMessage(thread: CoachThread): string {
  const u = thread.messages.find((m) => m.role === "user");
  return u?.content ?? thread.title ?? "—";
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s;
}

function plainTextPreview(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1");
}

export function CoachHistory({
  threads,
  locale,
}: {
  threads: CoachThread[];
  locale: "es" | "en";
}) {
  const t = useTranslations("dashboard");

  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const intl = locale === "es" ? "es-MX" : "en-US";
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(intl, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [intl],
  );

  const prefixCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const th of threads) {
      const p = questionPrefix(th);
      if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return counts;
  }, [threads]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return threads;
    return threads.filter((th) =>
      th.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }, [threads, query]);

  function toggle(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (threads.length === 0) {
    return (
      <p
        style={{
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: "15px",
          color: "var(--pp-text-secondary)",
          margin: 0,
        }}
      >
        {t("coach_history_empty")}
      </p>
    );
  }

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("coach_history_search_placeholder")}
        aria-label={t("coach_history_search_placeholder")}
        style={{
          ...inputStyle,
          width: "100%",
          marginBottom: "1rem",
        }}
      />

      <div style={{ display: "grid", gap: "0.5rem" }}>
        {filtered.length === 0 ? (
          <p
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "14px",
              color: "var(--pp-text-tertiary)",
              margin: 0,
            }}
          >
            {t("coach_history_no_match")}
          </p>
        ) : (
          filtered.map((th) => {
            const isOpen = expandedIds.has(th.id);
            const firstQ = firstUserMessage(th);
            const userCount = th.messages.filter((m) => m.role === "user").length;
            const prefix = questionPrefix(th);
            const sameQuestion = prefix ? prefixCounts.get(prefix) ?? 0 : 0;
            return (
              <div
                key={th.id}
                style={{
                  background: "var(--pp-bg)",
                  border: "0.5px solid var(--pp-border)",
                  borderRadius: "6px",
                  padding: "0.875rem 1rem",
                }}
              >
                <button
                  type="button"
                  onClick={() => toggle(th.id)}
                  aria-expanded={isOpen}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    textAlign: "left",
                    cursor: "pointer",
                    width: "100%",
                    color: "inherit",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                      alignItems: "center",
                      marginBottom: "0.4rem",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: SANS,
                        fontSize: "10px",
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: "var(--pp-text-tertiary)",
                      }}
                    >
                      {dateFmt.format(new Date(th.updated_at))}
                    </span>
                    <span
                      style={{
                        fontFamily: SANS,
                        fontSize: "10px",
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: "var(--pp-text-tertiary)",
                      }}
                    >
                      · {th.messages.length} {t("coach_history_msg_count")}
                    </span>
                    {sameQuestion > 1 && (
                      <span
                        style={{
                          fontFamily: SANS,
                          fontSize: "10px",
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          color: "var(--pp-accent)",
                          border: "0.5px solid var(--pp-accent)",
                          borderRadius: "4px",
                          padding: "2px 6px",
                          fontWeight: 600,
                        }}
                      >
                        {t("coach_history_asked_n", { count: sameQuestion })}
                      </span>
                    )}
                    <span
                      aria-hidden="true"
                      style={{
                        marginLeft: "auto",
                        color: "var(--pp-text-tertiary)",
                        fontSize: "13px",
                      }}
                    >
                      {isOpen ? "▾" : "▸"}
                    </span>
                  </div>
                  <p
                    style={{
                      fontFamily: SERIF,
                      fontStyle: "italic",
                      fontSize: "16px",
                      color: "var(--pp-text)",
                      margin: 0,
                      lineHeight: 1.45,
                    }}
                  >
                    {truncate(firstQ, 140)}
                  </p>
                </button>

                {isOpen && (
                  <div
                    style={{
                      marginTop: "1rem",
                      paddingTop: "1rem",
                      borderTop: "0.5px solid var(--pp-border)",
                      maxHeight: "360px",
                      overflowY: "auto",
                      display: "grid",
                      gap: "0.875rem",
                    }}
                  >
                    {[...th.messages]
                      .sort((a, b) => a.created_at.localeCompare(b.created_at))
                      .map((m, i) => (
                        <div key={i}>
                          <p
                            style={{
                              fontFamily: SANS,
                              fontSize: "9px",
                              letterSpacing: "0.22em",
                              textTransform: "uppercase",
                              color:
                                m.role === "user"
                                  ? "var(--pp-text-tertiary)"
                                  : "var(--pp-accent)",
                              fontWeight: 600,
                              margin: "0 0 0.25rem",
                            }}
                          >
                            {m.role === "user"
                              ? t("coach_history_role_user")
                              : t("coach_history_role_assistant")}
                          </p>
                          <p
                            style={{
                              fontFamily: SERIF,
                              fontSize: "14px",
                              color:
                                m.role === "user"
                                  ? "var(--pp-text-secondary)"
                                  : "var(--pp-text)",
                              margin: 0,
                              lineHeight: 1.55,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {plainTextPreview(m.content)}
                          </p>
                        </div>
                      ))}
                  </div>
                )}

                <p style={{ margin: "0.5rem 0 0", fontFamily: SANS, fontSize: "10px", color: "var(--pp-text-tertiary)" }}>
                  {userCount} {t("coach_history_questions_asked")}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
