# Dish recipe files (`dishes/*.csv`)

Each file is one batch of dishes. `build.ts` turns them into foods with nutrition computed from raw ingredients.

## Columns (header must be exactly this, in this order)

```
id,nameEn,nameHi,aliases,emoji,group,role,diet,regions,slots,unit,measure,servedG,recipe,refCarbs,refSource,gi,giValue,giSource,notes
```

| Column | Rule |
|---|---|
| id | lowercase letters and digits only (e.g. `rajmachawal`). Unique across all files and not in `existing-ids.txt`. |
| nameEn | Common English or Hinglish name ("Rajma chawal"). |
| nameHi | Name in Devanagari ("राजमा चावल"). |
| aliases | Other names people type or say, `|`-separated, lowercase ("rajma rice|kidney beans rice"). |
| emoji | One emoji. |
| group | App tab: `starter` (salads, soups, raw veg, sprouts), `grain` (roti, rice, breakfast staples), `dalsabzi` (dal, curry, sabzi), `protein` (paneer, egg, chicken, fish, soya dishes), `snack`, `drink`, `sweet`, `treat` (fried / fast food). |
| role | Plate method: `veg` (vegetable dishes, salad), `protein` (dal, pulses, paneer, egg, meat, fish), `grain` (roti, rice, idli, potato-heavy, poha), `other` (sweets, drinks, mixed snacks). |
| diet | `veg` (dairy allowed), `egg`, `nonveg`. |
| regions | `north`, `south`, `east`, `west`, `northeast`, `pan`; `|`-separated. |
| slots | Meals it suits: `breakfast`, `lunch`, `dinner`, `snack`; `|`-separated. |
| unit | `piece`, `katori` (150 g cooked), `glass` (200 ml), `plate`, `pcs` (2 curry pieces). |
| measure | Household measure people understand: "1 medium (40 g)", "1 katori (150 g)", "2 pieces". |
| servedG | Cooked weight of ONE standard serving in g (ml for drinks). |
| recipe | Raw ingredient weights for that ONE serving: `CODE:grams|CODE:grams`. Use IFCT codes from `ingredients-ifct.csv` (e.g. `A019:30` atta) or ids from `ingredients-usda.csv` (`curd`, `sugar`, `salt`, `bread`…). Always include oil/ghee and salt the way a typical home cook uses them. Do not list water. Spices under 1 g may be left out. |
| refCarbs | Available carbs per serving from a published reference, ONLY if you are confident of the number (INDB 2024, NIN "Nutritive Value of Indian Foods", USDA FDC, diabetes exchange lists). Otherwise leave blank. Never guess. |
| refSource | Short citation for refCarbs. |
| gi | `low` (≤55), `med` (56–69), `high` (≥70). |
| giValue | Only if a published GI exists (Atkinson et al., Diabetes Care 2021; Indian GI studies such as Henry et al. 2008, Radhika et al. 2010). Otherwise blank. |
| giSource | Citation for giValue, or `estimate` when the band is judged from the main carb ingredient. |
| notes | Optional: recipe assumptions (e.g. "restaurant style, more oil"). |

## Rules
- Typical Indian HOME recipe and portion, not restaurant (unless the dish is a restaurant / street dish).
- Raw weights: dal and rice raw (30 g raw toor dal ≈ 1 katori cooked dal; 50 g raw rice ≈ 150 g cooked).
- Typical salt: ~1 g per katori of dal/sabzi, ~0.5 g per roti/paratha when salted, more for pickles/snacks.
- Typical oil: 3–5 g per katori sabzi/dal tadka, 3 g per plain paratha side, deep-fried items absorb ~10–15% of their weight.
- Each dish needs at least one ingredient that is not salt, oil or water.
