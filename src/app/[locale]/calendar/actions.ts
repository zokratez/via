"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const LOCALES = ["es", "en"] as const;
const EVENT_TYPES = ["injection", "appointment", "reminder", "note"] as const;

const eventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  event_time: z
    .union([z.literal(""), z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/)])
    .optional(),
  event_type: z.enum(EVENT_TYPES),
  related_medication_id: z
    .union([z.literal(""), z.string().uuid()])
    .optional(),
  locale: z.enum(LOCALES),
});

export async function addCalendarEventAction(formData: FormData) {
  const raw = {
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    event_date: formData.get("event_date"),
    event_time: formData.get("event_time") ?? undefined,
    event_type: formData.get("event_type"),
    related_medication_id: formData.get("related_medication_id") ?? undefined,
    locale: formData.get("locale"),
  };
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) return { error: "validation_failed" as const };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" as const };

  const description =
    parsed.data.description && parsed.data.description.length > 0
      ? parsed.data.description
      : null;
  const eventTime =
    parsed.data.event_time && parsed.data.event_time.length > 0
      ? parsed.data.event_time
      : null;
  const medicationId =
    parsed.data.related_medication_id &&
    parsed.data.related_medication_id.length > 0
      ? parsed.data.related_medication_id
      : null;

  if (medicationId) {
    const { data: medication } = await supabase
      .from("medications")
      .select("id")
      .eq("id", medicationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!medication) return { error: "validation_failed" as const };
  }

  const { error } = await supabase.from("calendar_events").insert({
    user_id: user.id,
    title: parsed.data.title,
    description,
    event_date: parsed.data.event_date,
    event_time: eventTime,
    event_type: parsed.data.event_type,
    related_medication_id: medicationId,
    locale: parsed.data.locale,
  });

  if (error) return { error: "db_failed" as const };

  revalidatePath(`/${parsed.data.locale}/calendar`);
  return { ok: true as const };
}

const todoSchema = z.object({
  title: z.string().trim().min(1).max(200),
  due_date: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .optional(),
  priority: z.coerce.number().int().min(1).max(3),
  locale: z.enum(LOCALES),
});

export async function addTodoAction(formData: FormData) {
  const raw = {
    title: formData.get("title"),
    due_date: formData.get("due_date") ?? undefined,
    priority: formData.get("priority") ?? "2",
    locale: formData.get("locale"),
  };
  const parsed = todoSchema.safeParse(raw);
  if (!parsed.success) return { error: "validation_failed" as const };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" as const };

  const dueDate =
    parsed.data.due_date && parsed.data.due_date.length > 0
      ? parsed.data.due_date
      : null;

  const { error } = await supabase.from("todos").insert({
    user_id: user.id,
    title: parsed.data.title,
    due_date: dueDate,
    priority: parsed.data.priority,
  });

  if (error) return { error: "db_failed" as const };

  revalidatePath(`/${parsed.data.locale}/calendar`);
  return { ok: true as const };
}

const toggleSchema = z.object({
  id: z.string().uuid(),
  completed: z.enum(["true", "false"]),
  locale: z.enum(LOCALES),
});

export async function toggleTodoAction(formData: FormData) {
  const parsed = toggleSchema.safeParse({
    id: formData.get("id"),
    completed: formData.get("completed"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) return { error: "validation_failed" as const };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" as const };

  const { error } = await supabase
    .from("todos")
    .update({ completed: parsed.data.completed === "true" })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) return { error: "db_failed" as const };

  revalidatePath(`/${parsed.data.locale}/calendar`);
  return { ok: true as const };
}

export async function deleteTodoAction(formData: FormData) {
  const parsed = deleteSchema.safeParse({
    id: formData.get("id"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) return { error: "validation_failed" as const };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" as const };

  const { error } = await supabase
    .from("todos")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) return { error: "db_failed" as const };

  revalidatePath(`/${parsed.data.locale}/calendar`);
  return { ok: true as const };
}

const deleteSchema = z.object({
  id: z.string().uuid(),
  locale: z.enum(LOCALES),
});

export async function deleteCalendarEventAction(formData: FormData) {
  const parsed = deleteSchema.safeParse({
    id: formData.get("id"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) return { error: "validation_failed" as const };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" as const };

  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) return { error: "db_failed" as const };

  revalidatePath(`/${parsed.data.locale}/calendar`);
  return { ok: true as const };
}
