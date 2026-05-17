import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { CoachChat } from "@/components/CoachChat";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { isActiveSubscriber } from "@/lib/subscription";
import { enforceActiveSubscription } from "@/lib/subscription-guard";

const FREE_TIER_DAILY_LIMIT = 3;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type InitialMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function todayInMexicoCity(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export default async function CoachPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ upgraded?: string; thread?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    redirect({ href: "/", locale: routing.defaultLocale });
  }
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: "/auth/sign-in", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user!.id)
    .maybeSingle();
  const tier = profile?.subscription_tier ?? "free";

  // Paywall gate. ?upgraded=true is the one-shot bypass for the race
  // window between Stripe success redirect and webhook delivery.
  const sp = await searchParams;
  await enforceActiveSubscription({
    tier,
    locale: locale as "es" | "en",
    upgradedBypass: sp.upgraded === "true",
  });

  const isPro = isActiveSubscriber(tier);
  const requestedThreadId =
    typeof sp.thread === "string" && UUID_RE.test(sp.thread)
      ? sp.thread
      : null;

  let initialQuotaRemaining = FREE_TIER_DAILY_LIMIT;
  if (!isPro) {
    const today = todayInMexicoCity();
    const { data: counter } = await supabase
      .from("usage_counters")
      .select("coach_queries")
      .eq("user_id", user!.id)
      .eq("day", today)
      .maybeSingle();
    const used = counter?.coach_queries ?? 0;
    initialQuotaRemaining = Math.max(0, FREE_TIER_DAILY_LIMIT - used);
  }

  let initialThreadId: string | null = null;
  let initialMessages: InitialMessage[] = [];
  if (requestedThreadId) {
    const { data: thread } = await supabase
      .from("coach_threads")
      .select("id")
      .eq("id", requestedThreadId)
      .eq("user_id", user!.id)
      .maybeSingle();

    if (thread) {
      const { data: rows } = await supabase
        .from("coach_messages")
        .select("id, role, content, created_at")
        .eq("thread_id", requestedThreadId)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });

      initialThreadId = thread.id;
      initialMessages = ((rows ?? []) as Array<{
        id: string;
        role: string;
        content: string;
      }>)
        .filter((m): m is InitialMessage =>
          m.role === "user" || m.role === "assistant",
        )
        .map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }));
    }
  }

  return (
    <CoachChat
      locale={locale as "es" | "en"}
      isPro={isPro}
      initialQuotaRemaining={initialQuotaRemaining}
      initialThreadId={initialThreadId}
      initialMessages={initialMessages}
    />
  );
}
