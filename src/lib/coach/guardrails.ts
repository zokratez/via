export type CannedGuardrailCategory = "crisis" | "expired_med";

export type GuardrailCategory =
  | CannedGuardrailCategory
  | "referral_request";

export type GuardrailHit =
  | {
      category: CannedGuardrailCategory;
      cannedResponseKey: `coach.canned.${CannedGuardrailCategory}`;
    }
  | { category: "referral_request" };

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const CRISIS_PATTERNS_ES: RegExp[] = [
  /quiero (morirme|morir|dejarlo todo|terminarlo)/,
  /no quiero (vivir|seguir|despertar)/,
  /me quiero hacer dano/,
  /pensamientos de (suicid|hacerme dano|matarme)/,
  /voy a (matarme|hacerme dano)/,
  /ya no aguanto/,
  /pienso en suicid/,
  /dolor (severo|insoportable|terrible) en el pecho/,
  /no puedo respirar/,
  /sangrado (severo|fuerte)/,
  /inflamacion severa/,
  /desmayo/,
];

const CRISIS_PATTERNS_EN: RegExp[] = [
  /i want to (die|kill myself|end it)/,
  /i don'?t want to (live|wake up|be here)/,
  /i want to hurt myself/,
  /thinking about (suicide|killing myself|ending it)/,
  /going to (kill myself|hurt myself)/,
  /can'?t take it anymore/,
  /severe (chest|abdominal) pain/,
  /can'?t breathe/,
  /severe bleeding/,
  /severe swelling/,
  /passed out/,
  /fainting/,
];

const REFERRAL_PATTERNS_ES: RegExp[] = [
  /(conoces|recomiendas|conoce|recomienda) (a |algun |alguna |un |una )?(medico|medica|doctor|doctora|endocrino|endocrinolog|nutriolog|profesional|internista)/,
  /\bque (medico|doctor|endocrinolog|profesional)\b/,
  /donde (encuentro|busco|hallo|consigo|puedo encontrar)( un| una| a un| a una)? (medico|doctor|endocrino|endocrinolog|profesional)/,
  /necesito (un|una|a un|a una) (medico|doctor|endocrino|endocrinolog|profesional)/,
  /\balgun (medico|doctor|endocrino|endocrinolog|profesional)\b/,
  /(medico|doctor|endocrinolog) (que|de) (recomiend|conozc|trabaj|sepa|trate)/,
  /(medico|doctor) (cerca|en mi)/,
];

const REFERRAL_PATTERNS_EN: RegExp[] = [
  /know (any|of any|a) (doctor|physician|provider|endocrinologist|md|do)\b/,
  /recommend (a|an|any) (doctor|physician|provider|endocrinologist)/,
  /where can i find (a|an|any)? ?(doctor|physician|provider|endocrinologist)/,
  /\bwho should i see\b/,
  /any (doctor|physician|provider|endocrinologist) (that|who|near|in)/,
  /doctor (near me|in my area)/,
];

const EXPIRED_PATTERNS_ES: RegExp[] = [
  /(pluma|vial|jeringa|medicamento|inyeccion) (vencid[ao]|caducad[ao]|expirad[ao])/,
  /expiro (hace|el)/,
  /puedo usar.*vencid[ao]/,
];

const EXPIRED_PATTERNS_EN: RegExp[] = [
  /(pen|vial|syringe|medication|injection) (expired|out of date)/,
  /expired (a|some) (months?|weeks?) ago/,
  /can i use.*expired/,
];

function anyMatch(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

export function checkUserMessage(
  text: string,
  locale: "es" | "en",
): GuardrailHit | null {
  const t = normalize(text);

  // Crisis ALWAYS wins, regardless of locale — check both.
  if (anyMatch(t, CRISIS_PATTERNS_ES) || anyMatch(t, CRISIS_PATTERNS_EN)) {
    return { category: "crisis", cannedResponseKey: "coach.canned.crisis" };
  }

  const referral =
    locale === "en" ? REFERRAL_PATTERNS_EN : REFERRAL_PATTERNS_ES;
  if (anyMatch(t, referral)) {
    return { category: "referral_request" };
  }

  const expired =
    locale === "en" ? EXPIRED_PATTERNS_EN : EXPIRED_PATTERNS_ES;
  if (anyMatch(t, expired)) {
    return {
      category: "expired_med",
      cannedResponseKey: "coach.canned.expired_med",
    };
  }

  return null;
}
