/**
 * Shared form atom styles for /log/* pages.
 *
 * These pages use plain HTML elements (no shadcn) so they can adopt
 * the dark warm aesthetic via inline styles + --pp-* tokens.
 * Focus rings are applied via Tailwind arbitrary classes on each
 * input (`focus:border-[var(--pp-accent)] transition-colors`).
 */

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

export const formGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  marginBottom: "1.5rem",
};

export const labelStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "11px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--pp-text-secondary)",
  fontWeight: 500,
};

export const labelHintStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "10px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--pp-text-tertiary)",
  fontWeight: 400,
  marginLeft: "0.5rem",
};

export const inputStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontSize: "16px",
  color: "var(--pp-text)",
  background: "var(--pp-surface)",
  border: "0.5px solid var(--pp-border)",
  borderRadius: "6px",
  padding: "12px 14px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

export const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  fontSize: "15px",
  lineHeight: 1.55,
  resize: "vertical",
  minHeight: "84px",
  fontFamily: SERIF,
};

export const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

export const saveBtnStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "12px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  fontWeight: 600,
  background: "var(--pp-accent)",
  color: "var(--pp-bg)",
  border: "none",
  padding: "14px 28px",
  borderRadius: "6px",
  cursor: "pointer",
  width: "100%",
};

export const secondaryBtnStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "11px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  fontWeight: 500,
  background: "transparent",
  color: "var(--pp-text-secondary)",
  border: "0.5px solid var(--pp-border)",
  padding: "10px 14px",
  borderRadius: "6px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export function chipStyle(active: boolean): React.CSSProperties {
  return {
    fontFamily: SANS,
    fontSize: "12px",
    letterSpacing: "0.12em",
    padding: "12px 14px",
    borderRadius: "6px",
    border: `0.5px solid ${active ? "var(--pp-accent)" : "var(--pp-border)"}`,
    background: active ? "var(--pp-accent)" : "transparent",
    color: active ? "var(--pp-bg)" : "var(--pp-text-secondary)",
    cursor: "pointer",
    fontWeight: active ? 600 : 500,
    textAlign: "center",
    minHeight: "44px",
  };
}

export function emojiChipStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "var(--pp-surface)" : "transparent",
    border: `0.5px solid ${active ? "var(--pp-accent)" : "var(--pp-border)"}`,
    borderRadius: "6px",
    padding: "12px 0",
    fontSize: "26px",
    cursor: "pointer",
    minHeight: "56px",
  };
}

export const errorMessageStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "13px",
  color: "#c0735c",
  marginTop: "1rem",
};

export const inlineRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  alignItems: "stretch",
};
