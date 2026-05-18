import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadArticles } from "@/lib/journal/articles";

const LOCALES = ["es", "en"] as const;

const bodySchema = z.object({
  query: z.string().trim().min(1).max(100),
  locale: z.enum(LOCALES),
});

export type SearchResult = {
  category:
    | "articles"
    | "coach"
    | "doses"
    | "weight"
    | "calendar"
    | "todos";
  id: string;
  title: string;
  preview: string | null;
  date: string | null;
  href: string;
};

export type SearchResponse = {
  groups: Record<string, SearchResult[]>;
  total: number;
};

function escapeIlike(q: string): string {
  return q.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  const { query, locale } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const lowerQuery = query.toLowerCase();

  const groups: Record<string, SearchResult[]> = {
    articles: [],
    coach: [],
    doses: [],
    weight: [],
    calendar: [],
    todos: [],
  };

  // Articles are public and file-based, so logged-out visitors can still
  // search the Diario/Journal instead of seeing a misleading empty state.
  const articles = await loadArticles(locale);
  for (const a of articles) {
    if (
      a.title.toLowerCase().includes(lowerQuery) ||
      a.summary.toLowerCase().includes(lowerQuery)
    ) {
      const journalRoot = locale === "es" ? "/diario" : "/journal";
      groups.articles.push({
        category: "articles",
        id: a.slug,
        title: a.title,
        preview: a.summary,
        date: a.date,
        href: `${journalRoot}/${a.slug}`,
      });
      if (groups.articles.length >= 10) break;
    }
  }

  if (!user) {
    return NextResponse.json({
      groups,
      total: groups.articles.length,
    } satisfies SearchResponse);
  }

  const ilike = `%${escapeIlike(query)}%`;

  const [coachRes, dosesRes, weightRes, calendarRes, todosRes] =
    await Promise.all([
      supabase
        .from("coach_messages")
        .select("id, content, created_at, thread_id, role")
        .eq("user_id", user.id)
        .ilike("content", ilike)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("doses")
        .select("id, taken_at, dose_mg, medications(name, generic_name)")
        .eq("user_id", user.id)
        .order("taken_at", { ascending: false })
        .limit(50),
      supabase
        .from("weight_entries")
        .select("id, measured_at, weight_kg")
        .eq("user_id", user.id)
        .ilike("measured_at", ilike)
        .order("measured_at", { ascending: false })
        .limit(10),
      supabase
        .from("calendar_events")
        .select("id, title, event_date, event_type")
        .eq("user_id", user.id)
        .ilike("title", ilike)
        .order("event_date", { ascending: false })
        .limit(10),
      supabase
        .from("todos")
        .select("id, title, due_date, completed")
        .eq("user_id", user.id)
        .ilike("title", ilike)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  type CoachRow = {
    id: string;
    content: string;
    created_at: string;
    thread_id: string;
    role: string;
  };
  for (const m of (coachRes.data ?? []) as CoachRow[]) {
    groups.coach.push({
      category: "coach",
      id: m.id,
      title:
        m.role === "user"
          ? m.content.slice(0, 80)
          : m.content.slice(0, 80),
      preview: m.content.length > 80 ? m.content.slice(0, 200) : null,
      date: m.created_at,
      href: `/coach?thread=${m.thread_id}`,
    });
  }

  type DoseRow = {
    id: string;
    taken_at: string;
    dose_mg: number | string;
    medications:
      | { name: string | null; generic_name: string | null }
      | { name: string | null; generic_name: string | null }[]
      | null;
  };
  for (const d of (dosesRes.data ?? []) as DoseRow[]) {
    const med = Array.isArray(d.medications)
      ? d.medications[0] ?? null
      : d.medications;
    const medName = med?.name ?? "";
    const medGeneric = med?.generic_name ?? "";
    if (
      !medName.toLowerCase().includes(lowerQuery) &&
      !medGeneric.toLowerCase().includes(lowerQuery)
    ) {
      continue;
    }
    groups.doses.push({
      category: "doses",
      id: d.id,
      title: `${medName || medGeneric} — ${Number(d.dose_mg)} mg`,
      preview: null,
      date: d.taken_at,
      href: `/dashboard`,
    });
    if (groups.doses.length >= 10) break;
  }

  type WeightRow = { id: string; measured_at: string; weight_kg: number | string };
  for (const w of (weightRes.data ?? []) as WeightRow[]) {
    groups.weight.push({
      category: "weight",
      id: w.id,
      title: `${Number(w.weight_kg).toFixed(1)} kg`,
      preview: null,
      date: w.measured_at,
      href: `/dashboard`,
    });
  }

  type EventRow = {
    id: string;
    title: string;
    event_date: string;
    event_type: string;
  };
  for (const e of (calendarRes.data ?? []) as EventRow[]) {
    groups.calendar.push({
      category: "calendar",
      id: e.id,
      title: e.title,
      preview: e.event_type,
      date: e.event_date,
      href: `/calendar?d=${e.event_date}`,
    });
  }

  type TodoRow = {
    id: string;
    title: string;
    due_date: string | null;
    completed: boolean;
  };
  for (const todo of (todosRes.data ?? []) as TodoRow[]) {
    groups.todos.push({
      category: "todos",
      id: todo.id,
      title: todo.title,
      preview: todo.completed ? "✓" : null,
      date: todo.due_date,
      href: `/calendar`,
    });
  }

  const total =
    groups.articles.length +
    groups.coach.length +
    groups.doses.length +
    groups.weight.length +
    groups.calendar.length +
    groups.todos.length;

  const response: SearchResponse = { groups, total };
  return NextResponse.json(response);
}
