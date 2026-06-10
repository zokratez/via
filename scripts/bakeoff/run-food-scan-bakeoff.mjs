#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const MODEL = "gpt-4.1-mini";
const ESTIMATED_COST_PER_SCAN_USD = 0.003;
const MAX_CALLS = 100;
const MAX_ESTIMATED_COST_USD = 1;
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const MANIFEST_PATH = path.join(SCRIPT_DIR, "manifest.json");
const PHOTOS_DIR = path.join(SCRIPT_DIR, "photos");
const REPORTS_DIR = path.join(SCRIPT_DIR, "reports");
const REPORT_PATH = path.join(
  REPORTS_DIR,
  `${new Date().toISOString().slice(0, 10)}-latin-food-scan-bakeoff.md`,
);

const FOOD_SCAN_JSON_SCHEMA = {
  name: "food_scan",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["calories", "protein", "carbs", "fat", "confidence", "detectedFoods"],
    properties: {
      calories: { type: "number" },
      protein: { type: "number" },
      carbs: { type: "number" },
      fat: { type: "number" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      detectedFoods: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "name",
            "calories",
            "protein",
            "carbs",
            "fat",
            "confidence",
            "quantity",
            "unit",
            "servingDescription",
            "fdcId",
          ],
          properties: {
            name: { type: "string" },
            calories: { type: "number" },
            protein: { type: "number" },
            carbs: { type: "number" },
            fat: { type: "number" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            quantity: { type: ["number", "null"] },
            unit: { type: ["string", "null"] },
            servingDescription: { type: ["string", "null"] },
            fdcId: { type: ["number", "null"] },
          },
        },
      },
    },
  },
  strict: true,
};

function usage() {
  console.log(`Usage:
  OPENAI_API_KEY=... node scripts/bakeoff/run-food-scan-bakeoff.mjs

Options:
  --limit=N       Run only the first N manifest photos.
  --dry-run       Validate manifest/photo presence without calling OpenAI.
  --skip-missing  Skip manifest photos that are not present locally.

Photos:
  Put Sam-owned or licensed files in scripts/bakeoff/photos/ matching manifest.json.
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { dryRun: false, limit: undefined, skipMissing: false };
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--skip-missing") {
      options.skipMissing = true;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Invalid --limit value: ${arg}`);
      }
      options.limit = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function mimeFor(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  throw new Error(`Unsupported image type for ${filename}. Use jpg, png, or webp.`);
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function foodNames(result) {
  return (result.detectedFoods ?? []).map((food) => food.name).filter(Boolean);
}

function fuzzyDishMatch(expectedDishNames, detectedNames) {
  const detected = normalizeText(detectedNames.join(" "));
  const expected = expectedDishNames.map(normalizeText);
  const matched = expected.filter((name) => {
    if (!name) return false;
    if (detected.includes(name)) return true;
    const tokens = name.split(" ").filter((token) => token.length > 2);
    if (tokens.length === 0) return false;
    const hitCount = tokens.filter((token) => detected.includes(token)).length;
    return hitCount / tokens.length >= 0.6;
  });

  return {
    pass: matched.length > 0,
    matched,
  };
}

function scoreKcal(calories, referenceKcalRange) {
  const [min, max] = referenceKcalRange;
  const lower = min * 0.75;
  const upper = max * 1.25;
  return {
    pass: calories >= lower && calories <= upper,
    lower,
    upper,
  };
}

function scoreItemCount(actual, expected) {
  return {
    pass: actual === expected,
    delta: actual - expected,
  };
}

function outputText(payload) {
  return (
    payload.output_text ??
    payload.output?.flatMap((item) => item.content ?? []).find((content) => content.text)?.text ??
    ""
  );
}

function roundMacro(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number * 10) / 10) : 0;
}

function clampConfidence(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
}

function normalizeFood(value) {
  const food = value ?? {};
  return {
    name: typeof food.name === "string" ? food.name.slice(0, 120) : "food",
    calories: roundMacro(food.calories),
    protein: roundMacro(food.protein),
    carbs: roundMacro(food.carbs),
    fat: roundMacro(food.fat),
    confidence: clampConfidence(food.confidence),
    quantity: typeof food.quantity === "number" ? food.quantity : undefined,
    unit: typeof food.unit === "string" ? food.unit.slice(0, 40) : undefined,
    servingDescription:
      typeof food.servingDescription === "string" ? food.servingDescription.slice(0, 180) : undefined,
    fdcId: typeof food.fdcId === "number" ? food.fdcId : undefined,
  };
}

function normalizeResult(value) {
  const parsed = value ?? {};
  const detectedFoods = Array.isArray(parsed.detectedFoods)
    ? parsed.detectedFoods.map(normalizeFood)
    : [];
  return {
    calories: roundMacro(parsed.calories),
    protein: roundMacro(parsed.protein),
    carbs: roundMacro(parsed.carbs),
    fat: roundMacro(parsed.fat),
    confidence: clampConfidence(parsed.confidence),
    detectedFoods,
    provider: "openai",
    model: MODEL,
  };
}

async function analyzePhoto({ apiKey, photoPath, mimeType }) {
  const bytes = await readFile(photoPath);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: "system",
          content:
            "You estimate food macros from meal photos for a nutrition journal. Return careful estimates, not medical advice.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Identify visible foods and estimate calories, protein, carbs, and fat. Use Spanish food names when obvious. If uncertain, lower confidence instead of inventing precision.",
            },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${bytes.toString("base64")}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          ...FOOD_SCAN_JSON_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI ${response.status}: ${body.slice(0, 1600)}`);
  }

  const payload = await response.json();
  const text = outputText(payload);
  if (!text) throw new Error("OpenAI returned no output_text.");
  return normalizeResult(JSON.parse(text));
}

function percent(numerator, denominator) {
  if (!denominator) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function markdownEscape(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function buildReport({ manifest, rows, actualCalls, estimatedCost }) {
  const total = rows.length;
  const dishPass = rows.filter((row) => row.dish.pass).length;
  const countPass = rows.filter((row) => row.itemCount.pass).length;
  const kcalPass = rows.filter((row) => row.kcal.pass).length;
  const confidencePass = rows.filter((row) => row.confidence.pass).length;
  const allPass = rows.filter(
    (row) => row.dish.pass && row.itemCount.pass && row.kcal.pass && row.confidence.pass,
  ).length;
  const avgConfidence =
    rows.reduce((sum, row) => sum + row.result.confidence, 0) / Math.max(rows.length, 1);

  const verdict =
    kcalPass / Math.max(total, 1) >= 0.8 && dishPass / Math.max(total, 1) >= 0.8
      ? "PASS for v1: gpt-4.1-mini is accurate enough to keep as the cheapest-that-passes provider."
      : "REVIEW: gpt-4.1-mini did not clear the v1 bar. Test a stronger model or improve prompt/grounding before deciding.";

  const lines = [
    "# SAM-66 Latin Food Scanner Bake-Off",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Model: ${MODEL}`,
    `Manifest: ${manifest.name}`,
    `Actual OpenAI calls: ${actualCalls}`,
    `Estimated cost: $${estimatedCost.toFixed(3)} (${actualCalls} x $${ESTIMATED_COST_PER_SCAN_USD.toFixed(3)})`,
    "",
    "## Aggregate",
    "",
    `- Dish identification: ${dishPass}/${total} (${percent(dishPass, total)})`,
    `- Item count exact: ${countPass}/${total} (${percent(countPass, total)})`,
    `- Calories inside +/-25% guard band: ${kcalPass}/${total} (${percent(kcalPass, total)})`,
    `- Confidence reported: ${confidencePass}/${total} (${percent(confidencePass, total)})`,
    `- All checks pass: ${allPass}/${total} (${percent(allPass, total)})`,
    `- Average confidence: ${avgConfidence.toFixed(2)}`,
    "",
    `## Verdict`,
    "",
    verdict,
    "",
    "## Per-Photo Results",
    "",
    "| Photo | Expected | Detected | kcal | kcal pass | Items | Item pass | Confidence | Dish pass |",
    "| --- | --- | --- | ---: | --- | ---: | --- | ---: | --- |",
  ];

  for (const row of rows) {
    lines.push(
      [
        markdownEscape(row.filename),
        markdownEscape(row.expectedDishNames.join(", ")),
        markdownEscape(foodNames(row.result).join(", ")),
        row.result.calories,
        row.kcal.pass ? "yes" : `no (${Math.round(row.kcal.lower)}-${Math.round(row.kcal.upper)})`,
        `${row.result.detectedFoods.length}/${row.expectedItemCount}`,
        row.itemCount.pass ? "yes" : `no (${row.itemCount.delta >= 0 ? "+" : ""}${row.itemCount.delta})`,
        row.result.confidence.toFixed(2),
        row.dish.pass ? "yes" : "no",
      ].join(" | "),
    );
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArgs();
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const manifestPhotos = manifest.photos.slice(0, options.limit ?? manifest.photos.length);
  const missing = manifestPhotos
    .map((photo) => ({ filename: photo.filename, filePath: path.join(PHOTOS_DIR, photo.filename) }))
    .filter((photo) => !existsSync(photo.filePath));
  const photos = options.skipMissing
    ? manifestPhotos.filter((photo) => existsSync(path.join(PHOTOS_DIR, photo.filename)))
    : manifestPhotos;
  const projectedCost = photos.length * ESTIMATED_COST_PER_SCAN_USD;

  if (photos.length > MAX_CALLS) {
    throw new Error(`Refusing to run ${photos.length} calls. Max is ${MAX_CALLS}.`);
  }
  if (projectedCost > MAX_ESTIMATED_COST_USD) {
    throw new Error(
      `Refusing projected cost $${projectedCost.toFixed(3)}. Max is $${MAX_ESTIMATED_COST_USD}.`,
    );
  }

  if (missing.length > 0) {
    const label = options.skipMissing ? "Skipping missing bake-off photos:" : "Missing bake-off photos:";
    console.error("Missing bake-off photos:");
    for (const photo of missing) console.error(`- ${photo.filename}`);
    if (!options.skipMissing) {
      console.error(`\nPlace images in: ${PHOTOS_DIR}`);
      process.exit(2);
    }
    console.error(`\n${label} ${missing.length}. Running ${photos.length} available photos.`);
  }

  if (options.dryRun) {
    console.log(
      `Dry run OK: ${photos.length} photos present. Projected cost: $${projectedCost.toFixed(3)}.`,
    );
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for the bake-off run.");
  }

  const rows = [];
  let actualCalls = 0;
  for (const photo of photos) {
    const photoPath = path.join(PHOTOS_DIR, photo.filename);
    const mimeType = mimeFor(photo.filename);
    console.log(`Analyzing ${photo.filename} (${actualCalls + 1}/${photos.length})...`);
    const result = await analyzePhoto({ apiKey, photoPath, mimeType });
    actualCalls += 1;
    const detectedNames = foodNames(result);
    rows.push({
      ...photo,
      result,
      dish: fuzzyDishMatch(photo.expectedDishNames, detectedNames),
      itemCount: scoreItemCount(result.detectedFoods.length, photo.expectedItemCount),
      kcal: scoreKcal(result.calories, photo.referenceKcalRange),
      confidence: { pass: result.confidence >= 0 && result.confidence <= 1 },
    });
  }

  const estimatedCost = actualCalls * ESTIMATED_COST_PER_SCAN_USD;
  await mkdir(REPORTS_DIR, { recursive: true });
  const report = buildReport({ manifest, rows, actualCalls, estimatedCost });
  await writeFile(REPORT_PATH, report, "utf8");
  console.log(`\nReport written: ${REPORT_PATH}`);
  console.log(`Estimated cost: $${estimatedCost.toFixed(3)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
