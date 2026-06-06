"use client";

import { useEffect, useId, useRef, useState } from "react";
import type React from "react";

export type CustomSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type CustomSelectProps = {
  id?: string;
  name?: string;
  value: string;
  options: readonly CustomSelectOption[];
  onChange: (value: string) => void;
  onBlur?: () => void;
  ariaLabel?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export function CustomSelect({
  id,
  name,
  value,
  options,
  onChange,
  onBlur,
  ariaLabel,
  disabled = false,
  required = false,
  className,
  style,
}: CustomSelectProps) {
  const fallbackId = useId();
  const selectId = id ?? fallbackId;
  const listboxId = `${selectId}-listbox`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectedOption = options[activeIndex] ?? options[0] ?? null;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        onBlur?.();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onBlur, open]);

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  }

  function move(delta: number) {
    if (options.length === 0) return;
    let next = activeIndex;
    for (let i = 0; i < options.length; i += 1) {
      next = (next + delta + options.length) % options.length;
      if (!options[next]?.disabled) {
        choose(options[next].value);
        return;
      }
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      else move(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      else move(-1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((current) => !current);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      onBlur?.();
    }
  }

  return (
    <div
      ref={rootRef}
      className={className ? `pp-custom-select ${className}` : "pp-custom-select"}
      data-open={open ? "true" : "false"}
      data-disabled={disabled ? "true" : "false"}
      style={style}
    >
      {name && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          className="pp-custom-select-hidden"
          name={name}
          required={required}
          value={value}
          readOnly
        />
      )}
      <button
        ref={buttonRef}
        id={selectId}
        type="button"
        className="pp-custom-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onBlur={() => {
          if (!open) onBlur?.();
        }}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
      >
        <span className="pp-custom-select-value">
          {selectedOption?.label ?? ""}
        </span>
        <span className="pp-custom-select-chevron" aria-hidden="true">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={selectId}
          className="pp-custom-select-list"
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                className="pp-custom-select-option"
                data-selected={selected ? "true" : "false"}
                onClick={() => choose(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
