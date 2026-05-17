"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

type DoseUnit = "mg" | "mcg";

const VIAL_PRESETS_MG = [2, 3, 5, 10, 15] as const;
const BAC_PRESETS_ML = [1, 2, 3, 5] as const;
const DOSE_PRESETS = [
  { mg: 0.05, label: "50mcg" },
  { mg: 0.1, label: "100mcg" },
  { mg: 0.25, label: "250mcg" },
  { mg: 0.5, label: "500mcg" },
  { mg: 1, label: "1mg" },
  { mg: 2.5, label: "2.5mg" },
] as const;

function trim(n: number, max = 4): string {
  if (!Number.isFinite(n)) return "—";
  const factor = 10 ** max;
  return (Math.round(n * factor) / factor).toString();
}

function parsePositive(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const sectionStyle: React.CSSProperties = { marginBottom: "2rem" };

const labelStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "11px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--pp-text-secondary)",
  fontWeight: 500,
};

const questionStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontStyle: "italic",
  fontSize: "20px",
  color: "var(--pp-text)",
  margin: "0 0 1rem",
  lineHeight: 1.3,
};

const chipRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    fontFamily: SANS,
    fontSize: "12px",
    letterSpacing: "0.12em",
    padding: "10px 14px",
    borderRadius: "4px",
    border: `0.5px solid ${active ? "var(--pp-accent)" : "var(--pp-border)"}`,
    background: active ? "var(--pp-accent)" : "transparent",
    color: active ? "var(--pp-bg)" : "var(--pp-text-secondary)",
    cursor: "pointer",
    fontWeight: active ? 600 : 500,
    textTransform: "lowercase",
    minHeight: "40px",
  };
}

const customInputStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontSize: "16px",
  color: "var(--pp-text)",
  background: "var(--pp-surface)",
  border: "0.5px solid var(--pp-border)",
  borderRadius: "4px",
  padding: "10px 12px",
  marginTop: "0.5rem",
  width: "120px",
  outline: "none",
};

const resultBlockStyle: React.CSSProperties = {
  background: "var(--pp-surface)",
  border: "0.5px solid var(--pp-border)",
  borderRadius: "6px",
  padding: "1.5rem",
};

const resultLabelStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "10px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--pp-text-secondary)",
  fontWeight: 500,
  marginBottom: "0.25rem",
};

const resultValueStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontStyle: "italic",
  fontSize: "32px",
  color: "var(--pp-accent)",
  margin: 0,
  lineHeight: 1.1,
};

const exampleBtnStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontStyle: "italic",
  fontSize: "15px",
  color: "var(--pp-text)",
  background: "var(--pp-surface)",
  border: "0.5px solid var(--pp-border)",
  borderRadius: "6px",
  padding: "1rem 1.25rem",
  textAlign: "left",
  cursor: "pointer",
  width: "100%",
  lineHeight: 1.4,
};

export function PeptideCalculator() {
  const t = useTranslations("calculator");

  const [vialMg, setVialMg] = useState<number>(5);
  const [bacMl, setBacMl] = useState<number>(1);
  const [doseMg, setDoseMg] = useState<number>(0.25);

  const [vialMode, setVialMode] = useState<"preset" | "custom">("preset");
  const [bacMode, setBacMode] = useState<"preset" | "custom">("preset");
  const [doseMode, setDoseMode] = useState<"preset" | "custom">("preset");

  const [vialCustom, setVialCustom] = useState<string>("");
  const [bacCustom, setBacCustom] = useState<string>("");
  const [doseCustom, setDoseCustom] = useState<string>("");
  const [doseCustomUnit, setDoseCustomUnit] = useState<DoseUnit>("mg");

  const concentration = bacMl > 0 ? vialMg / bacMl : 0;
  const volumeMl = concentration > 0 ? doseMg / concentration : 0;
  const units = volumeMl * 100;
  const exceedsSyringe = units > 100;

  function pickVial(mg: number) {
    setVialMg(mg);
    setVialMode("preset");
    setVialCustom("");
  }
  function pickBac(ml: number) {
    setBacMl(ml);
    setBacMode("preset");
    setBacCustom("");
  }
  function pickDose(mg: number) {
    setDoseMg(mg);
    setDoseMode("preset");
    setDoseCustom("");
  }

  function setVialFromCustom(s: string) {
    setVialCustom(s);
    setVialMg(parsePositive(s));
  }
  function setBacFromCustom(s: string) {
    setBacCustom(s);
    setBacMl(parsePositive(s));
  }
  function setDoseFromCustom(s: string, unit: DoseUnit) {
    setDoseCustom(s);
    const n = parsePositive(s);
    setDoseMg(unit === "mcg" ? n / 1000 : n);
  }

  function loadExample(opts: { vialMg: number; bacMl: number; doseMg: number }) {
    pickVial(opts.vialMg);
    pickBac(opts.bacMl);
    pickDose(opts.doseMg);
  }

  const fillPct = Math.min(units, 100) / 100;

  return (
    <div>
      <div style={sectionStyle}>
        <p style={questionStyle}>{t("vial_question")}</p>
        <div style={chipRow}>
          {VIAL_PRESETS_MG.map((mg) => (
            <button
              key={mg}
              type="button"
              onClick={() => pickVial(mg)}
              style={chipStyle(vialMode === "preset" && vialMg === mg)}
            >
              {mg}mg
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setVialMode("custom");
              setVialMg(parsePositive(vialCustom));
            }}
            style={chipStyle(vialMode === "custom")}
          >
            {t("preset_other")}
          </button>
        </div>
        {vialMode === "custom" && (
          <input
            type="number"
            min="0"
            step="0.5"
            value={vialCustom}
            onChange={(e) => setVialFromCustom(e.target.value)}
            placeholder="mg"
            aria-label={t("vial_question")}
            style={customInputStyle}
          />
        )}
      </div>

      <div style={sectionStyle}>
        <p style={questionStyle}>{t("bac_question")}</p>
        <div style={chipRow}>
          {BAC_PRESETS_ML.map((ml) => (
            <button
              key={ml}
              type="button"
              onClick={() => pickBac(ml)}
              style={chipStyle(bacMode === "preset" && bacMl === ml)}
            >
              {ml}mL
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setBacMode("custom");
              setBacMl(parsePositive(bacCustom));
            }}
            style={chipStyle(bacMode === "custom")}
          >
            {t("preset_other")}
          </button>
        </div>
        {bacMode === "custom" && (
          <input
            type="number"
            min="0"
            step="0.5"
            value={bacCustom}
            onChange={(e) => setBacFromCustom(e.target.value)}
            placeholder="mL"
            aria-label={t("bac_question")}
            style={customInputStyle}
          />
        )}
      </div>

      <div style={sectionStyle}>
        <p style={questionStyle}>{t("dose_question")}</p>
        <div style={chipRow}>
          {DOSE_PRESETS.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => pickDose(d.mg)}
              style={chipStyle(doseMode === "preset" && doseMg === d.mg)}
            >
              {d.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setDoseMode("custom");
              setDoseFromCustom(doseCustom, doseCustomUnit);
            }}
            style={chipStyle(doseMode === "custom")}
          >
            {t("preset_other")}
          </button>
        </div>
        {doseMode === "custom" && (
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              marginTop: "0.5rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="number"
              min="0"
              step="0.05"
              value={doseCustom}
              onChange={(e) => setDoseFromCustom(e.target.value, doseCustomUnit)}
              placeholder={doseCustomUnit}
              aria-label={t("dose_question")}
              style={customInputStyle}
            />
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {(["mcg", "mg"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => {
                    setDoseCustomUnit(u);
                    if (doseCustom) setDoseFromCustom(doseCustom, u);
                  }}
                  style={chipStyle(doseCustomUnit === u)}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          ...resultBlockStyle,
          marginTop: "3rem",
          display: "grid",
          gap: "1.5rem",
        }}
      >
        <div>
          <p style={resultLabelStyle}>{t("result_concentration")}</p>
          <p style={resultValueStyle}>{trim(concentration)} mg/mL</p>
        </div>
        <div>
          <p style={resultLabelStyle}>{t("result_volume")}</p>
          <p style={resultValueStyle}>{trim(volumeMl)} mL</p>
        </div>
        <div>
          <p style={resultLabelStyle}>{t("result_units")}</p>
          <p style={resultValueStyle}>
            {trim(units, 1)} {t("result_units_unit")}
          </p>
          {exceedsSyringe && (
            <p
              style={{
                fontFamily: SANS,
                fontSize: "12px",
                color: "#c0735c",
                marginTop: "0.5rem",
                lineHeight: 1.5,
              }}
            >
              {t("warning_exceeds")}
            </p>
          )}
        </div>
        <div style={{ marginTop: "0.25rem" }}>
          <SyringeSvg fillPct={fillPct} />
        </div>
      </div>

      <div style={{ marginTop: "3rem" }}>
        <p style={{ ...labelStyle, marginBottom: "1rem" }}>
          {t("examples_title")}
        </p>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={() => loadExample({ vialMg: 5, bacMl: 1, doseMg: 0.25 })}
            style={exampleBtnStyle}
          >
            {t("example_1")}
          </button>
          <button
            type="button"
            onClick={() => loadExample({ vialMg: 5, bacMl: 2, doseMg: 0.25 })}
            style={exampleBtnStyle}
          >
            {t("example_2")}
          </button>
          <button
            type="button"
            onClick={() => loadExample({ vialMg: 10, bacMl: 2, doseMg: 2 })}
            style={exampleBtnStyle}
          >
            {t("example_3")}
          </button>
        </div>
      </div>

      <p
        style={{
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: "15px",
          color: "var(--pp-text-secondary)",
          marginTop: "3rem",
          marginBottom: 0,
          lineHeight: 1.7,
        }}
      >
        {t("disclaimer")}
      </p>
    </div>
  );
}

function SyringeSvg({ fillPct }: { fillPct: number }) {
  const barrelX = 50;
  const barrelW = 300;
  const fillW = Math.max(0, Math.min(1, fillPct)) * barrelW;
  return (
    <svg
      viewBox="0 0 430 112"
      width="100%"
      role="img"
      aria-label="100 unit insulin syringe fill illustration"
      style={{ maxWidth: "520px", display: "block" }}
    >
      <rect
        x="18"
        y="33"
        width="32"
        height="18"
        fill="var(--pp-text-tertiary)"
      />
      <rect
        x={barrelX}
        y="24"
        width={barrelW}
        height="36"
        fill="var(--pp-bg)"
        stroke="var(--pp-border)"
        strokeWidth="1"
      />
      {fillW > 0 && (
        <rect
          x={barrelX}
          y="26"
          width={fillW}
          height="32"
          fill="var(--pp-accent)"
        />
      )}
      {Array.from({ length: 10 }, (_, i) => (i + 1) * 10).map((unit) => {
        const p = unit / 100;
        const x = barrelX + p * barrelW;
        const isMajor = unit % 50 === 0 || unit === 100;
        return (
          <g key={unit}>
            <line
              x1={x}
              y1="60"
              x2={x}
              y2={isMajor ? "75" : "70"}
              stroke="var(--pp-text-tertiary)"
              strokeWidth="1"
            />
            <text
              x={x}
              y="92"
              fontSize="11"
              fill="var(--pp-text-tertiary)"
              fontFamily="var(--pp-font-sans)"
              textAnchor="middle"
            >
              {unit}
            </text>
          </g>
        );
      })}
      <line
        x1="350"
        y1="42"
        x2="420"
        y2="42"
        stroke="var(--pp-text-tertiary)"
        strokeWidth="2"
      />
      <polygon
        points="420,39 428,42 420,45"
        fill="var(--pp-text-tertiary)"
      />
    </svg>
  );
}
