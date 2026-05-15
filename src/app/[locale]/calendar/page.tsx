import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { CalendarView } from "@/components/CalendarView";
import { TodoList, type Todo } from "@/components/TodoList";
import { enforceActiveSubscription } from "@/lib/subscription-guard";

function parseYearMonth(value: string | undefined): {
  year: number;
  month: number;
} {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ym?: string; d?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const { year, month } = parseYearMonth(sp.ym);

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

  await enforceActiveSubscription({
    tier: profile?.subscription_tier,
    locale: locale as "es" | "en",
  });

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonthDate = new Date(Date.UTC(year, month, 1));
  const monthEnd = `${nextMonthDate.getUTCFullYear()}-${String(
    nextMonthDate.getUTCMonth() + 1,
  ).padStart(2, "0")}-01`;

  const [eventsRes, medsRes, todosRes] = await Promise.all([
    supabase
      .from("calendar_events")
      .select(
        "id, title, description, event_date, event_time, event_type, related_medication_id",
      )
      .gte("event_date", monthStart)
      .lt("event_date", monthEnd)
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true, nullsFirst: true }),
    supabase
      .from("medications")
      .select("id, name")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("todos")
      .select("id, title, completed, due_date, priority")
      .order("created_at", { ascending: false }),
  ]);

  const t = await getTranslations("calendar");
  const tApp = await getTranslations("app");
  const tAuth = await getTranslations("auth");

  type EventRow = {
    id: string;
    title: string;
    description: string | null;
    event_date: string;
    event_time: string | null;
    event_type: "injection" | "appointment" | "reminder" | "note";
    related_medication_id: string | null;
  };
  const events = (eventsRes.data ?? []) as EventRow[];
  const meds = ((medsRes.data ?? []) as { id: string; name: string }[]).map(
    (m) => ({ id: m.id, name: m.name }),
  );
  const todos = ((todosRes.data ?? []) as Todo[]).map((todo) => ({
    id: todo.id,
    title: todo.title,
    completed: todo.completed,
    due_date: todo.due_date,
    priority: Number(todo.priority),
  }));

  const SERIF = "var(--pp-font-serif)";
  const SANS = "var(--pp-font-sans)";

  const navLinkStyle: React.CSSProperties = {
    fontFamily: SANS,
    fontSize: "12px",
    letterSpacing: "0.24em",
    textTransform: "uppercase",
    color: "var(--pp-text-secondary)",
    textDecoration: "none",
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
          <Link href="/dashboard" style={navLinkStyle}>
            {t("nav_dashboard")}
          </Link>
          <LocaleSwitcher />
          <SignOutButton label={tAuth("sign_out")} />
        </div>
      </header>

      <main
        className="flex-1 mx-auto w-full"
        style={{ maxWidth: "720px", padding: "2rem 2rem 5rem" }}
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
            margin: "0 0 2rem",
          }}
        >
          {t("title")}
        </h1>

        <CalendarView
          year={year}
          month={month}
          selectedDate={sp.d ?? null}
          events={events}
          medications={meds}
          locale={locale as "es" | "en"}
        />

        <TodoList todos={todos} locale={locale as "es" | "en"} />
      </main>
    </div>
  );
}
