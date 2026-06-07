"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { inputStyle } from "@/lib/log-form-styles";
import { track } from "@/lib/analytics/client";

const CHARS_PER_FRAME = 30;
const JSPDF_CDN =
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js";

type JsPDFInstance = {
  internal: {
    pageSize: { getWidth: () => number; getHeight: () => number };
  };
  setFillColor: (r: number, g: number, b: number) => void;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  setTextColor: (r: number, g: number, b: number) => void;
  setFont: (name: string, style?: string) => void;
  setFontSize: (s: number) => void;
  text: (
    t: string | string[],
    x: number,
    y: number,
    opts?: { align?: string },
  ) => void;
  splitTextToSize: (t: string, maxW: number) => string[];
  addPage: () => void;
  save: (filename: string) => void;
};
type JsPDFCtor = new (opts?: { unit?: string; format?: string }) => JsPDFInstance;

async function loadJsPdf(): Promise<JsPDFCtor> {
  const w = window as unknown as { jspdf?: { jsPDF: JsPDFCtor } };
  if (w.jspdf?.jsPDF) return w.jspdf.jsPDF;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      "script[data-jspdf]",
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("jspdf load failed")),
        { once: true },
      );
      return;
    }
    const s = document.createElement("script");
    s.src = JSPDF_CDN;
    s.async = true;
    s.dataset.jspdf = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("jspdf load failed"));
    document.head.appendChild(s);
  });
  const after = window as unknown as { jspdf?: { jsPDF: JsPDFCtor } };
  if (!after.jspdf?.jsPDF) throw new Error("jspdf global missing");
  return after.jspdf.jsPDF;
}

function plainTextForPdf(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1");
}

type Locale = "es" | "en";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ServerEvent =
  | { type: "meta"; threadId: string; guardrail?: string }
  | { type: "text"; content: string }
  | { type: "error"; key: "rate_limit" | "generic" }
  | { type: "done" };

type ErrorKey = "rate_limit" | "generic";

type Props = {
  locale: Locale;
  initialQuotaRemaining: number;
  isPro: boolean;
  initialThreadId?: string | null;
  initialMessages?: Message[];
};

export function CoachChat({
  locale,
  initialQuotaRemaining,
  isPro,
  initialThreadId = null,
  initialMessages = [],
}: Props) {
  const t = useTranslations("coach");
  const tPaywall = useTranslations("paywall");
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const [quotaRemaining, setQuotaRemaining] = useState<number>(
    isPro ? Number.POSITIVE_INFINITY : initialQuotaRemaining,
  );
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fullTextRef = useRef<string>("");
  const bufferRef = useRef<string>("");
  const streamDoneRef = useRef<boolean>(false);
  const wasGuardrailRef = useRef<boolean>(false);
  const isStuckToBottomRef = useRef<boolean>(true);
  const paywallViewedRef = useRef<boolean>(false);

  function onScrollContainer() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
    isStuckToBottomRef.current = distanceFromBottom < 50;
  }

  useEffect(() => {
    if (!isStuckToBottomRef.current) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "auto",
    });
  }, [messages, streamingText, isStreaming]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  const quotaExhausted = !isPro && quotaRemaining <= 0;
  const canSend = !quotaExhausted && input.trim().length > 0;

  useEffect(() => {
    if (!quotaExhausted || paywallViewedRef.current) return;
    paywallViewedRef.current = true;
    track("paywall_viewed", {
      locale,
      props: { surface: "coach_quota", plan: "annual" },
    });
  }, [locale, quotaExhausted]);

  function abortAndCleanup() {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    abortControllerRef.current?.abort();
    bufferRef.current = "";
    streamDoneRef.current = false;
  }

  function stop() {
    if (!isStreaming) return;
    const partial = fullTextRef.current;
    abortAndCleanup();
    if (partial.length > 0) {
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: partial,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }
    fullTextRef.current = "";
    setStreamingText("");
    if (!isPro && !wasGuardrailRef.current && !errorKey) {
      setQuotaRemaining((q) => Math.max(0, q - 1));
    }
    setIsStreaming(false);
  }

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || quotaExhausted) return;

    let baseMessages = messages;

    if (isStreaming) {
      const partial = fullTextRef.current;
      abortAndCleanup();
      if (partial.length > 0) {
        const partialMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: partial,
        };
        baseMessages = [...messages, partialMsg];
      }
      if (!isPro && !wasGuardrailRef.current && !errorKey) {
        setQuotaRemaining((q) => Math.max(0, q - 1));
      }
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const history = [...baseMessages, userMsg];
    isStuckToBottomRef.current = true;
    setMessages(history);
    setInput("");
    setIsStreaming(true);
    setStreamingText("");
    setErrorKey(null);

    fullTextRef.current = "";
    bufferRef.current = "";
    streamDoneRef.current = false;
    wasGuardrailRef.current = false;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    function drain() {
      rafIdRef.current = null;
      if (bufferRef.current.length > 0) {
        const take = bufferRef.current.slice(0, CHARS_PER_FRAME);
        bufferRef.current = bufferRef.current.slice(CHARS_PER_FRAME);
        setStreamingText((prev) => prev + take);
      }
      if (bufferRef.current.length > 0) {
        rafIdRef.current = requestAnimationFrame(drain);
        return;
      }
      if (streamDoneRef.current && abortControllerRef.current === controller) {
        if (fullTextRef.current.length > 0) {
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: fullTextRef.current,
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }
        setStreamingText("");
        if (!isPro && !wasGuardrailRef.current && !errorKey) {
          setQuotaRemaining((q) => Math.max(0, q - 1));
        }
        setIsStreaming(false);
      }
    }

    function kick() {
      if (rafIdRef.current === null && bufferRef.current.length > 0) {
        rafIdRef.current = requestAnimationFrame(drain);
      }
    }

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          threadId,
          locale,
        }),
      });

      if (abortControllerRef.current !== controller) return;

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (abortControllerRef.current !== controller) return;
        if (res.status === 429 && data.error === "quota_exhausted") {
          setQuotaRemaining(0);
        } else if (res.status === 429) {
          setErrorKey("rate_limit");
        } else {
          setErrorKey("generic");
        }
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        if (abortControllerRef.current !== controller) return;
        setErrorKey("generic");
        setIsStreaming(false);
        return;
      }
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buf.indexOf("\n\n")) !== -1) {
          const raw = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          if (!raw.startsWith("data: ")) continue;
          const json = raw.slice(6);
          let evt: ServerEvent;
          try {
            evt = JSON.parse(json) as ServerEvent;
          } catch {
            continue;
          }
          if (evt.type === "meta") {
            setThreadId(evt.threadId);
            if (evt.guardrail) wasGuardrailRef.current = true;
          } else if (evt.type === "text") {
            fullTextRef.current += evt.content;
            bufferRef.current += evt.content;
            kick();
          } else if (evt.type === "error") {
            setErrorKey(evt.key);
          } else if (evt.type === "done") {
            // handled after loop
          }
        }
      }

      if (abortControllerRef.current !== controller) return;
      streamDoneRef.current = true;
      if (rafIdRef.current === null) {
        drain();
      }
    } catch (err) {
      if (abortControllerRef.current !== controller) return;
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setErrorKey("generic");
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setIsStreaming(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) void send();
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth/sign-in");
    router.refresh();
  }

  async function downloadPdf() {
    if (downloadingPdf || messages.length === 0) return;
    setDownloadingPdf(true);
    try {
      const JsPDF = await loadJsPdf();
      const doc = new JsPDF({ unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 18;
      const contentW = pageW - margin * 2;
      const lineHeight = 5.4;

      doc.setFillColor(196, 162, 101);
      doc.rect(0, 0, pageW, 14, "F");
      doc.setTextColor(28, 24, 18);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("PACO PEPTIDE", margin, 9);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const dateLabel = new Date().toLocaleDateString(
        locale === "es" ? "es-MX" : "en-US",
        { year: "numeric", month: "long", day: "numeric" },
      );
      doc.text(dateLabel, pageW - margin, 9, { align: "right" });

      let y = 14 + 12;
      function ensureSpace(needed: number) {
        if (y + needed > pageH - margin) {
          doc.addPage();
          y = margin;
        }
      }

      const youLabel = locale === "es" ? "TÚ" : "YOU";
      const bukowskiLabel = "BUKOWSKI";

      for (const m of messages) {
        const label = m.role === "user" ? youLabel : bukowskiLabel;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(196, 162, 101);
        ensureSpace(lineHeight);
        doc.text(label, margin, y);
        y += lineHeight;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40);
        const lines = doc.splitTextToSize(plainTextForPdf(m.content), contentW);
        for (const ln of lines) {
          ensureSpace(lineHeight);
          doc.text(ln, margin, y);
          y += lineHeight;
        }
        y += 5;
      }

      const dateSlug = new Date().toISOString().slice(0, 10);
      doc.save(`paco-coach-${dateSlug}.pdf`);
    } catch (err) {
      console.error("[coach pdf]", err);
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function startUpgrade() {
    if (isUpgrading) return;
    setIsUpgrading(true);
    setUpgradeError(false);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, plan: "annual" }),
      });
      if (!res.ok) {
        setUpgradeError(true);
        setIsUpgrading(false);
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) {
        setUpgradeError(true);
        setIsUpgrading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setUpgradeError(true);
      setIsUpgrading(false);
    }
  }

  const quotaText = (() => {
    if (isPro || quotaExhausted) return null;
    if (quotaRemaining === 1) return t("quota_remaining_one");
    return t("quota_remaining_other", { count: quotaRemaining });
  })();

  const errorText =
    errorKey === "rate_limit"
      ? t("error_rate_limit")
      : errorKey === "generic"
        ? t("error_generic")
        : null;

  const showEmptyState = messages.length === 0 && !isStreaming;

  const topbarLinkStyle: React.CSSProperties = {
    fontFamily: "var(--pp-font-sans)",
    fontSize: "11px",
    letterSpacing: "0.22em",
  };

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ backgroundColor: "var(--pp-bg)", color: "var(--pp-text)" }}
    >
      {/* Topbar */}
      <div className="mx-auto w-full max-w-[660px] px-6 pt-6">
        <div
          className="flex items-center justify-between uppercase"
          style={{ ...topbarLinkStyle, color: "var(--pp-text-tertiary)" }}
        >
          <span>{t("topbar_brand")}</span>
          <span className="flex items-center gap-2">
            {isPro && messages.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => void downloadPdf()}
                  disabled={downloadingPdf}
                  title={t("download_tooltip")}
                  aria-label={t("download_tooltip")}
                  className="inline-flex items-center hover:text-[var(--pp-text-secondary)] transition-colors disabled:opacity-50"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M8 2v8" />
                    <path d="M4.5 6.5L8 10l3.5-3.5" />
                    <path d="M2.5 12.5v1A1.5 1.5 0 0 0 4 15h8a1.5 1.5 0 0 0 1.5-1.5v-1" />
                  </svg>
                </button>
                <span aria-hidden="true">·</span>
              </>
            )}
            <Link
              href="/dashboard"
              className="hover:text-[var(--pp-text-secondary)] transition-colors"
            >
              {t("topbar_panel")}
            </Link>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="uppercase hover:text-[var(--pp-text-secondary)] transition-colors"
              style={topbarLinkStyle}
            >
              {t("topbar_signout")}
            </button>
          </span>
        </div>
      </div>

      {/* Masthead */}
      <div className="mx-auto w-full max-w-[660px] px-6 mt-12">
        <h1
          className="italic font-normal"
          style={{
            fontFamily: "var(--pp-font-serif)",
            fontSize: showEmptyState ? "48px" : "32px",
            color: "var(--pp-text)",
            lineHeight: 1.1,
          }}
        >
          {t("page_title")}
        </h1>
        <p
          className="italic mt-1"
          style={{
            fontFamily: "var(--pp-font-serif)",
            fontSize: "15px",
            color: "var(--pp-text-secondary)",
          }}
        >
          {t("page_subtitle")}
        </p>
      </div>

      <div
        className="mx-auto w-full max-w-[660px] px-6 mt-8 mb-12"
        aria-hidden="true"
      >
        <div style={{ borderTop: "0.5px solid var(--pp-border)" }} />
      </div>

      {/* Scroll messages container */}
      <div
        ref={scrollRef}
        onScroll={onScrollContainer}
        className="flex-1 overflow-y-auto pp-scroll"
      >
        <div className="mx-auto w-full max-w-[660px] px-6">
          {messages.map((m) => (
            <MessageBubble key={m.id} role={m.role} content={m.content} />
          ))}

          {isStreaming && streamingText.length > 0 && (
            <MessageBubble role="assistant" content={streamingText} />
          )}

          {isStreaming && streamingText.length === 0 && (
            <p
              className="italic"
              style={{
                fontFamily: "var(--pp-font-serif)",
                fontSize: "15px",
                color: "var(--pp-text-secondary)",
                marginBottom: "1.75rem",
              }}
            >
              {t("thinking")}
            </p>
          )}

          {errorText && (
            <p
              style={{
                fontFamily: "var(--pp-font-sans)",
                fontSize: "13px",
                color: "var(--pp-accent)",
                marginBottom: "1.75rem",
              }}
            >
              {errorText}
            </p>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="mx-auto w-full max-w-[660px] px-6">
        <div
          className="pt-5 mt-8 pb-6"
          style={{ borderTop: "0.5px solid var(--pp-border)" }}
        >
          {quotaExhausted ? (
            <Card
              className="border"
              style={{
                backgroundColor: "var(--pp-surface)",
                borderColor: "var(--pp-border)",
              }}
            >
              <CardContent className="py-5">
                <h3
                  className="italic"
                  style={{
                    fontFamily: "var(--pp-font-serif)",
                    fontSize: "20px",
                    color: "var(--pp-text)",
                  }}
                >
                  {t("quota_exhausted_title")}
                </h3>
                <p
                  className="mt-2"
                  style={{
                    fontFamily: "var(--pp-font-serif)",
                    fontSize: "15px",
                    color: "var(--pp-text-secondary)",
                    lineHeight: 1.6,
                  }}
                >
                  {t("quota_exhausted_body")}
                </p>
                <div className="mt-4">
                  <Button
                    size="sm"
                    onClick={startUpgrade}
                    disabled={isUpgrading}
                  >
                    {isUpgrading
                      ? tPaywall("upgrading")
                      : tPaywall("upgrade_button")}
                  </Button>
                </div>
                {upgradeError && (
                  <p
                    className="mt-2"
                    style={{
                      fontFamily: "var(--pp-font-sans)",
                      fontSize: "13px",
                      color: "var(--pp-accent)",
                    }}
                  >
                    {tPaywall("checkout_error")}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (canSend) void send();
              }}
              className="flex items-center gap-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t("input_placeholder")}
                aria-label={t("input_placeholder")}
                className="flex-1 min-w-0 outline-none placeholder:italic placeholder:text-[var(--pp-text-secondary)] focus:border-[var(--pp-accent)] transition-colors"
                style={{
                  ...inputStyle,
                  fontFamily: "var(--pp-font-serif)",
                  fontSize: "18px",
                }}
              />
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stop}
                  className="uppercase shrink-0 transition-opacity hover:opacity-80"
                  style={{
                    fontFamily: "var(--pp-font-sans)",
                    fontSize: "11px",
                    letterSpacing: "0.22em",
                    color: "var(--pp-accent)",
                  }}
                >
                  {t("stop")}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canSend}
                  className="uppercase shrink-0 transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    fontFamily: "var(--pp-font-sans)",
                    fontSize: "11px",
                    letterSpacing: "0.22em",
                    color: "var(--pp-accent)",
                  }}
                >
                  {t("send")}
                </button>
              )}
            </form>
          )}

          {quotaText && (
            <p
              className="italic mt-3 text-left"
              style={{
                fontFamily: "var(--pp-font-serif)",
                fontSize: "12px",
                color: "var(--pp-text-tertiary)",
                lineHeight: 1.6,
              }}
            >
              {quotaText}
            </p>
          )}

          <p
            className="italic mt-3 text-left"
            style={{
              fontFamily: "var(--pp-font-serif)",
              fontSize: "13px",
              color: "var(--pp-text-tertiary)",
              lineHeight: 1.6,
            }}
          >
            {t("disclaimer")}
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end mb-8">
        <div
          className="rounded-[20px]"
          style={{
            backgroundColor: "var(--pp-user-bubble-bg)",
            color: "var(--pp-user-bubble-text)",
            fontFamily: "var(--pp-font-sans)",
            fontSize: "14px",
            lineHeight: 1.5,
            padding: "11px 18px",
            maxWidth: "75%",
          }}
        >
          <p className="whitespace-pre-wrap break-words">{content}</p>
        </div>
      </div>
    );
  }

  // Assistant: editorial prose, no bubble. Pilcrow on first paragraph only.
  let pCount = 0;
  return (
    <div
      className="mb-10"
      style={{
        fontFamily: "var(--pp-font-serif)",
        fontSize: "19px",
        lineHeight: 1.75,
        color: "#e8ddc8",
      }}
    >
      <ReactMarkdown
        components={{
          p: ({ children, ...rest }) => {
            pCount += 1;
            const isFirst = pCount === 1;
            return (
              <p className="break-words mb-7 last:mb-0" {...rest}>
                {isFirst && (
                  <span
                    aria-hidden="true"
                    style={{
                      fontSize: "28px",
                      color: "var(--pp-accent)",
                      fontStyle: "italic",
                      verticalAlign: "-6px",
                      marginRight: "8px",
                    }}
                  >
                    ¶
                  </span>
                )}
                {children}
              </p>
            );
          },
          h1: (props) => (
            <h1
              className="font-semibold mt-8 mb-3 first:mt-0"
              style={{
                fontFamily: "var(--pp-font-serif)",
                fontSize: "26px",
                color: "var(--pp-text)",
                lineHeight: 1.25,
              }}
              {...props}
            />
          ),
          h2: (props) => (
            <h2
              className="font-semibold mt-8 mb-3 first:mt-0"
              style={{
                fontFamily: "var(--pp-font-serif)",
                fontSize: "22px",
                color: "var(--pp-text)",
                lineHeight: 1.3,
              }}
              {...props}
            />
          ),
          h3: (props) => (
            <h3
              className="font-semibold mt-6 mb-2 first:mt-0"
              style={{
                fontFamily: "var(--pp-font-serif)",
                fontSize: "19px",
                color: "var(--pp-text)",
              }}
              {...props}
            />
          ),
          ul: (props) => (
            <ul className="list-disc pl-6 mb-7 last:mb-0" {...props} />
          ),
          ol: (props) => (
            <ol className="list-decimal pl-6 mb-7 last:mb-0" {...props} />
          ),
          li: (props) => (
            <li className="break-words mb-2 last:mb-0" {...props} />
          ),
          strong: (props) => (
            <strong
              className="font-semibold"
              style={{ color: "var(--pp-text)" }}
              {...props}
            />
          ),
          em: (props) => <em className="italic" {...props} />,
          code: (props) => (
            <code
              className="rounded px-1 py-0.5"
              style={{
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                fontSize: "0.9em",
                backgroundColor: "var(--pp-surface)",
                color: "var(--pp-text)",
              }}
              {...props}
            />
          ),
          pre: (props) => (
            <pre
              data-swipe-nav-ignore="true"
              className="overflow-x-auto rounded p-3 mb-7 last:mb-0"
              style={{
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                fontSize: "14px",
                backgroundColor: "var(--pp-surface)",
                color: "var(--pp-text)",
                lineHeight: 1.6,
              }}
              {...props}
            />
          ),
          a: (props) => (
            <a
              className="underline underline-offset-2"
              style={{ color: "var(--pp-accent)" }}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
