"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { CustomSelect } from "@/components/CustomSelect";
import { useRouter } from "@/i18n/navigation";
import {
  errorMessageStyle,
  formGroupStyle,
  inputStyle,
  labelStyle,
  saveBtnStyle,
  secondaryBtnStyle,
  selectStyle,
} from "@/lib/log-form-styles";
import {
  addTodoAction,
  deleteTodoAction,
  toggleTodoAction,
} from "@/app/[locale]/calendar/actions";

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  priority: number;
};

type TodoFormValues = {
  title: string;
  due_date: string;
  priority: "1" | "2" | "3";
};

function priorityColor(priority: number, completed: boolean): string {
  if (completed) return "var(--pp-text-tertiary)";
  if (priority === 1) return "var(--pp-accent)";
  if (priority === 2) return "var(--pp-text)";
  return "var(--pp-text-tertiary)";
}

export function TodoList({
  todos,
  locale,
}: {
  todos: Todo[];
  locale: "es" | "en";
}) {
  const t = useTranslations("todo");
  const router = useRouter();
  const [isAdding, startAdd] = useTransition();
  const [, startToggle] = useTransition();
  const [, startDelete] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const form = useForm<TodoFormValues>({
    defaultValues: { title: "", due_date: "", priority: "2" },
    mode: "onSubmit",
  });

  function onSubmit(v: TodoFormValues) {
    setErrorMsg(null);
    const fd = new FormData();
    fd.set("title", v.title);
    if (v.due_date) fd.set("due_date", v.due_date);
    fd.set("priority", v.priority);
    fd.set("locale", locale);
    startAdd(async () => {
      const result = await addTodoAction(fd);
      if (result?.error) {
        setErrorMsg(t("validation_failed"));
        return;
      }
      form.reset({ title: "", due_date: "", priority: "2" });
      router.refresh();
    });
  }

  function markBusy(id: string, busy: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function onToggle(todo: Todo) {
    const fd = new FormData();
    fd.set("id", todo.id);
    fd.set("completed", todo.completed ? "false" : "true");
    fd.set("locale", locale);
    markBusy(todo.id, true);
    startToggle(async () => {
      await toggleTodoAction(fd);
      markBusy(todo.id, false);
      router.refresh();
    });
  }

  function onDelete(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("locale", locale);
    markBusy(id, true);
    startDelete(async () => {
      await deleteTodoAction(fd);
      markBusy(id, false);
      router.refresh();
    });
  }

  const cardStyle: React.CSSProperties = {
    background: "var(--pp-surface)",
    border: "0.5px solid var(--pp-border)",
    borderRadius: "6px",
    padding: "1.25rem",
    marginTop: "1.5rem",
  };

  const sortedTodos = [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.priority !== b.priority) return a.priority - b.priority;
    const ad = a.due_date ?? "9999-12-31";
    const bd = b.due_date ?? "9999-12-31";
    return ad.localeCompare(bd);
  });
  const selectedPriority = form.watch("priority");

  return (
    <div style={cardStyle}>
      <h3
        style={{
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: "20px",
          color: "var(--pp-text)",
          margin: "0 0 1rem",
        }}
      >
        {t("section_title")}
      </h3>

      {sortedTodos.length === 0 ? (
        <p
          style={{
            fontFamily: SERIF,
            fontSize: "14px",
            color: "var(--pp-text-secondary)",
            margin: "0 0 1.5rem",
            fontStyle: "italic",
          }}
        >
          {t("empty")}
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: "0 0 1.5rem",
            padding: 0,
          }}
        >
          {sortedTodos.map((todo) => {
            const isBusy = busyIds.has(todo.id);
            return (
              <li
                key={todo.id}
                style={{
                  borderTop: "0.5px solid var(--pp-border)",
                  padding: "0.75rem 0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <button
                  type="button"
                  onClick={() => onToggle(todo)}
                  disabled={isBusy}
                  aria-pressed={todo.completed}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    flex: 1,
                    textAlign: "left",
                    minWidth: 0,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "3px",
                      border: `1px solid ${
                        todo.completed
                          ? "var(--pp-accent)"
                          : "var(--pp-border)"
                      }`,
                      background: todo.completed
                        ? "var(--pp-accent)"
                        : "transparent",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--pp-bg)",
                      fontSize: "11px",
                      lineHeight: 1,
                    }}
                  >
                    {todo.completed ? "✓" : ""}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: SERIF,
                        fontSize: "15px",
                        color: priorityColor(todo.priority, todo.completed),
                        textDecoration: todo.completed
                          ? "line-through"
                          : "none",
                        display: "block",
                      }}
                    >
                      {todo.title}
                    </span>
                    {todo.due_date && (
                      <span
                        style={{
                          fontFamily: SANS,
                          fontSize: "11px",
                          color: "var(--pp-text-tertiary)",
                          letterSpacing: "0.1em",
                        }}
                      >
                        {todo.due_date}
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(todo.id)}
                  disabled={isBusy}
                  style={{
                    ...secondaryBtnStyle,
                    padding: "6px 10px",
                    fontSize: "10px",
                  }}
                >
                  {t("delete")}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div style={formGroupStyle}>
          <label htmlFor="todo-title" style={labelStyle}>
            {t("add_placeholder")}
          </label>
          <input
            id="todo-title"
            placeholder={t("add_placeholder")}
            style={inputStyle}
            className="focus:border-[var(--pp-accent)] transition-colors"
            {...form.register("title", { required: true })}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <label htmlFor="todo-due" style={labelStyle}>
              {t("due_date")}
            </label>
            <input
              id="todo-due"
              type="date"
              style={{ ...inputStyle, marginTop: "0.5rem" }}
              className="focus:border-[var(--pp-accent)] transition-colors"
              {...form.register("due_date")}
            />
          </div>
          <div>
            <label htmlFor="todo-priority" style={labelStyle}>
              {t("priority")}
            </label>
            <input type="hidden" {...form.register("priority")} />
            <CustomSelect
              id="todo-priority"
              value={selectedPriority}
              onBlur={() => form.trigger("priority")}
              onChange={(value) =>
                form.setValue("priority", value as TodoFormValues["priority"], {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              options={[
                { value: "1", label: t("priority_high") },
                { value: "2", label: t("priority_medium") },
                { value: "3", label: t("priority_low") },
              ]}
              className="focus:border-[var(--pp-accent)] transition-colors"
              style={{ ...selectStyle, marginTop: "0.5rem" }}
            />
          </div>
        </div>

        <button type="submit" disabled={isAdding} style={saveBtnStyle}>
          {isAdding ? t("adding") : t("add")}
        </button>

        {errorMsg && (
          <p style={errorMessageStyle} role="alert">
            {errorMsg}
          </p>
        )}
      </form>
    </div>
  );
}
