"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

const CHARS_PER_FRAME = 30;

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
};

export function CoachChat({
  locale,
  initialQuotaRemaining,
  isPro,
}: Props) {
  const t = useTranslations("coach");
  const tPaywall = useTranslations("paywall");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState<number>(
    isPro ? Number.POSITIVE_INFINITY : initialQuotaRemaining,
  );
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fullTextRef = useRef<string>("");
  const bufferRef = useRef<string>("");
  const streamDoneRef = useRef<boolean>(false);
  const wasGuardrailRef = useRef<boolean>(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
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

  async function startUpgrade() {
    if (isUpgrading) return;
    setIsUpgrading(true);
    setUpgradeError(false);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="flex items-center justify-between border-b border-border/60 px-6 py-4 md:px-10">
        <div className="flex flex-col">
          <h1 className="text-base font-semibold tracking-tight">
            {t("page_title")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("page_subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {quotaText && (
            <span className="text-xs text-muted-foreground">{quotaText}</span>
          )}
          <Link
            href="/dashboard"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t("back_to_dashboard")}
          </Link>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-8 md:px-10"
      >
        <div className="mx-auto w-full max-w-2xl space-y-4">
          {showEmptyState && (
            <Card className="border-border/60">
              <CardContent className="py-8">
                <h2 className="text-lg font-medium">
                  {t("empty_state_title")}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("empty_state_body")}
                </p>
              </CardContent>
            </Card>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} role={m.role} content={m.content} />
          ))}

          {isStreaming && streamingText.length > 0 && (
            <MessageBubble role="assistant" content={streamingText} />
          )}

          {isStreaming && streamingText.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("thinking")}</p>
          )}

          {errorText && (
            <p className="text-sm text-destructive">{errorText}</p>
          )}
        </div>
      </div>

      <div className="border-t border-border/60 px-6 py-4 md:px-10">
        <div className="mx-auto w-full max-w-2xl">
          {quotaExhausted ? (
            <Card className="border-border/60">
              <CardContent className="py-5">
                <h3 className="text-sm font-semibold">
                  {t("quota_exhausted_title")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("quota_exhausted_body")}
                </p>
                <div className="mt-3">
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
                  <p className="mt-2 text-sm text-destructive">
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
              className="flex items-center gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t("input_placeholder")}
                aria-label={t("input_placeholder")}
                className="h-10"
              />
              {isStreaming ? (
                <Button
                  type="button"
                  onClick={stop}
                  size="lg"
                  variant="outline"
                >
                  {t("stop")}
                </Button>
              ) : (
                <Button type="submit" disabled={!canSend} size="lg">
                  {t("send")}
                </Button>
              )}
            </form>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
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
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground"
            : "max-w-[80%] rounded-2xl border border-border/60 bg-accent/40 px-4 py-3 text-sm"
        }
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        ) : (
          <ReactMarkdown
            components={{
              p: (props) => (
                <p className="mb-2 break-words last:mb-0" {...props} />
              ),
              h1: (props) => (
                <h1
                  className="mt-3 mb-2 text-base font-semibold first:mt-0"
                  {...props}
                />
              ),
              h2: (props) => (
                <h2
                  className="mt-3 mb-2 text-sm font-semibold first:mt-0"
                  {...props}
                />
              ),
              h3: (props) => (
                <h3
                  className="mt-2 mb-1 text-sm font-semibold first:mt-0"
                  {...props}
                />
              ),
              ul: (props) => (
                <ul
                  className="mb-2 list-disc space-y-1 pl-5 last:mb-0"
                  {...props}
                />
              ),
              ol: (props) => (
                <ol
                  className="mb-2 list-decimal space-y-1 pl-5 last:mb-0"
                  {...props}
                />
              ),
              li: (props) => <li className="break-words" {...props} />,
              strong: (props) => (
                <strong className="font-semibold" {...props} />
              ),
              em: (props) => <em className="italic" {...props} />,
              code: (props) => (
                <code
                  className="rounded bg-muted px-1 py-0.5 font-mono text-xs"
                  {...props}
                />
              ),
              pre: (props) => (
                <pre
                  className="mb-2 overflow-x-auto rounded bg-muted p-2 font-mono text-xs last:mb-0"
                  {...props}
                />
              ),
              a: (props) => (
                <a
                  className="underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                  {...props}
                />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
