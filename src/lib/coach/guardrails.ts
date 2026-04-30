export type CannedGuardrailCategory =
  | "crisis"
  | "dose_advice"
  | "vendor_question"
  | "reconstitution"
  | "expired_med";

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

const DOSE_PATTERNS_ES: RegExp[] = [
  /cuant[ao]s? (mg|miligramos|unidades) (debo|tengo que|puedo)/,
  /(debo|puedo|tengo que) (subir|bajar|aumentar|reducir|cambiar) (la|mi) dosis/,
  /que dosis (es|debo|me toca|me corresponde)/,
  /puedo (saltarme|saltar) (una|la|mi) dosis/,
  /me (inyecte|puse) de mas/,
  /doble dosis/,
];

const DOSE_PATTERNS_EN: RegExp[] = [
  /how (many|much) (mg|milligrams|units) should i/,
  /should i (go up|go down|increase|decrease|change) (my )?dose/,
  /what dose (is|should|do i)/,
  /can i (skip|miss) (a|my) dose/,
  /i (injected|took) too much/,
  /double dose/,
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

const VENDOR_PATTERNS_ES: RegExp[] = [
  /donde (compro|consigo|puedo comprar|encuentro)/,
  /que (pagina|farmacia|sitio|web) (vende|recomiendas)/,
  /farmacia compuesta (recomiendas|buena|confiable)/,
  /(semaglutida|tirzepatida|ozempic|wegovy|mounjaro|zepbound) (sin receta|barato|china|de china)/,
  /\bruo\b/,
  /research grade/,
  /peptidos investigacion/,
];

const VENDOR_PATTERNS_EN: RegExp[] = [
  /where (do i|can i) (buy|get|find)/,
  /what (website|pharmacy|site) (sells|do you recommend)/,
  /compounding pharmacy (recommend|good|trustworthy)/,
  /(semaglutide|tirzepatide|ozempic|wegovy|mounjaro|zepbound) (without prescription|cheap|from china)/,
  /\bruo\b/,
  /research grade/,
  /research peptides/,
];

const RECONSTITUTION_PATTERNS_ES: RegExp[] = [
  /como reconstituyo/,
  /como mezclo (la|el) peptido/,
  /agua bacterio/,
  /cuanto bac water/,
  /como calculo (las unidades|la dosis del vial)/,
];

const RECONSTITUTION_PATTERNS_EN: RegExp[] = [
  /how (do i|to) reconstitute/,
  /how (do i|to) mix (the )?peptide/,
  /bacteriostatic water/,
  /how much bac water/,
  /how (do i|to) calculate (units|vial dose)/,
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

  const dose = locale === "en" ? DOSE_PATTERNS_EN : DOSE_PATTERNS_ES;
  if (anyMatch(t, dose)) {
    return {
      category: "dose_advice",
      cannedResponseKey: "coach.canned.dose_advice",
    };
  }

  const referral =
    locale === "en" ? REFERRAL_PATTERNS_EN : REFERRAL_PATTERNS_ES;
  if (anyMatch(t, referral)) {
    return { category: "referral_request" };
  }

  const vendor = locale === "en" ? VENDOR_PATTERNS_EN : VENDOR_PATTERNS_ES;
  if (anyMatch(t, vendor)) {
    return {
      category: "vendor_question",
      cannedResponseKey: "coach.canned.vendor_question",
    };
  }

  const recon =
    locale === "en" ? RECONSTITUTION_PATTERNS_EN : RECONSTITUTION_PATTERNS_ES;
  if (anyMatch(t, recon)) {
    return {
      category: "reconstitution",
      cannedResponseKey: "coach.canned.reconstitution",
    };
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
