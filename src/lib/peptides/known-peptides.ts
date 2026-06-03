export const KNOWN_PEPTIDES = [
  // GLP-1 / metabolic
  {
    name: "Semaglutida",
    aliases: ["Ozempic", "Wegovy"],
    category: "glp1",
    defaultFreq: "weekly",
    units: ["mg"],
  },
  {
    name: "Tirzepatida",
    aliases: ["Mounjaro", "Zepbound"],
    category: "glp1",
    defaultFreq: "weekly",
    units: ["mg"],
  },
  {
    name: "Retatrutida",
    aliases: [],
    category: "glp1",
    defaultFreq: "weekly",
    units: ["mg"],
  },
  {
    name: "Liraglutida",
    aliases: ["Saxenda", "Victoza"],
    category: "glp1",
    defaultFreq: "daily",
    units: ["mg"],
  },
  {
    name: "Cagrilintida",
    aliases: [],
    category: "glp1",
    defaultFreq: "weekly",
    units: ["mg"],
  },
  // Healing / recovery
  {
    name: "BPC-157",
    aliases: [],
    category: "healing",
    defaultFreq: "daily",
    units: ["mcg", "mg"],
  },
  {
    name: "TB-500",
    aliases: ["Timosina beta-4"],
    category: "healing",
    defaultFreq: "twice-weekly",
    units: ["mg"],
  },
  {
    name: "GHK-Cu",
    aliases: ["Tripéptido de cobre"],
    category: "skin-healing",
    defaultFreq: "daily",
    units: ["mg", "mcg"],
  },
  // Growth hormone / GH-related
  {
    name: "Ipamorelin",
    aliases: [],
    category: "gh",
    defaultFreq: "daily",
    units: ["mcg"],
  },
  {
    name: "CJC-1295",
    aliases: [],
    category: "gh",
    defaultFreq: "daily",
    units: ["mcg"],
  },
  {
    name: "Sermorelin",
    aliases: [],
    category: "gh",
    defaultFreq: "daily",
    units: ["mcg"],
  },
  {
    name: "Tesamorelin",
    aliases: [],
    category: "gh",
    defaultFreq: "daily",
    units: ["mg"],
  },
  // Skin / tanning
  {
    name: "Melanotan II",
    aliases: ["MT-2"],
    category: "skin",
    defaultFreq: "daily",
    units: ["mg", "mcg"],
  },
  // Cognitive / nootropic
  {
    name: "Semax",
    aliases: [],
    category: "nootropic",
    defaultFreq: "daily",
    units: ["mg"],
  },
  {
    name: "Selank",
    aliases: [],
    category: "nootropic",
    defaultFreq: "daily",
    units: ["mg"],
  },
] as const;

export type KnownPeptide = (typeof KNOWN_PEPTIDES)[number];
export type PeptideDefaultFreq = KnownPeptide["defaultFreq"];
export type PeptideUnit = KnownPeptide["units"][number];
