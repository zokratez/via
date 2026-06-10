# PACO Scanner Moat

Source of truth mirrored from Linear: `PACO Scanner — Product Direction & Moat: "Honest food scanner for GLP-1 journeys"`  
Linear slug: `e303a2d187de`  
Mirrored: 2026-06-09

## Thesis

PACO is the honest food scanner for Spanish-first GLP-1 / peptide journeys. The scanner gets users in; the loop keeps them.

## Moat priorities

1. Two-tap correction: wrong guesses must be painless to fix.
2. Truth layer: show confidence and uncertainty instead of fake precision.
3. USDA/barcode/label grounding: verified data beats AI-invented macros.
4. GLP-1 / peptide-aware context: protein, hydration, fiber, appetite, dose-day patterns.
5. Calories in vs active energy on native through HealthKit.
6. Personal pattern memory: frequent foods, mealtimes, coffee, dose-day behavior.
7. El Fantasma uses logs to become alive and contextual.
8. Source links and receipts where available.

## Build order

1. Correction UI.
2. Barcode + USDA grounding.
3. Save corrected scan to `food_photos`.
4. Recents / favorites / learned meals.
5. HealthKit calories-in/out context.
6. El Fantasma uses food data to coach patterns.

## Bake-off rule

The bake-off must use real Latin/Mexican/Spanish food photos: tacos, mole, pozole, tamales, pupusas, mixed plates, bad lighting, and weird portions.

