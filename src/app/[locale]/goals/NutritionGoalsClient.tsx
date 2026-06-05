"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  errorMessageStyle,
  formGroupStyle,
  inputStyle,
  labelStyle,
  saveBtnStyle,
  secondaryBtnStyle,
  selectStyle,
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

function calculateTargets({
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
  const protein = Math.round(Math.max(90, weightNum * 1.6));
  const fat = Math.round((calories * 0.3) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return {
    bmr: roundToNearest(bmr, 1),
    tdee: roundToNearest(tdee, 10),
    calories,
    protein,
    carbs,
    fat,
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
  const [isSaving, startSave] = useTransition();

  const hasSavedTargets =
    initial.dailyCalories !== null ||
    initial.proteinG !== null ||
    initial.carbsG !== null ||
    initial.fatG !== null;

  const [sex, setSex] = useState<Sex | "">(initial.sex ?? "");
  const [age, setAge] = useState(initialString(initial.age));
  const [heightCm, setHeightCm] = useState(initialString(initial.heightCm, 1));
  const [weightKg, setWeightKg] = useState(initialString(initial.weightKg, 1));
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("light");
  const [goalType, setGoalType] = useState<GoalType>(initial.goalType ?? "lose");
  const [targetsTouched, setTargetsTouched] = useState(hasSavedTargets);
  const [dailyCalories, setDailyCalories] = useState(
    initialString(initial.dailyCalories),
  );
  const [proteinG, setProteinG] = useState(initialString(initial.proteinG));
  const [carbsG, setCarbsG] = useState(initialString(initial.carbsG));
  const [fatG, setFatG] = useState(initialString(initial.fatG));

  const computed = useMemo(
    () =>
      calculateTargets({
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
    if (!computed || targetsTouched) return;
    setDailyCalories(String(computed.calories));
    setProteinG(String(computed.protein));
    setCarbsG(String(computed.carbs));
    setFatG(String(computed.fat));
  }, [computed, targetsTouched]);

  function useComputedTargets() {
    if (!computed) return;
    setDailyCalories(String(computed.calories));
    setProteinG(String(computed.protein));
    setCarbsG(String(computed.carbs));
    setFatG(String(computed.fat));
    setTargetsTouched(false);
  }

  function markTargetEdited(setter: (value: string) => void, value: string) {
    setTargetsTouched(true);
    setter(value);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg(null);
    if (!computed || !sex) {
      setErrorMsg(t("validation_failed"));
      return;
    }

    const source: NutritionSource =
      Number(dailyCalories) === computed.calories &&
      Number(proteinG) === computed.protein &&
      Number(carbsG) === computed.carbs &&
      Number(fatG) === computed.fat
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
      if (result?.error) setErrorMsg(tErrors("generic"));
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

  return (
    <form onSubmit={onSubmit} noValidate>
      {saved && (
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
            style={selectStyle}
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
            style={inputStyle}
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
            style={inputStyle}
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
            style={inputStyle}
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
            style={selectStyle}
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
            style={selectStyle}
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
              required
              type="number"
              min="1"
              max="10000"
              inputMode="numeric"
              value={dailyCalories}
              onChange={(event) =>
                markTargetEdited(setDailyCalories, event.target.value)
              }
              style={inputStyle}
              className="focus:border-[var(--pp-accent)] transition-colors"
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="target-protein" style={labelStyle}>
              {t("target_protein")}
            </label>
            <input
              id="target-protein"
              required
              type="number"
              min="1"
              max="1000"
              inputMode="numeric"
              value={proteinG}
              onChange={(event) => markTargetEdited(setProteinG, event.target.value)}
              style={inputStyle}
              className="focus:border-[var(--pp-accent)] transition-colors"
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="target-carbs" style={labelStyle}>
              {t("target_carbs")}
            </label>
            <input
              id="target-carbs"
              required
              type="number"
              min="0"
              max="1000"
              inputMode="numeric"
              value={carbsG}
              onChange={(event) => markTargetEdited(setCarbsG, event.target.value)}
              style={inputStyle}
              className="focus:border-[var(--pp-accent)] transition-colors"
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="target-fat" style={labelStyle}>
              {t("target_fat")}
            </label>
            <input
              id="target-fat"
              required
              type="number"
              min="1"
              max="1000"
              inputMode="numeric"
              value={fatG}
              onChange={(event) => markTargetEdited(setFatG, event.target.value)}
              style={inputStyle}
              className="focus:border-[var(--pp-accent)] transition-colors"
            />
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={isSaving || !computed}
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
