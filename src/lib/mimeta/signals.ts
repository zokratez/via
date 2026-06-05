type Locale = "es" | "en";

type SupabaseLike = {
  from: (table: string) => unknown;
};

export type MiMetaActionIcon =
  | "scale"
  | "syringe"
  | "moon"
  | "calculator"
  | "book-open"
  | "message-circle";

export type NextAction = {
  icon: MiMetaActionIcon;
  label: string;
  href: string;
};

export type SignalState = {
  hasNewSignal: boolean;
  signalId: string | null;
  statusSentence: string;
  progressFraction: number;
  nextActions: NextAction[];
};

export type NutritionTargets = {
  dailyCalories?: number | string | null;
  proteinG?: number | string | null;
  carbsG?: number | string | null;
  fatG?: number | string | null;
  goalType?: string | null;
};

type WeightRow = {
  id?: string;
  measured_at: string;
  weight_kg: number | string;
};

type DoseRow = {
  id?: string;
  taken_at: string;
};

type SymptomRow = {
  id?: string;
  occurred_at: string;
};

type SleepRow = {
  slept_at: string;
  hours: number | string;
};

const MS_PER_DAY = 86_400_000;
const DOSE_MILESTONES = [30, 14, 7, 3] as const;

function startOfDayKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / MS_PER_DAY);
}

function actionLabels(locale: Locale) {
  if (locale === "es") {
    return {
      weight: "Registrar peso",
      dose: "Registrar dosis",
      sleep: "Registrar sueño",
      calculator: "Calcular dosis",
      journal: "Leer el diario",
      coach: "Hablar con Bukowski",
    };
  }

  return {
    weight: "Log weight",
    dose: "Log dose",
    sleep: "Log sleep",
    calculator: "Calculate dose",
    journal: "Read the journal",
    coach: "Talk to Bukowski",
  };
}

function defaultActions(locale: Locale): NextAction[] {
  const labels = actionLabels(locale);
  return [
    {
      icon: "book-open",
      label: labels.journal,
      href: locale === "es" ? "/diario" : "/journal",
    },
    { icon: "message-circle", label: labels.coach, href: "/coach" },
    {
      icon: "calculator",
      label: labels.calculator,
      href: locale === "es" ? "/calculadora" : "/calculator",
    },
  ];
}

function milestoneActions(locale: Locale): NextAction[] {
  const labels = actionLabels(locale);
  return [
    { icon: "scale", label: labels.weight, href: "/log/weight" },
    { icon: "message-circle", label: labels.coach, href: "/coach" },
    { icon: "book-open", label: labels.journal, href: locale === "es" ? "/diario" : "/journal" },
  ];
}

function weightActions(locale: Locale): NextAction[] {
  const labels = actionLabels(locale);
  return [
    { icon: "scale", label: labels.weight, href: "/log/weight" },
    { icon: "message-circle", label: labels.coach, href: "/coach" },
    {
      icon: "calculator",
      label: labels.calculator,
      href: locale === "es" ? "/calculadora" : "/calculator",
    },
  ];
}

function emptySentence(locale: Locale): string {
  return locale === "es"
    ? "Aún no hay suficiente para observar."
    : "Not enough yet to observe.";
}

function positiveNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function nutritionTargetSentence(
  locale: Locale,
  targets: NutritionTargets | null | undefined,
): string | null {
  const calories = positiveNumber(targets?.dailyCalories);
  const protein = positiveNumber(targets?.proteinG);
  if (!calories && !protein) return null;

  const roundedCalories = calories ? Math.round(calories).toLocaleString(locale) : null;
  const roundedProtein = protein ? Math.round(protein).toLocaleString(locale) : null;

  if (locale === "es") {
    if (roundedCalories && roundedProtein) {
      return `Tu meta marca ${roundedCalories} kcal y ${roundedProtein} g de proteína al día.`;
    }
    if (roundedCalories) return `Tu meta marca ${roundedCalories} kcal al día.`;
    return `Tu meta marca ${roundedProtein} g de proteína al día.`;
  }

  if (roundedCalories && roundedProtein) {
    return `Your goal marks ${roundedCalories} kcal and ${roundedProtein} g protein per day.`;
  }
  if (roundedCalories) return `Your goal marks ${roundedCalories} kcal per day.`;
  return `Your goal marks ${roundedProtein} g protein per day.`;
}

function doseMilestoneSentence(locale: Locale, count: number): string {
  return locale === "es"
    ? `Llevas ${count} registros de dosis seguidos.`
    : `You have ${count} dose logs in a row.`;
}

function firstSentence(locale: Locale, kind: "dose" | "weight" | "symptom"): string {
  if (locale === "es") {
    if (kind === "dose") return "Ya existe tu primera dosis en el registro.";
    if (kind === "weight") return "Ya existe tu primer peso en el registro.";
    return "Ya existe tu primer síntoma en el registro.";
  }

  if (kind === "dose") return "Your first dose is now in the record.";
  if (kind === "weight") return "Your first weight is now in the record.";
  return "Your first symptom is now in the record.";
}

function checkpointSentence(locale: Locale, days: number): string {
  return locale === "es"
    ? `Hace ${days} días del último peso registrado.`
    : `${days} days since the last weight log.`;
}

function weightTrendSentence(locale: Locale, delta: number): string {
  const amount = Math.abs(delta).toFixed(1);
  if (locale === "es") {
    return delta < 0
      ? `El peso bajó ${amount} kg en los últimos 7 días.`
      : `El peso subió ${amount} kg en los últimos 7 días.`;
  }

  return delta < 0
    ? `Weight moved down ${amount} kg over the last 7 days.`
    : `Weight moved up ${amount} kg over the last 7 days.`;
}

function consecutiveDateCount(rows: DoseRow[]): number {
  const keys = Array.from(new Set(rows.map((row) => startOfDayKey(row.taken_at)))).sort();
  if (keys.length === 0) return 0;

  let count = 1;
  for (let i = keys.length - 1; i > 0; i--) {
    const current = new Date(`${keys[i]}T12:00:00Z`);
    const previous = new Date(`${keys[i - 1]}T12:00:00Z`);
    if (daysBetween(current, previous) !== 1) break;
    count += 1;
  }
  return count;
}

function sign(value: number): -1 | 0 | 1 {
  if (Math.abs(value) < 0.05) return 0;
  return value > 0 ? 1 : -1;
}

function sevenDayTrendSignal(weights: WeightRow[], locale: Locale) {
  if (weights.length < 4) return null;

  const sorted = [...weights].sort(
    (a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime(),
  );
  const latestTime = new Date(sorted[sorted.length - 1].measured_at).getTime();
  const recentCutoff = latestTime - 7 * MS_PER_DAY;
  const previousCutoff = latestTime - 14 * MS_PER_DAY;

  const recent = sorted.filter(
    (row) => new Date(row.measured_at).getTime() >= recentCutoff,
  );
  const previous = sorted.filter((row) => {
    const time = new Date(row.measured_at).getTime();
    return time >= previousCutoff && time < recentCutoff;
  });

  if (recent.length < 2 || previous.length < 2) return null;

  const recentDelta =
    Number(recent[recent.length - 1].weight_kg) - Number(recent[0].weight_kg);
  const previousDelta =
    Number(previous[previous.length - 1].weight_kg) - Number(previous[0].weight_kg);
  const recentSign = sign(recentDelta);
  const previousSign = sign(previousDelta);

  if (recentSign === 0 || previousSign === 0 || recentSign === previousSign) {
    return null;
  }

  const latestDay = startOfDayKey(recent[recent.length - 1].measured_at);
  return {
    signalId: `weight-zone-${latestDay}-${recentSign}`,
    statusSentence: weightTrendSentence(locale, recentDelta),
    progressFraction: 0.68,
    nextActions: weightActions(locale),
  };
}

async function orderedRows<T>(
  supabase: SupabaseLike,
  table: string,
  columns: string,
  userId: string,
  orderColumn: string,
  limit: number,
  ascending = true,
): Promise<T[]> {
  const query = supabase.from(table) as {
    select: (selectedColumns: string) => {
      eq: (column: string, value: string) => {
        order: (
          column: string,
          options?: { ascending?: boolean },
        ) => {
          limit: (count: number) => Promise<{ data: unknown[] | null }>;
        };
      };
    };
  };
  const { data } = await query
    .select(columns)
    .eq("user_id", userId)
    .order(orderColumn, { ascending })
    .limit(limit);

  return (data ?? []) as T[];
}

export async function getMiMetaSignalState({
  supabase,
  userId,
  locale,
  nutritionTargets,
  now = new Date(),
}: {
  supabase: SupabaseLike;
  userId: string;
  locale: Locale;
  nutritionTargets?: NutritionTargets | null;
  now?: Date;
}): Promise<SignalState> {
  const [weights, doses, symptoms, sleep] = await Promise.all([
    orderedRows<WeightRow>(
      supabase,
      "weight_entries",
      "id, measured_at, weight_kg",
      userId,
      "measured_at",
      40,
    ),
    orderedRows<DoseRow>(supabase, "doses", "id, taken_at", userId, "taken_at", 40),
    orderedRows<SymptomRow>(
      supabase,
      "side_effects",
      "id, occurred_at",
      userId,
      "occurred_at",
      20,
    ),
    orderedRows<SleepRow>(
      supabase,
      "sleep_entries",
      "slept_at, hours",
      userId,
      "slept_at",
      14,
    ),
  ]);

  const firstDose = doses[0] ?? null;
  const firstWeight = weights[0] ?? null;
  const firstSymptom = symptoms[0] ?? null;
  if (firstDose && doses.length === 1) {
    return {
      hasNewSignal: true,
      signalId: `first-dose-${firstDose.id ?? startOfDayKey(firstDose.taken_at)}`,
      statusSentence: firstSentence(locale, "dose"),
      progressFraction: 0.25,
      nextActions: milestoneActions(locale),
    };
  }
  if (firstWeight && weights.length === 1) {
    return {
      hasNewSignal: true,
      signalId: `first-weight-${firstWeight.id ?? startOfDayKey(firstWeight.measured_at)}`,
      statusSentence: firstSentence(locale, "weight"),
      progressFraction: 0.25,
      nextActions: milestoneActions(locale),
    };
  }
  if (firstSymptom && symptoms.length === 1) {
    return {
      hasNewSignal: true,
      signalId: `first-symptom-${firstSymptom.id ?? startOfDayKey(firstSymptom.occurred_at)}`,
      statusSentence: firstSentence(locale, "symptom"),
      progressFraction: 0.25,
      nextActions: milestoneActions(locale),
    };
  }

  const doseStreak = consecutiveDateCount(doses);
  const milestone = DOSE_MILESTONES.find((value) => doseStreak === value);
  if (milestone) {
    return {
      hasNewSignal: true,
      signalId: `dose-streak-${milestone}-${startOfDayKey(doses[doses.length - 1].taken_at)}`,
      statusSentence: doseMilestoneSentence(locale, milestone),
      progressFraction: Math.min(1, milestone / 30),
      nextActions: milestoneActions(locale),
    };
  }

  const trendSignal = sevenDayTrendSignal(weights, locale);
  if (trendSignal) {
    return {
      hasNewSignal: true,
      ...trendSignal,
    };
  }

  const latestWeight = weights[weights.length - 1] ?? null;
  if (latestWeight) {
    const days = daysBetween(now, new Date(latestWeight.measured_at));
    if (days >= 7) {
      return {
        hasNewSignal: true,
        signalId: `weight-checkpoint-${startOfDayKey(now)}`,
        statusSentence: checkpointSentence(locale, days),
        progressFraction: 0.5,
        nextActions: weightActions(locale),
      };
    }
  }

  if (sleep.length > 0) {
    const recentSleep = sleep.filter(
      (row) => daysBetween(now, new Date(`${row.slept_at}T12:00:00Z`)) <= 7,
    );
    const highSleepNights = recentSleep.filter((row) => Number(row.hours) >= 7).length;
    if (highSleepNights >= 3) {
      return {
        hasNewSignal: false,
        signalId: null,
        statusSentence:
          locale === "es"
            ? `Llevas ${highSleepNights} noches con más de siete horas.`
            : `${highSleepNights} nights over seven hours.`,
        progressFraction: Math.min(1, highSleepNights / 7),
        nextActions: defaultActions(locale),
      };
    }
  }

  if (weights.length >= 2) {
    const latest = weights[weights.length - 1];
    const baseline =
      [...weights]
        .reverse()
        .find(
          (row) =>
            new Date(row.measured_at).getTime() <=
            new Date(latest.measured_at).getTime() - 7 * MS_PER_DAY,
        ) ?? weights[0];
    const delta = Number(latest.weight_kg) - Number(baseline.weight_kg);
    if (Math.abs(delta) >= 0.05) {
      return {
        hasNewSignal: false,
        signalId: null,
        statusSentence: weightTrendSentence(locale, delta),
        progressFraction: 0.58,
        nextActions: defaultActions(locale),
      };
    }
  }

  const nutritionSentence = nutritionTargetSentence(locale, nutritionTargets);
  if (nutritionSentence) {
    return {
      hasNewSignal: false,
      signalId: null,
      statusSentence: nutritionSentence,
      progressFraction: 0.35,
      nextActions: defaultActions(locale),
    };
  }

  return {
    hasNewSignal: false,
    signalId: null,
    statusSentence: emptySentence(locale),
    progressFraction: 0,
    nextActions: defaultActions(locale),
  };
}
