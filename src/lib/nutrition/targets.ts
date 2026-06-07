export type Sex = "male" | "female" | "other";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type GoalType = "lose" | "maintain" | "gain";

export type NutritionTargetSet = {
  dailyCalories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export type EnergyEstimate = {
  bmr: number;
  tdee: number;
  calories: number;
  weightKg: number;
};

export type DerivedNutritionTargets = {
  targets: NutritionTargetSet;
  energy: EnergyEstimate | null;
  source: "profile" | "tdee" | "goal_fallback";
};

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_MACRO_CONFIG: Record<
  GoalType,
  { proteinPerKg: number; fatRatio: number; fallbackProteinShare: number }
> = {
  lose: { proteinPerKg: 1.8, fatRatio: 0.3, fallbackProteinShare: 0.3 },
  maintain: { proteinPerKg: 1.6, fatRatio: 0.3, fallbackProteinShare: 0.25 },
  gain: { proteinPerKg: 1.8, fatRatio: 0.25, fallbackProteinShare: 0.22 },
};

function roundToNearest(value: number, nearest: number) {
  return Math.round(value / nearest) * nearest;
}

export function positiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function nonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function calculateEnergy({
  sex,
  age,
  heightCm,
  weightKg,
  activityLevel,
  goalType,
}: {
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel;
  goalType: GoalType;
}): EnergyEstimate | null {
  if (!sex || !age || !heightCm || !weightKg) return null;

  const sexConstant = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexConstant;
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel];
  const adjusted =
    goalType === "lose"
      ? Math.max(1200, tdee - Math.min(500, tdee * 0.2))
      : goalType === "gain"
        ? tdee + 250
        : tdee;

  return {
    bmr: roundToNearest(bmr, 1),
    tdee: roundToNearest(tdee, 10),
    calories: roundToNearest(adjusted, 10),
    weightKg,
  };
}

export function calculateGoalAwareMacros({
  calorieTarget,
  currentWeightKg,
  goalWeightKg,
  goalType,
  proteinOverrideG,
}: {
  calorieTarget: number;
  currentWeightKg: number;
  goalWeightKg: number | null;
  goalType: GoalType;
  proteinOverrideG?: number | null;
}) {
  const config = GOAL_MACRO_CONFIG[goalType];
  const referenceWeightKg = Math.min(currentWeightKg, goalWeightKg ?? Infinity, 120);
  let protein = Math.round(
    proteinOverrideG ??
      Math.min(180, Math.max(90, referenceWeightKg * config.proteinPerKg)),
  );
  protein = Math.min(180, Math.max(90, protein));

  let desiredFat = Math.round((calorieTarget * config.fatRatio) / 9);

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

function fallbackCaloriesFromGoal({
  goalType,
  proteinG,
}: {
  goalType: GoalType;
  proteinG: number;
}) {
  const proteinShare = GOAL_MACRO_CONFIG[goalType].fallbackProteinShare;
  const rawCalories = (proteinG * 4) / proteinShare;
  const floor = goalType === "gain" ? 1600 : 1200;
  return roundToNearest(Math.max(floor, rawCalories), 10);
}

export function deriveNutritionTargets({
  sex,
  age,
  heightCm,
  weightKg,
  goalWeightKg,
  activityLevel = "light",
  goalType = "lose",
  persistedTargets,
}: {
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  goalWeightKg: number | null;
  activityLevel?: ActivityLevel;
  goalType?: GoalType | null;
  persistedTargets?: Partial<NutritionTargetSet>;
}): DerivedNutritionTargets {
  const normalizedGoal = goalType ?? "lose";
  const savedCalories = positiveNumber(persistedTargets?.dailyCalories);
  const savedProtein = positiveNumber(persistedTargets?.proteinG);
  const savedCarbs = nonNegativeNumber(persistedTargets?.carbsG);
  const savedFat = positiveNumber(persistedTargets?.fatG);
  const energy = calculateEnergy({
    sex,
    age,
    heightCm,
    weightKg,
    activityLevel,
    goalType: normalizedGoal,
  });
  const referenceWeight = energy?.weightKg ?? weightKg ?? goalWeightKg ?? 75;
  const fallbackProtein = Math.round(
    Math.min(
      180,
      Math.max(90, Math.min(referenceWeight, goalWeightKg ?? Infinity, 120) * 1.6),
    ),
  );
  const baseProtein = savedProtein ?? fallbackProtein;
  const calorieTarget =
    savedCalories ??
    energy?.calories ??
    fallbackCaloriesFromGoal({
      goalType: normalizedGoal,
      proteinG: baseProtein,
    });
  const macroDefaults = calculateGoalAwareMacros({
    calorieTarget,
    currentWeightKg: referenceWeight,
    goalWeightKg,
    goalType: normalizedGoal,
    proteinOverrideG: savedProtein,
  });
  const hasPersistedTarget =
    savedCalories !== null ||
    savedProtein !== null ||
    savedCarbs !== null ||
    savedFat !== null;

  return {
    targets: {
      dailyCalories: calorieTarget,
      proteinG: savedProtein ?? macroDefaults.protein,
      carbsG: savedCarbs ?? macroDefaults.carbs,
      fatG: savedFat ?? macroDefaults.fat,
    },
    energy,
    source: hasPersistedTarget ? "profile" : energy ? "tdee" : "goal_fallback",
  };
}
