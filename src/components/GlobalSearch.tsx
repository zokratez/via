"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

const AUTH_PATH_RE = /^\/(es|en)\/(dashboard|log|coach|calendar|admin)(\/.*)?$/;

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

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { length: number } & {
    [index: number]: SpeechRecognitionResultLike;
  };
};
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

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

function SearchIcon({
  color = "currentColor",
  size = 18,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
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

function MicIcon({
  color = "currentColor",
  size = 18,
  filled = false,
}: {
  color?: string;
  size?: number;
  filled?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : "none"}
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}

export function GlobalSearch() {
  const t = useTranslations("search");
  const router = useRouter();
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onScroll() {
      setScrolling(true);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        setScrolling(false);
      }, 200);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const SpeechRecognitionCtor = useMemo<SpeechRecognitionCtor | null>(() => {
    if (typeof window === "undefined") return null;
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
  }, []);

  const speechSupported = SpeechRecognitionCtor !== null;

  const closeOverlay = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults(null);
    if (abortRef.current) abortRef.current.abort();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
    }
    setListening(false);
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

  function startListening() {
    if (!SpeechRecognitionCtor) return;
    if (!open) setOpen(true);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = locale === "es" ? "es-MX" : "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (e) => {
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setQuery(transcript);
    };
    recognition.onerror = () => {
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  function stopListening() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    setListening(false);
  }

  function onPillClick() {
    setOpen(true);
  }

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

  if (AUTH_PATH_RE.test(pathname)) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 90,
          opacity: scrolling ? 0.3 : 1,
          transition: "opacity 0.2s ease-out",
        }}
      >
        <button
          type="button"
          onClick={onPillClick}
          aria-label={t("open_label")}
          style={{
            pointerEvents: "auto",
            width: "200px",
            height: "40px",
            background: "rgba(255,255,255,0.10)",
            WebkitBackdropFilter: "blur(12px) saturate(180%)",
            backdropFilter: "blur(12px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: "999px",
            padding: "0 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            cursor: "pointer",
            fontFamily: SANS,
            fontSize: "13px",
            color: "rgba(255,255,255,0.55)",
            boxShadow:
              "inset 0 1px 1px rgba(255,255,255,0.25), inset 0 -1px 1px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.25)",
          }}
        >
          <SearchIcon color="rgba(255,255,255,0.55)" size={13} />
          <span>{t("placeholder_short")}</span>
        </button>
      </div>

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
            WebkitBackdropFilter: "blur(8px)",
            backdropFilter: "blur(8px)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "center",
            padding:
              "max(8vh, env(safe-area-inset-top, 0px)) 1rem env(safe-area-inset-bottom, 0px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(26,22,20,0.85)",
              WebkitBackdropFilter: "blur(20px)",
              backdropFilter: "blur(20px)",
              border: "0.5px solid rgba(255,255,255,0.08)",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "540px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
              overflow: "hidden",
              fontFamily: SERIF,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.875rem 1rem",
                borderBottom: "0.5px solid rgba(255,255,255,0.06)",
              }}
            >
              <SearchIcon color="var(--pp-accent)" size={18} />
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
              {speechSupported && (
                <button
                  type="button"
                  onClick={() =>
                    listening ? stopListening() : startListening()
                  }
                  aria-label={t("mic_label")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    borderRadius: "9999px",
                    background: listening
                      ? "var(--pp-accent)"
                      : "transparent",
                    color: listening
                      ? "var(--pp-bg)"
                      : "var(--pp-text-secondary)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <MicIcon
                    color="currentColor"
                    size={18}
                    filled={listening}
                  />
                </button>
              )}
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
                  border: "0.5px solid rgba(255,255,255,0.12)",
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
                  {listening ? t("listening") : t("hint")}
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
                              borderTop:
                                "0.5px solid rgba(255,255,255,0.06)",
                              padding: "0.75rem 1rem",
                              cursor: "pointer",
                              fontFamily: SERIF,
                              color: "var(--pp-text)",
                            }}
                            className="hover:bg-[rgba(255,255,255,0.04)]"
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
