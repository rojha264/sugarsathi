# Nutrition data: sources and method

For the dietitian review. Every number in the app comes from the files in this folder.

## Method

1. **Ingredients** ([ingredients.ts](ingredients.ts)): values per 100 g of edible portion (per 100 ml for drinks).
   - **IFCT 2017**: Longvah T., Ananthan R., Bhaskarachary K., Venkaiah K. *Indian Food Composition Tables 2017*, ICMR-National Institute of Nutrition, Hyderabad. Each ingredient is cited by its food code (for example `A019` = wheat flour, atta).
   - **USDA FoodData Central (SR Legacy)** is used where IFCT has no entry: curd/yogurt, butter, sugar, spirits, beer, wine, cola, tonic, pizza, burger, cake, ice cream.
   - **NIN 1989**, *Nutritive Value of Indian Foods*: makhana.
   - **Label averages** of common Indian brands: breezer, packaged fruit drink, energy drink, instant noodles. The cocktail is an estimate.
2. **Carbohydrate** is *available* carbohydrate. IFCT reports it as "by difference" (CHOAVLDF), and it excludes dietary fibre, which is listed separately. This is the figure people with diabetes count.
3. **Energy** is calculated from the macros: 4 × carbs + 4 × protein + 9 × fat + 2 × fibre + 7 × alcohol. IFCT's own energy column is not used because some entries are missing (ghee) or don't agree with the macros (chicken leg).
4. **Dishes** ([recipes.ts](recipes.ts)): a typical home recipe for one standard portion, made of raw ingredient weights. The served weight `g` is shown in the app.
   - Standard portions:
     - roti: 40 g
     - katori: 150 g cooked
     - curry pieces: 2 per portion
     - peg: 30 ml
     - beer bottle: 330 ml
     - wine glass: 150 ml
     - glass: 200 ml
   - Raw-to-cooked water changes are already captured by the served weight. Nutrients come from the raw ingredients.
5. Home recipes vary by roughly ±20%. The app says this on every food's info sheet.

## Spot checks (tested in `src/logic/__tests__/nutrition.test.ts`)

| Food | Portion | App | Reference |
|---|---|---|---|
| Roti | 40 g | 19 g carbs | 15–20 g |
| Rice, cooked | 150 g | 39 g carbs | 42 g (USDA, 28 g/100 g) |
| Toor dal | 150 g | 7 g protein | ~7 g |
| Idli | 40 g | 8.6 g carbs | ~8 g |
| Boiled egg | 50 g | 6.7 g protein | 6.3–6.5 g |
| Beer | 330 ml | 11.7 g carbs | ~12 g |
| Cola | 200 ml | 21 g carbs | ~21 g |

## Guideline numbers (also need sign-off)

- **Plate method**: ½ vegetables, ¼ protein, ¼ grain/starch (ICMR-NIN *Dietary Guidelines for Indians* 2024; ADA). Pulses count as protein. Potato dishes count as starch.
- **Per-meal carbs**: 45–60 g, snack ≤ 20 g (ADA carb-counting range). The low end applies when sugar is already high.
- **Fibre**: 25–40 g/day (ICMR-NIN). **Protein**: about 60 g/day for an adult (sample).
- **Alcohol**: no more than 1–2 standard drinks/day, never on an empty stomach, check sugar at bedtime (ADA).

## To review

- Recipe weights for regional dishes.
- Oil amounts (households often use more).
- Sweet syrups.
- Whether to replace the label averages with specific brands.
