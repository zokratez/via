"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CustomSelect } from "@/components/CustomSelect";
import {
  cardStyle,
  errorMessageStyle,
  formGroupStyle,
  inputStyle,
  labelStyle,
  saveBtnStyle,
  secondaryBtnStyle,
  selectStyle,
} from "@/lib/log-form-styles";
import {
  calculateEnergy,
  deriveNutritionTargets,
  type ActivityLevel,
  type GoalType,
  type Sex,
} from "@/lib/nutrition/targets";
import { saveNutritionGoalsAction } from "./actions";

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

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalTarget(value: string, allowZero = false) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return allowZero ? (parsed >= 0 ? parsed : null) : parsed > 0 ? parsed : null;
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

  const isManualSource = initial.source === "manual";
  const initialDerived = deriveNutritionTargets({
    sex: initial.sex,
    age: initial.age,
    heightCm: initial.heightCm,
    weightKg: initial.weightKg,
    goalWeightKg: initial.goalWeightKg,
    goalType: initial.goalType,
    persistedTargets: {
      dailyCalories: initial.dailyCalories,
      proteinG: initial.proteinG,
      carbsG: initial.carbsG,
      fatG: initial.fatG,
    },
  });

  const [sex, setSex] = useState<Sex | "">(initial.sex ?? "");
  const [age, setAge] = useState(initialString(initial.age));
  const [heightCm, setHeightCm] = useState(initialString(initial.heightCm, 1));
  const [weightKg, setWeightKg] = useState(initialString(initial.weightKg, 1));
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("light");
  const [goalType, setGoalType] = useState<GoalType>(initial.goalType ?? "lose");
  const [targetTouched, setTargetTouched] = useState({
    dailyCalories: isManualSource && initial.dailyCalories !== null,
    proteinG: isManualSource && initial.proteinG !== null,
    carbsG: isManualSource && initial.carbsG !== null,
    fatG: isManualSource && initial.fatG !== null,
  });
  const [dailyCalories, setDailyCalories] = useState(
    initialString(initial.dailyCalories ?? initialDerived.targets.dailyCalories),
  );
  const [proteinG, setProteinG] = useState(
    initialString(initial.proteinG ?? initialDerived.targets.proteinG),
  );
  const [carbsG, setCarbsG] = useState(
    initialString(initial.carbsG ?? initialDerived.targets.carbsG),
  );
  const [fatG, setFatG] = useState(
    initialString(initial.fatG ?? initialDerived.targets.fatG),
  );

  const computed = useMemo(
    () =>
      calculateEnergy({
        sex: sex || null,
        age: parseNumber(age),
        heightCm: parseNumber(heightCm),
        weightKg: parseNumber(weightKg),
        activityLevel,
        goalType,
      }),
    [activityLevel, age, goalType, heightCm, sex, weightKg],
  );

  const recommended = useMemo(() => {
    return deriveNutritionTargets({
      sex: sex || null,
      age: parseNumber(age),
      heightCm: parseNumber(heightCm),
      weightKg: parseNumber(weightKg),
      goalWeightKg: initial.goalWeightKg,
      activityLevel,
      goalType,
      persistedTargets: {
        dailyCalories: targetTouched.dailyCalories
          ? parseOptionalTarget(dailyCalories)
          : null,
        proteinG: targetTouched.proteinG ? parseOptionalTarget(proteinG) : null,
      },
    });
  }, [
    activityLevel,
    age,
    dailyCalories,
    goalType,
    heightCm,
    initial.goalWeightKg,
    proteinG,
    sex,
    targetTouched.dailyCalories,
    targetTouched.proteinG,
    weightKg,
  ]);

  useEffect(() => {
    if (!targetTouched.dailyCalories && recommended.targets.dailyCalories !== null) {
      setDailyCalories(String(recommended.targets.dailyCalories));
    }
    if (!targetTouched.proteinG && recommended.targets.proteinG !== null) {
      setProteinG(String(recommended.targets.proteinG));
    }
    if (!targetTouched.carbsG && recommended.targets.carbsG !== null) {
      setCarbsG(String(recommended.targets.carbsG));
    }
    if (!targetTouched.fatG && recommended.targets.fatG !== null) {
      setFatG(String(recommended.targets.fatG));
    }
  }, [
    recommended.targets.carbsG,
    recommended.targets.dailyCalories,
    recommended.targets.fatG,
    recommended.targets.proteinG,
    targetTouched.carbsG,
    targetTouched.dailyCalories,
    targetTouched.fatG,
    targetTouched.proteinG,
  ]);

  const canSaveTargets =
    parseOptionalTarget(dailyCalories) !== null &&
    parseOptionalTarget(proteinG) !== null &&
    parseOptionalTarget(carbsG, true) !== null &&
    parseOptionalTarget(fatG) !== null;

  function useComputedTargets() {
    const reset = deriveNutritionTargets({
      sex: sex || null,
      age: parseNumber(age),
      heightCm: parseNumber(heightCm),
      weightKg: parseNumber(weightKg),
      goalWeightKg: initial.goalWeightKg,
      activityLevel,
      goalType,
    });
    setDailyCalories(String(reset.targets.dailyCalories));
    setProteinG(String(reset.targets.proteinG));
    setCarbsG(String(reset.targets.carbsG));
    setFatG(String(reset.targets.fatG));
    setTargetTouched({
      dailyCalories: false,
      proteinG: false,
      carbsG: false,
      fatG: false,
    });
  }

  function markCalorieEdited(value: string) {
    setTargetTouched((current) => ({ ...current, dailyCalories: true }));
    setDailyCalories(value);
  }

  function markMacroEdited(
    key: "proteinG" | "carbsG" | "fatG",
    setter: (value: string) => void,
    value: string,
  ) {
    setTargetTouched((current) => ({ ...current, [key]: true }));
    setter(value);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg(null);
    setShowSaved(false);

    const parsedCalories = parseOptionalTarget(dailyCalories);
    const parsedProtein = parseOptionalTarget(proteinG);
    const parsedCarbs = parseOptionalTarget(carbsG, true);
    const parsedFat = parseOptionalTarget(fatG);
    const finalCalories = parsedCalories ?? recommended.targets.dailyCalories;
    const finalProtein = parsedProtein ?? recommended.targets.proteinG;
    const finalCarbs = parsedCarbs ?? recommended.targets.carbsG;
    const finalFat = parsedFat ?? recommended.targets.fatG;

    if (
      finalCalories === null ||
      finalProtein === null ||
      finalCarbs === null ||
      finalFat === null
    ) {
      setErrorMsg(t("validation_failed"));
      return;
    }

    const source: NutritionSource =
      !Object.values(targetTouched).some(Boolean) &&
      finalCalories === recommended.targets.dailyCalories &&
      finalProtein === recommended.targets.proteinG &&
      finalCarbs === recommended.targets.carbsG &&
      finalFat === recommended.targets.fatG
        ? "computed"
        : "manual";

    const fd = new FormData();
    fd.set("daily_calorie_target", String(finalCalories));
    fd.set("protein_target_g", String(finalProtein));
    fd.set("carbs_target_g", String(finalCarbs));
    fd.set("fat_target_g", String(finalFat));
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
    ...cardStyle,
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
          <CustomSelect
            id="goal-sex"
            required
            value={sex}
            onChange={(value) => setSex(value as Sex | "")}
            style={selectStyle}
            className="focus:border-[var(--pp-accent)] transition-colors"
            options={[
              { value: "", label: t("choose") },
              { value: "female", label: t("sex_female") },
              { value: "male", label: t("sex_male") },
              { value: "other", label: t("sex_other") },
            ]}
          />
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
          <CustomSelect
            id="goal-activity"
            value={activityLevel}
            onChange={(value) => setActivityLevel(value as ActivityLevel)}
            style={selectStyle}
            className="focus:border-[var(--pp-accent)] transition-colors"
            options={[
              { value: "sedentary", label: t("activity_sedentary") },
              { value: "light", label: t("activity_light") },
              { value: "moderate", label: t("activity_moderate") },
              { value: "active", label: t("activity_active") },
              { value: "very_active", label: t("activity_very_active") },
            ]}
          />
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="goal-type" style={labelStyle}>
            {t("goal_type")}
          </label>
          <CustomSelect
            id="goal-type"
            value={goalType}
            onChange={(value) => setGoalType(value as GoalType)}
            style={selectStyle}
            className="focus:border-[var(--pp-accent)] transition-colors"
            options={[
              { value: "lose", label: t("goal_lose") },
              { value: "maintain", label: t("goal_maintain") },
              { value: "gain", label: t("goal_gain") },
            ]}
          />
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
            <p
              style={{
                color: "var(--pp-helper)",
                fontFamily: "var(--pp-font-sans)",
                fontSize: "11px",
                lineHeight: 1.5,
                margin: "0.45rem 0 0",
              }}
            >
              {t("recommendation_note")}
            </p>
          </div>
          <button
            type="button"
            onClick={useComputedTargets}
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
              type="number"
              min="1"
              max="1000"
              inputMode="numeric"
              value={proteinG}
              onChange={(event) =>
                markMacroEdited("proteinG", setProteinG, event.target.value)
              }
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
              type="number"
              min="0"
              max="1000"
              inputMode="numeric"
              value={carbsG}
              onChange={(event) =>
                markMacroEdited("carbsG", setCarbsG, event.target.value)
              }
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
              type="number"
              min="1"
              max="1000"
              inputMode="numeric"
              value={fatG}
              onChange={(event) =>
                markMacroEdited("fatG", setFatG, event.target.value)
              }
              style={inputStyle}
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
