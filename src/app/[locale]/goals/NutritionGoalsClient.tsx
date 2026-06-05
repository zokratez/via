"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  errorMessageStyle,
  formGroupStyle,
  labelStyle,
  saveBtnStyle,
  secondaryBtnStyle,
} from "@/lib/log-form-styles";
import { saveNutritionGoalsAction } from "./actions";

type Sex = "male" | "female" | "other";
type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
type GoalType = "lose" | "maintain" | "gain";
type NutritionSource = "computed" | "manual";

export type InitialNutritionGoals = {
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  goalWeightKg: number | null;
  dailyCalories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  goalType: GoalType | null;
  source: NutritionSource | null;
};

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

function roundToNearest(value: number, nearest: number) {
  return Math.round(value / nearest) * nearest;
}

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalTarget(value: string) {
  if (value.trim() === "") return null;
  return parseNumber(value);
}

function calculateMacros({
  calorieTarget,
  currentWeightKg,
  goalWeightKg,
}: {
  calorieTarget: number;
  currentWeightKg: number;
  goalWeightKg: number | null;
}) {
  const referenceWeightKg = Math.min(currentWeightKg, goalWeightKg ?? Infinity, 120);
  let protein = Math.round(Math.min(180, Math.max(90, referenceWeightKg * 1.6)));
  let desiredFat = Math.round((calorieTarget * 0.3) / 9);

  while (protein > 90 && protein * 4 + desiredFat * 9 > calorieTarget) {
    protein -= 1;
  }

  if (protein * 4 + desiredFat * 9 > calorieTarget) {
    desiredFat = Math.max(0, Math.floor((calorieTarget - protein * 4) / 9));
  }

  let best: { fat: number; carbs: number; score: number } | null = null;
  const maxFat = Math.max(0, Math.floor((calorieTarget - protein * 4) / 9));
  for (let fat = 0; fat <= maxFat; fat += 1) {
    const remainingCalories = calorieTarget - protein * 4 - fat * 9;
    if (remainingCalories < 0 || remainingCalories % 4 !== 0) continue;
    const score = Math.abs(fat - desiredFat);
    if (!best || score < best.score) {
      best = { fat, carbs: remainingCalories / 4, score };
    }
  }

  if (best) return { protein, carbs: best.carbs, fat: best.fat };

  const fat = maxFat;
  const carbs = Math.max(0, Math.round((calorieTarget - protein * 4 - fat * 9) / 4));
  return { protein, carbs, fat };
}

function calculateEnergy({
  sex,
  age,
  heightCm,
  weightKg,
  activityLevel,
  goalType,
}: {
  sex: Sex | "";
  age: string;
  heightCm: string;
  weightKg: string;
  activityLevel: ActivityLevel;
  goalType: GoalType;
}) {
  if (!sex) return null;
  const ageNum = parseNumber(age);
  const heightNum = parseNumber(heightCm);
  const weightNum = parseNumber(weightKg);
  if (!ageNum || !heightNum || !weightNum) return null;

  const sexConstant = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  const bmr = 10 * weightNum + 6.25 * heightNum - 5 * ageNum + sexConstant;
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel];
  const adjusted =
    goalType === "lose"
      ? Math.max(1200, tdee - Math.min(500, tdee * 0.2))
      : goalType === "gain"
        ? tdee + 250
        : tdee;
  const calories = roundToNearest(adjusted, 10);

  return {
    bmr: roundToNearest(bmr, 1),
    tdee: roundToNearest(tdee, 10),
    calories,
    weightKg: weightNum,
  };
}

function initialString(value: number | null, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
}

export function NutritionGoalsClient({
  initial,
  saved,
}: {
  initial: InitialNutritionGoals;
  saved: boolean;
}) {
  const t = useTranslations("goals");
  const tErrors = useTranslations("errors");
  const locale = useLocale();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(saved);
  const [isSaving, startSave] = useTransition();

  const hasSavedCalories = initial.dailyCalories !== null;
  const hasSavedMacros =
    initial.proteinG !== null || initial.carbsG !== null || initial.fatG !== null;

  const [sex, setSex] = useState<Sex | "">(initial.sex ?? "");
  const [age, setAge] = useState(initialString(initial.age));
  const [heightCm, setHeightCm] = useState(initialString(initial.heightCm, 1));
  const [weightKg, setWeightKg] = useState(initialString(initial.weightKg, 1));
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("light");
  const [goalType, setGoalType] = useState<GoalType>(initial.goalType ?? "lose");
  const [calorieTouched, setCalorieTouched] = useState(hasSavedCalories);
  const [macrosTouched, setMacrosTouched] = useState(hasSavedMacros);
  const [dailyCalories, setDailyCalories] = useState(
    initialString(initial.dailyCalories),
  );
  const [proteinG, setProteinG] = useState(initialString(initial.proteinG));
  const [carbsG, setCarbsG] = useState(initialString(initial.carbsG));
  const [fatG, setFatG] = useState(initialString(initial.fatG));

  const computed = useMemo(
    () =>
      calculateEnergy({
        sex,
        age,
        heightCm,
        weightKg,
        activityLevel,
        goalType,
      }),
    [activityLevel, age, goalType, heightCm, sex, weightKg],
  );

  useEffect(() => {
    if (!computed || calorieTouched) return;
    setDailyCalories(String(computed.calories));
  }, [calorieTouched, computed]);

  const activeCalorieTarget = useMemo(() => {
    return parseOptionalTarget(dailyCalories) ?? computed?.calories ?? null;
  }, [computed?.calories, dailyCalories]);

  const computedMacros = useMemo(() => {
    if (!computed || activeCalorieTarget === null) return null;
    return calculateMacros({
      calorieTarget: activeCalorieTarget,
      currentWeightKg: computed.weightKg,
      goalWeightKg: initial.goalWeightKg,
    });
  }, [activeCalorieTarget, computed, initial.goalWeightKg]);

  const canSaveTargets =
    Boolean(computed) ||
    parseOptionalTarget(dailyCalories) !== null ||
    parseOptionalTarget(proteinG) !== null ||
    parseOptionalTarget(carbsG) !== null ||
    parseOptionalTarget(fatG) !== null;

  useEffect(() => {
    if (!computedMacros || macrosTouched) return;
    setProteinG(String(computedMacros.protein));
    setCarbsG(String(computedMacros.carbs));
    setFatG(String(computedMacros.fat));
  }, [computedMacros, macrosTouched]);

  function useComputedTargets() {
    if (!computed || !computedMacros) return;
    setDailyCalories(String(computed.calories));
    const resetMacros = calculateMacros({
      calorieTarget: computed.calories,
      currentWeightKg: computed.weightKg,
      goalWeightKg: initial.goalWeightKg,
    });
    setProteinG(String(resetMacros.protein));
    setCarbsG(String(resetMacros.carbs));
    setFatG(String(resetMacros.fat));
    setCalorieTouched(false);
    setMacrosTouched(false);
  }

  function markCalorieEdited(value: string) {
    setCalorieTouched(true);
    setDailyCalories(value);
  }

  function markMacroEdited(setter: (value: string) => void, value: string) {
    setMacrosTouched(true);
    setter(value);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg(null);
    setShowSaved(false);

    const parsedCalories = parseOptionalTarget(dailyCalories);
    const parsedProtein = parseOptionalTarget(proteinG);
    const parsedCarbs = parseOptionalTarget(carbsG);
    const parsedFat = parseOptionalTarget(fatG);
    const hasAnyTarget =
      parsedCalories !== null ||
      parsedProtein !== null ||
      parsedCarbs !== null ||
      parsedFat !== null;

    if (!computed && !hasAnyTarget) {
      setErrorMsg(t("validation_failed"));
      return;
    }

    const source: NutritionSource =
      computed &&
      computedMacros &&
      parsedCalories === computed.calories &&
      parsedProtein === computedMacros.protein &&
      parsedCarbs === computedMacros.carbs &&
      parsedFat === computedMacros.fat
        ? "computed"
        : "manual";

    const fd = new FormData();
    fd.set("daily_calorie_target", dailyCalories);
    fd.set("protein_target_g", proteinG);
    fd.set("carbs_target_g", carbsG);
    fd.set("fat_target_g", fatG);
    fd.set("nutrition_goal_type", goalType);
    fd.set("nutrition_targets_source", source);
    fd.set("locale", locale);

    startSave(async () => {
      const result = await saveNutritionGoalsAction(fd);
      if (result?.error) {
        console.error("Nutrition goals save failed", result.error);
        setErrorMsg(tErrors("generic"));
        return;
      }
      setShowSaved(true);
    });
  }

  const pageGridStyle: React.CSSProperties = {
    display: "grid",
    gap: "1rem",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  };

  const panelStyle: React.CSSProperties = {
    background: "var(--pp-surface)",
    border: "0.5px solid var(--pp-border)",
    borderRadius: "16px",
    padding: "1rem",
  };

  const smallLabelStyle: React.CSSProperties = {
    fontFamily: "var(--pp-font-sans)",
    fontSize: "10px",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "var(--pp-text-tertiary)",
    margin: 0,
  };

  const targetValueStyle: React.CSSProperties = {
    fontFamily: "var(--pp-font-serif)",
    fontStyle: "italic",
    fontSize: "clamp(28px, 8vw, 46px)",
    lineHeight: 1,
    color: "var(--pp-accent)",
    margin: "0.4rem 0 0",
  };

  const goalFieldStyle: React.CSSProperties = {
    fontFamily: "var(--pp-font-serif)",
    fontSize: "17px",
    color: "var(--pp-text)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01)), var(--pp-surface)",
    border: "1px solid color-mix(in srgb, var(--pp-accent) 34%, var(--pp-border))",
    borderRadius: "14px",
    padding: "14px 16px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.12), 0 0 0 0.5px rgba(201,150,107,0.10), 0 8px 22px rgba(0,0,0,0.18)",
  };

  const goalSelectStyle: React.CSSProperties = {
    ...goalFieldStyle,
    colorScheme: "dark",
    cursor: "pointer",
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      {showSaved && (
        <p
          role="status"
          style={{
            color: "#9ad0a4",
            fontFamily: "var(--pp-font-sans)",
            fontSize: "13px",
            margin: "0 0 1rem",
          }}
        >
          {t("saved")}
        </p>
      )}

      <section style={pageGridStyle} aria-label={t("profile_title")}>
        <div style={formGroupStyle}>
          <label htmlFor="goal-sex" style={labelStyle}>
            {t("sex")}
          </label>
          <select
            id="goal-sex"
            required
            value={sex}
            onChange={(event) => setSex(event.target.value as Sex | "")}
            style={goalSelectStyle}
            className="focus:border-[var(--pp-accent)] transition-colors"
          >
            <option value="">{t("choose")}</option>
            <option value="female">{t("sex_female")}</option>
            <option value="male">{t("sex_male")}</option>
            <option value="other">{t("sex_other")}</option>
          </select>
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="goal-age" style={labelStyle}>
            {t("age")}
          </label>
          <input
            id="goal-age"
            required
            type="number"
            min="13"
            max="120"
            inputMode="numeric"
            value={age}
            onChange={(event) => setAge(event.target.value)}
            style={goalFieldStyle}
            className="focus:border-[var(--pp-accent)] transition-colors"
          />
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="goal-height" style={labelStyle}>
            {t("height_cm")}
          </label>
          <input
            id="goal-height"
            required
            type="number"
            min="90"
            max="250"
            step="0.1"
            inputMode="decimal"
            value={heightCm}
            onChange={(event) => setHeightCm(event.target.value)}
            style={goalFieldStyle}
            className="focus:border-[var(--pp-accent)] transition-colors"
          />
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="goal-weight" style={labelStyle}>
            {t("weight_kg")}
          </label>
          <input
            id="goal-weight"
            required
            type="number"
            min="30"
            max="500"
            step="0.1"
            inputMode="decimal"
            value={weightKg}
            onChange={(event) => setWeightKg(event.target.value)}
            style={goalFieldStyle}
            className="focus:border-[var(--pp-accent)] transition-colors"
          />
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="goal-activity" style={labelStyle}>
            {t("activity")}
          </label>
          <select
            id="goal-activity"
            value={activityLevel}
            onChange={(event) =>
              setActivityLevel(event.target.value as ActivityLevel)
            }
            style={goalSelectStyle}
            className="focus:border-[var(--pp-accent)] transition-colors"
          >
            <option value="sedentary">{t("activity_sedentary")}</option>
            <option value="light">{t("activity_light")}</option>
            <option value="moderate">{t("activity_moderate")}</option>
            <option value="active">{t("activity_active")}</option>
            <option value="very_active">{t("activity_very_active")}</option>
          </select>
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="goal-type" style={labelStyle}>
            {t("goal_type")}
          </label>
          <select
            id="goal-type"
            value={goalType}
            onChange={(event) => setGoalType(event.target.value as GoalType)}
            style={goalSelectStyle}
            className="focus:border-[var(--pp-accent)] transition-colors"
          >
            <option value="lose">{t("goal_lose")}</option>
            <option value="maintain">{t("goal_maintain")}</option>
            <option value="gain">{t("goal_gain")}</option>
          </select>
        </div>
      </section>

      <section
        style={{
          ...panelStyle,
          marginTop: "0.5rem",
          background:
            "radial-gradient(circle at 100% 0%, rgba(201,150,107,0.18), transparent 34%), var(--pp-surface)",
        }}
      >
        <p style={smallLabelStyle}>{t("computed_title")}</p>
        {computed ? (
          <div className="grid gap-3 sm:grid-cols-3" style={{ marginTop: "1rem" }}>
            <div>
              <p style={smallLabelStyle}>{t("bmr")}</p>
              <p style={targetValueStyle}>{computed.bmr}</p>
            </div>
            <div>
              <p style={smallLabelStyle}>{t("tdee")}</p>
              <p style={targetValueStyle}>{computed.tdee}</p>
            </div>
            <div>
              <p style={smallLabelStyle}>{t("calorie_target")}</p>
              <p style={targetValueStyle}>{computed.calories}</p>
            </div>
          </div>
        ) : (
          <p
            style={{
              color: "var(--pp-text-secondary)",
              fontFamily: "var(--pp-font-serif)",
              fontSize: "18px",
              lineHeight: 1.5,
              margin: "0.8rem 0 0",
            }}
          >
            {t("empty_body")}
          </p>
        )}
      </section>

      <section style={{ ...panelStyle, marginTop: "1rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            alignItems: "start",
            marginBottom: "1rem",
          }}
        >
          <div>
            <p style={smallLabelStyle}>{t("targets_title")}</p>
            <p
              style={{
                color: "var(--pp-text-secondary)",
                fontFamily: "var(--pp-font-serif)",
                fontSize: "16px",
                lineHeight: 1.5,
                margin: "0.4rem 0 0",
              }}
            >
              {t("manual_hint")}
            </p>
          </div>
          <button
            type="button"
            onClick={useComputedTargets}
            disabled={!computed}
            style={secondaryBtnStyle}
            className="hover:text-[var(--pp-accent)] hover:border-[var(--pp-accent)] transition-colors disabled:opacity-40"
          >
            {t("reset_computed")}
          </button>
        </div>

        <div style={pageGridStyle}>
          <div style={formGroupStyle}>
            <label htmlFor="target-calories" style={labelStyle}>
              {t("target_daily_calories")}
            </label>
            <input
              id="target-calories"
              type="number"
              min="1"
              max="10000"
              inputMode="numeric"
              value={dailyCalories}
              onChange={(event) => markCalorieEdited(event.target.value)}
              style={goalFieldStyle}
              className="focus:border-[var(--pp-accent)] transition-colors"
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="target-protein" style={labelStyle}>
              {t("target_protein")}
            </label>
            <input
              id="target-protein"
              type="number"
              min="1"
              max="1000"
              inputMode="numeric"
              value={proteinG}
              onChange={(event) => markMacroEdited(setProteinG, event.target.value)}
              style={goalFieldStyle}
              className="focus:border-[var(--pp-accent)] transition-colors"
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="target-carbs" style={labelStyle}>
              {t("target_carbs")}
            </label>
            <input
              id="target-carbs"
              type="number"
              min="0"
              max="1000"
              inputMode="numeric"
              value={carbsG}
              onChange={(event) => markMacroEdited(setCarbsG, event.target.value)}
              style={goalFieldStyle}
              className="focus:border-[var(--pp-accent)] transition-colors"
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="target-fat" style={labelStyle}>
              {t("target_fat")}
            </label>
            <input
              id="target-fat"
              type="number"
              min="1"
              max="1000"
              inputMode="numeric"
              value={fatG}
              onChange={(event) => markMacroEdited(setFatG, event.target.value)}
              style={goalFieldStyle}
              className="focus:border-[var(--pp-accent)] transition-colors"
            />
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={isSaving || !canSaveTargets}
        style={{ ...saveBtnStyle, marginTop: "1rem" }}
        className="disabled:opacity-45"
      >
        {isSaving ? t("saving") : t("save")}
      </button>

      {errorMsg && (
        <p style={errorMessageStyle} role="alert">
          {errorMsg}
        </p>
      )}
    </form>
  );
}
