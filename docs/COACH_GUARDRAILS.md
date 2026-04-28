# Bukowski — Guardrails

These are pre-checks that run BEFORE the user's message gets sent to Claude. They catch the highest-risk patterns and either:
1. Return a canned response (saves tokens, prevents jailbreak surface)
2. Flag the message to be routed differently (e.g., crisis triggers a different response template)

The goal is defense-in-depth: the system prompt tells Bukowski how to refuse, and these guardrails are the seatbelt in case the LLM gets clever-talked into bypassing the prompt.

---

## How it works

`src/lib/coach/guardrails.ts` exports:

```ts
export type GuardrailHit = {
  category: 'crisis' | 'dose_advice' | 'vendor_question' | 'reconstitution' | 'expired_med';
  cannedResponseKey: string; // i18n key in messages/{locale}.json under coach.canned
};

export function checkUserMessage(text: string, locale: 'es' | 'en'): GuardrailHit | null;
```

If the function returns a `GuardrailHit`, the API route uses the canned response (translated via i18n) instead of calling Claude.

If it returns `null`, the message is clean — send to Claude.

---

## Categories and their patterns

### 1. CRISIS — self-harm or medical emergency

These ALWAYS take precedence. If any pattern matches, this category wins regardless of what else is in the message.

**Spanish patterns (regex, case-insensitive, accent-tolerant):**
- `quiero (morirme|morir|dejarlo todo|terminarlo)`
- `no quiero (vivir|seguir|despertar)`
- `me quiero hacer daño`
- `pensamientos de (suicid|hacerme daño|matarme)`
- `voy a (matarme|hacerme daño)`
- `ya no aguanto`
- `pienso en suicid`

**English patterns:**
- `i want to (die|kill myself|end it)`
- `i don't want to (live|wake up|be here)`
- `i want to hurt myself`
- `thinking about (suicide|killing myself|ending it)`
- `going to (kill myself|hurt myself)`
- `can't take it anymore`

**Medical emergency (Spanish):**
- `dolor (severo|insoportable|terrible) en el pecho`
- `no puedo respirar`
- `sangrado (severo|fuerte)`
- `inflamación severa`
- `desmayo`

**Medical emergency (English):**
- `severe (chest|abdominal) pain`
- `can't breathe`
- `severe bleeding`
- `severe swelling`
- `passed out` / `fainting`

**Canned response (Spanish):**
> Lo que me cuentas es importante. Quiero asegurarme de que estés bien antes de seguir.
>
> Si estás en peligro o pensando en hacerte daño, por favor contacta:
> - **México:** Línea de la Vida 800-290-0024 (24/7, gratis)
> - **EE.UU.:** 988 Suicide & Crisis Lifeline (oprime 2 para español)
> - **Emergencia médica:** 911
>
> ¿Estás a salvo en este momento? Estoy aquí.

**Canned response (English):**
> What you're telling me matters. I want to make sure you're okay before we continue.
>
> If you're in danger or having thoughts of hurting yourself, please reach out:
> - **US:** 988 Suicide & Crisis Lifeline (press 2 for Spanish)
> - **Mexico:** Línea de la Vida 800-290-0024 (24/7, free)
> - **Medical emergency:** 911
>
> Are you safe right now? I'm here.

---

### 2. DOSE_ADVICE — questions about specific dosing

**Spanish patterns:**
- `cuánt[ao]s? (mg|miligramos|unidades) (debo|tengo que|puedo)`
- `(debo|puedo|tengo que) (subir|bajar|aumentar|reducir|cambiar) (la|mi) dosis`
- `qué dosis (es|debo|me toca|me corresponde)`
- `puedo (saltarme|saltar) (una|la|mi) dosis`
- `me (inyecté|puse) de más`
- `doble dosis`

**English patterns:**
- `how (many|much) (mg|milligrams|units) should i`
- `should i (go up|go down|increase|decrease|change) (my )?dose`
- `what dose (is|should|do i)`
- `can i (skip|miss) (a|my) dose`
- `i (injected|took) too much`
- `double dose`

**Canned response (Spanish):**
> Esa es una decisión entre tu médico y tú — yo no te puedo recomendar dosis. Lo que sí podemos hacer es preparar las preguntas para tu próxima cita: qué efectos has notado, qué quieres ajustar, qué necesitas saber. ¿Quieres que te ayude con eso?

**Canned response (English):**
> That's a decision between you and your doctor — I can't recommend doses. What we can do is prep your questions for your next appointment: what effects you've noticed, what you want to adjust, what you need to know. Want help with that?

---

### 3. VENDOR_QUESTION — where to buy / sourcing

**Spanish patterns:**
- `dónde (compro|consigo|puedo comprar|encuentro)`
- `qué (página|farmacia|sitio|web) (vende|recomiendas)`
- `farmacia compuesta (recomiendas|buena|confiable)`
- `(semaglutida|tirzepatida|ozempic|wegovy|mounjaro|zepbound) (sin receta|barato|china|de china)`
- `ruo`
- `research grade`
- `peptidos investigación`

**English patterns:**
- `where (do i|can i) (buy|get|find)`
- `what (website|pharmacy|site) (sells|do you recommend)`
- `compounding pharmacy (recommend|good|trustworthy)`
- `(semaglutide|tirzepatide|ozempic|wegovy|mounjaro|zepbound) (without prescription|cheap|from china)`
- `ruo`
- `research grade`
- `research peptides`

**Canned response (Spanish):**
> No te puedo recomendar un vendedor o farmacia específica. Para conseguir GLP-1 con seguridad hay dos caminos: una receta de tu médico para la versión de marca (Ozempic, Wegovy, Mounjaro, Zepbound), o una farmacia 503A licenciada en EE.UU. a través de telemedicina. Productos "RUO" o "research grade" no son seguros para uso humano y no los voy a sugerir.

**Canned response (English):**
> I can't recommend a specific vendor or pharmacy. To get GLP-1 safely there are two paths: a prescription from your doctor for the branded version (Ozempic, Wegovy, Mounjaro, Zepbound), or a licensed 503A compounding pharmacy in the US through telehealth. "RUO" or "research grade" products are not safe for human use and I'm not going to suggest them.

---

### 4. RECONSTITUTION — how to mix peptides

**Spanish patterns:**
- `cómo reconstituyo`
- `cómo mezclo (la|el) péptido`
- `agua bacterio`
- `cuánto bac water`
- `cómo calculo (las unidades|la dosis del vial)`

**English patterns:**
- `how (do i|to) reconstitute`
- `how (do i|to) mix (the )?peptide`
- `bacteriostatic water`
- `how much bac water`
- `how (do i|to) calculate (units|vial dose)`

**Canned response (Spanish):**
> Reconstituir y calcular dosis de péptidos no es algo con lo que te pueda ayudar. Eso es trabajo de un farmacéutico licenciado o tu médico. Si estás considerando una farmacia compuesta, asegúrate de que sea 503A licenciada en EE.UU. y que ellos preparen el producto listo para inyectar.

**Canned response (English):**
> Reconstituting and calculating peptide doses isn't something I can help with. That's work for a licensed pharmacist or your doctor. If you're considering a compounding pharmacy, make sure it's a US-licensed 503A and that they prep the product ready-to-inject.

---

### 5. EXPIRED_MED — using expired medication

**Spanish patterns:**
- `(pluma|vial|jeringa|medicamento|inyección) (vencid[ao]|caducad[ao]|expirad[ao])`
- `expiró (hace|el)`
- `puedo usar.*vencid[ao]`

**English patterns:**
- `(pen|vial|syringe|medication|injection) (expired|out of date)`
- `expired (a|some) (months?|weeks?) ago`
- `can i use.*expired`

**Canned response (Spanish):**
> No uses medicación vencida. La potencia y la esterilidad ya no están garantizadas, y los GLP-1 son sensibles a la temperatura y al tiempo. Habla con tu farmacéutico o médico sobre cómo conseguir un reemplazo. Si tu farmacia es la del seguro, a veces hacen excepciones.

**Canned response (English):**
> Don't use expired medication. Potency and sterility aren't guaranteed anymore, and GLP-1s are sensitive to temperature and time. Talk to your pharmacist or doctor about a replacement. If you're using insurance, they sometimes make exceptions.

---

## Implementation notes for Code

- Match patterns case-insensitively
- For Spanish, accept both with and without accents (`náuseas` and `nauseas`, `inyección` and `inyeccion`)
- Run all categories — return the FIRST match, with `crisis` always taking priority (check it first regardless of order in code)
- Log every guardrail hit to `coach_messages` with a flag, so we can audit later
- Do NOT count guardrail-hit messages against the user's daily quota (they didn't get a real coach answer, so don't bill them for it)

## Adding new patterns over time

When real users send messages that should have been blocked but weren't, add the pattern here. Keep this file as the source of truth — Code should read THIS file (not the .ts file) when adding new categories, so the .md and .ts stay in sync.
