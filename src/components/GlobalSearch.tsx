"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type SearchResult = {
  category: "articles" | "coach" | "doses" | "weight" | "calendar" | "todos";
  id: string;
  title: string;
  preview: string | null;
  date: string | null;
  href: string;
};

type SearchResponse = {
  groups: Record<string, SearchResult[]>;
  total: number;
};

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

const CATEGORY_ORDER: SearchResult["category"][] = [
  "articles",
  "coach",
  "doses",
  "weight",
  "calendar",
  "todos",
];

function SearchIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function GlobalSearch({
  variant = "muted",
}: {
  variant?: "muted" | "accent";
}) {
  const t = useTranslations("search");
  const router = useRouter();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const closeOverlay = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults(null);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeOverlay();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeOverlay]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (trimmed.length === 0) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed, locale }),
          signal: controller.signal,
        });
        if (!res.ok) {
          setResults({ groups: {}, total: 0 });
          setLoading(false);
          return;
        }
        const data = (await res.json()) as SearchResponse;
        setResults(data);
        setLoading(false);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setResults({ groups: {}, total: 0 });
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, locale, open]);

  function onResultClick(href: string) {
    closeOverlay();
    router.push(href);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    if (!results) return;
    for (const cat of CATEGORY_ORDER) {
      const list = results.groups[cat] ?? [];
      if (list.length > 0) {
        e.preventDefault();
        onResultClick(list[0].href);
        return;
      }
    }
  }

  const iconColor =
    variant === "accent" ? "var(--pp-accent)" : "var(--pp-text-secondary)";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("open_label")}
        style={{
          background: "transparent",
          border: "none",
          padding: "4px",
          cursor: "pointer",
          color: iconColor,
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <SearchIcon color="var(--pp-accent)" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("dialog_label")}
          onClick={closeOverlay}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            paddingTop: "10vh",
            padding: "10vh 1rem 0",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--pp-surface)",
              border: "0.5px solid var(--pp-border)",
              borderRadius: "8px",
              width: "100%",
              maxWidth: "540px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
              overflow: "hidden",
              fontFamily: SERIF,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem 1rem",
                borderBottom: "0.5px solid var(--pp-border)",
              }}
            >
              <SearchIcon color="var(--pp-text-tertiary)" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder={t("placeholder")}
                style={{
                  flex: 1,
                  fontFamily: SERIF,
                  fontSize: "16px",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--pp-text)",
                }}
              />
              <button
                type="button"
                onClick={closeOverlay}
                aria-label={t("close_label")}
                style={{
                  fontFamily: SANS,
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  background: "transparent",
                  border: "0.5px solid var(--pp-border)",
                  color: "var(--pp-text-tertiary)",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                ESC
              </button>
            </div>

            <div
              style={{
                maxHeight: "60vh",
                overflowY: "auto",
              }}
            >
              {query.trim().length === 0 ? (
                <p
                  style={{
                    fontFamily: SERIF,
                    fontStyle: "italic",
                    fontSize: "14px",
                    color: "var(--pp-text-tertiary)",
                    padding: "1.25rem 1rem",
                    margin: 0,
                  }}
                >
                  {t("hint")}
                </p>
              ) : loading ? (
                <p
                  style={{
                    fontFamily: SERIF,
                    fontStyle: "italic",
                    fontSize: "14px",
                    color: "var(--pp-text-tertiary)",
                    padding: "1.25rem 1rem",
                    margin: 0,
                  }}
                >
                  {t("loading")}
                </p>
              ) : !results || results.total === 0 ? (
                <p
                  style={{
                    fontFamily: SERIF,
                    fontStyle: "italic",
                    fontSize: "14px",
                    color: "var(--pp-text-tertiary)",
                    padding: "1.25rem 1rem",
                    margin: 0,
                  }}
                >
                  {t("empty")}
                </p>
              ) : (
                <>
                  {CATEGORY_ORDER.map((cat) => {
                    const list = results.groups[cat] ?? [];
                    if (list.length === 0) return null;
                    return (
                      <div key={cat}>
                        <div
                          style={{
                            fontFamily: SANS,
                            fontSize: "10px",
                            letterSpacing: "0.22em",
                            textTransform: "uppercase",
                            color: "var(--pp-text-tertiary)",
                            padding: "0.75rem 1rem 0.25rem",
                          }}
                        >
                          {t(`category_${cat}`)}
                        </div>
                        {list.map((r) => (
                          <button
                            key={`${cat}-${r.id}`}
                            type="button"
                            onClick={() => onResultClick(r.href)}
                            style={{
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              background: "transparent",
                              border: "none",
                              borderTop: "0.5px solid var(--pp-border)",
                              padding: "0.75rem 1rem",
                              cursor: "pointer",
                              fontFamily: SERIF,
                              color: "var(--pp-text)",
                            }}
                            className="hover:bg-[var(--pp-bg)]"
                          >
                            <div
                              style={{
                                fontSize: "15px",
                                lineHeight: 1.3,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {r.title}
                            </div>
                            {(r.preview || r.date) && (
                              <div
                                style={{
                                  fontFamily: SANS,
                                  fontSize: "11px",
                                  color: "var(--pp-text-tertiary)",
                                  marginTop: "2px",
                                  display: "flex",
                                  gap: "0.5rem",
                                }}
                              >
                                {r.preview && (
                                  <span
                                    style={{
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      flex: 1,
                                      minWidth: 0,
                                    }}
                                  >
                                    {r.preview}
                                  </span>
                                )}
                                {r.date && <span>{r.date.slice(0, 10)}</span>}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
