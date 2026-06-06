"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { CustomSelect } from "@/components/CustomSelect";
import { Link, useRouter } from "@/i18n/navigation";
import {
  errorMessageStyle,
  formGroupStyle,
  inputStyle,
  labelStyle,
  saveBtnStyle,
  secondaryBtnStyle,
  selectStyle,
  textareaStyle,
} from "@/lib/log-form-styles";
import {
  addCalendarEventAction,
  deleteCalendarEventAction,
} from "@/app/[locale]/calendar/actions";

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

const EVENT_TYPES = ["injection", "appointment", "reminder", "note"] as const;
type EventType = (typeof EVENT_TYPES)[number];

export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  event_type: EventType;
  related_medication_id: string | null;
};

type Medication = { id: string; name: string };

type EventFormValues = {
  title: string;
  description: string;
  event_time: string;
  event_type: EventType;
  related_medication_id: string;
};

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatTime(t: string): string {
  return t.slice(0, 5);
}

export function CalendarView({
  year,
  month,
  selectedDate,
  events,
  medications,
  locale,
}: {
  year: number;
  month: number;
  selectedDate: string | null;
  events: CalendarEvent[];
  medications: Medication[];
  locale: "es" | "en";
}) {
  const t = useTranslations("calendar");
  const router = useRouter();
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.event_date) ?? [];
      list.push(ev);
      map.set(ev.event_date, list);
    }
    return map;
  }, [events]);

  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  const weekdays = [
    t("weekday_sun"),
    t("weekday_mon"),
    t("weekday_tue"),
    t("weekday_wed"),
    t("weekday_thu"),
    t("weekday_fri"),
    t("weekday_sat"),
  ];
  const months = [
    t("month_jan"),
    t("month_feb"),
    t("month_mar"),
    t("month_apr"),
    t("month_may"),
    t("month_jun"),
    t("month_jul"),
    t("month_aug"),
    t("month_sep"),
    t("month_oct"),
    t("month_nov"),
    t("month_dec"),
  ];

  const prevYM = (() => {
    const y = month === 1 ? year - 1 : year;
    const m = month === 1 ? 12 : month - 1;
    return `${y}-${pad2(m)}`;
  })();
  const nextYM = (() => {
    const y = month === 12 ? year + 1 : year;
    const m = month === 12 ? 1 : month + 1;
    return `${y}-${pad2(m)}`;
  })();
  const currentYM = `${year}-${pad2(month)}`;
  const today = todayISO();

  const form = useForm<EventFormValues>({
    defaultValues: {
      title: "",
      description: "",
      event_time: "",
      event_type: "note",
      related_medication_id: "",
    },
    mode: "onSubmit",
  });

  function onSubmit(v: EventFormValues) {
    if (!selectedDate) return;
    setErrorMsg(null);
    const fd = new FormData();
    fd.set("title", v.title);
    if (v.description) fd.set("description", v.description);
    fd.set("event_date", selectedDate);
    if (v.event_time) fd.set("event_time", v.event_time);
    fd.set("event_type", v.event_type);
    if (v.related_medication_id)
      fd.set("related_medication_id", v.related_medication_id);
    fd.set("locale", locale);
    startSave(async () => {
      const result = await addCalendarEventAction(fd);
      if (result?.error) {
        setErrorMsg(t("validation_failed"));
        return;
      }
      form.reset({
        title: "",
        description: "",
        event_time: "",
        event_type: "note",
        related_medication_id: "",
      });
      router.refresh();
    });
  }

  function onDelete(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("locale", locale);
    setDeletingId(id);
    startDelete(async () => {
      await deleteCalendarEventAction(fd);
      setDeletingId(null);
      router.refresh();
    });
  }

  const cardStyle: React.CSSProperties = {
    background: "var(--pp-surface)",
    border: "0.5px solid var(--pp-border)",
    borderRadius: "6px",
    padding: "1.25rem",
  };

  const monthTitleStyle: React.CSSProperties = {
    fontFamily: SERIF,
    fontStyle: "italic",
    fontSize: "22px",
    color: "var(--pp-text)",
    margin: 0,
  };

  const navBtnStyle: React.CSSProperties = {
    ...secondaryBtnStyle,
    padding: "8px 12px",
    fontSize: "10px",
  };

  const weekdayCellStyle: React.CSSProperties = {
    fontFamily: SANS,
    fontSize: "10px",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: "var(--pp-text-tertiary)",
    textAlign: "center",
    padding: "6px 0",
  };

  const selectedEvents = selectedDate
    ? eventsByDay.get(selectedDate) ?? []
    : [];
  const selectedEventType = form.watch("event_type");
  const selectedMedicationId = form.watch("related_medication_id");

  return (
    <div>
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h2 style={monthTitleStyle}>
            {months[month - 1]} {year}
          </h2>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Link href={`/calendar?ym=${prevYM}`} style={navBtnStyle}>
              ← {t("prev_month")}
            </Link>
            <Link href={`/calendar`} style={navBtnStyle}>
              {t("today")}
            </Link>
            <Link href={`/calendar?ym=${nextYM}`} style={navBtnStyle}>
              {t("next_month")} →
            </Link>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "4px",
            marginBottom: "4px",
          }}
        >
          {weekdays.map((d) => (
            <div key={d} style={weekdayCellStyle}>
              {d}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "4px",
          }}
        >
          {Array.from({ length: totalCells }).map((_, idx) => {
            const dayNum = idx - firstWeekday + 1;
            const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
            if (!inMonth) {
              return (
                <div
                  key={idx}
                  style={{
                    minHeight: "56px",
                    background: "transparent",
                    borderRadius: "4px",
                  }}
                />
              );
            }
            const dateISO = `${year}-${pad2(month)}-${pad2(dayNum)}`;
            const isSelected = selectedDate === dateISO;
            const isToday = dateISO === today;
            const hasEvents = (eventsByDay.get(dateISO) ?? []).length > 0;
            const cellStyle: React.CSSProperties = {
              minHeight: "56px",
              borderRadius: "4px",
              border: `0.5px solid ${
                isSelected ? "var(--pp-accent)" : "var(--pp-border)"
              }`,
              background: isSelected
                ? "var(--pp-accent)"
                : isToday
                  ? "var(--pp-bg)"
                  : "transparent",
              color: isSelected ? "var(--pp-bg)" : "var(--pp-text)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "6px",
              textDecoration: "none",
              fontFamily: SERIF,
              fontSize: "16px",
              cursor: "pointer",
              position: "relative",
            };
            return (
              <Link
                key={idx}
                href={`/calendar?ym=${currentYM}&d=${dateISO}`}
                style={cellStyle}
                aria-pressed={isSelected}
              >
                <span style={{ fontStyle: isToday ? "italic" : "normal" }}>
                  {dayNum}
                </span>
                {hasEvents && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: "4px",
                      height: "4px",
                      borderRadius: "50%",
                      background: isSelected
                        ? "var(--pp-bg)"
                        : "var(--pp-accent)",
                      marginTop: "4px",
                    }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div style={{ ...cardStyle, marginTop: "1.5rem" }}>
          <h3
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "20px",
              color: "var(--pp-text)",
              margin: "0 0 1rem",
            }}
          >
            {selectedDate}
          </h3>

          {selectedEvents.length === 0 ? (
            <p
              style={{
                fontFamily: SERIF,
                fontSize: "14px",
                color: "var(--pp-text-secondary)",
                margin: "0 0 1.5rem",
                fontStyle: "italic",
              }}
            >
              {t("empty_day")}
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: "0 0 1.5rem",
                padding: 0,
              }}
            >
              {selectedEvents.map((ev) => (
                <li
                  key={ev.id}
                  style={{
                    borderTop: "0.5px solid var(--pp-border)",
                    padding: "0.75rem 0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        marginBottom: "0.25rem",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: SANS,
                          fontSize: "9px",
                          letterSpacing: "0.2em",
                          textTransform: "uppercase",
                          color: "var(--pp-accent)",
                          fontWeight: 600,
                        }}
                      >
                        {t(`type_${ev.event_type}`)}
                      </span>
                      {ev.event_time && (
                        <span
                          style={{
                            fontFamily: SANS,
                            fontSize: "11px",
                            color: "var(--pp-text-tertiary)",
                          }}
                        >
                          {formatTime(ev.event_time)}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontFamily: SERIF,
                        fontSize: "15px",
                        color: "var(--pp-text)",
                      }}
                    >
                      {ev.title}
                    </div>
                    {ev.description && (
                      <div
                        style={{
                          fontFamily: SERIF,
                          fontSize: "13px",
                          color: "var(--pp-text-secondary)",
                          marginTop: "0.25rem",
                          lineHeight: 1.5,
                        }}
                      >
                        {ev.description}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDelete(ev.id)}
                    disabled={isDeleting && deletingId === ev.id}
                    style={{
                      ...secondaryBtnStyle,
                      padding: "6px 10px",
                      fontSize: "10px",
                    }}
                  >
                    {t("delete")}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div style={formGroupStyle}>
              <label htmlFor="event-title" style={labelStyle}>
                {t("form_title")}
              </label>
              <input
                id="event-title"
                style={inputStyle}
                className="focus:border-[var(--pp-accent)] transition-colors"
                {...form.register("title", { required: true })}
              />
            </div>

            <div style={formGroupStyle}>
              <label htmlFor="event-type" style={labelStyle}>
                {t("form_type")}
              </label>
              <input type="hidden" {...form.register("event_type", { required: true })} />
              <CustomSelect
                id="event-type"
                required
                value={selectedEventType}
                onBlur={() => form.trigger("event_type")}
                onChange={(value) =>
                  form.setValue("event_type", value as EventType, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                options={EVENT_TYPES.map((ty) => ({
                  value: ty,
                  label: t(`type_${ty}`),
                }))}
                className="focus:border-[var(--pp-accent)] transition-colors"
                style={selectStyle}
              />
            </div>

            <div style={formGroupStyle}>
              <label htmlFor="event-time" style={labelStyle}>
                {t("form_time")}{" "}
                <span style={{ color: "var(--pp-text-tertiary)" }}>
                  {t("time_optional")}
                </span>
              </label>
              <input
                id="event-time"
                type="time"
                style={inputStyle}
                className="focus:border-[var(--pp-accent)] transition-colors"
                {...form.register("event_time")}
              />
            </div>

            {medications.length > 0 && (
              <div style={formGroupStyle}>
                <label htmlFor="event-med" style={labelStyle}>
                  {t("form_medication")}
                </label>
                <input type="hidden" {...form.register("related_medication_id")} />
                <CustomSelect
                  id="event-med"
                  value={selectedMedicationId}
                  onBlur={() => form.trigger("related_medication_id")}
                  onChange={(value) =>
                    form.setValue("related_medication_id", value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  options={[
                    { value: "", label: t("form_medication_none") },
                    ...medications.map((m) => ({
                      value: m.id,
                      label: m.name,
                    })),
                  ]}
                  className="focus:border-[var(--pp-accent)] transition-colors"
                  style={selectStyle}
                />
              </div>
            )}

            <div style={formGroupStyle}>
              <label htmlFor="event-description" style={labelStyle}>
                {t("form_description")}{" "}
                <span style={{ color: "var(--pp-text-tertiary)" }}>
                  {t("description_optional")}
                </span>
              </label>
              <textarea
                id="event-description"
                rows={3}
                style={textareaStyle}
                className="focus:border-[var(--pp-accent)] transition-colors"
                {...form.register("description")}
              />
            </div>

            <button type="submit" disabled={isSaving} style={saveBtnStyle}>
              {isSaving ? t("saving") : t("add_event")}
            </button>

            {errorMsg && (
              <p style={errorMessageStyle} role="alert">
                {errorMsg}
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
