# Food build report

Files: east.csv, nonveg.csv, north.csv, smoothies.csv, snacks.csv, south.csv, west.csv  
Dishes built: **493** · with a published carb reference: 39 · outliers (>20%): 18 · invalid rows: 0

**By region:** south 129 · north 126 · pan 113 · west 93 · east 63 · northeast 20  
**By app tab:** dalsabzi 164 · grain 128 · protein 56 · drink 44 · snack 41 · treat 25 · sweet 23 · starter 12  
**By diet:** veg 427 · nonveg 53 · egg 13

## Invalid rows (fix before import)
None.

## Computed vs published carbs (review)
| id | dish | computed g | published g | diff | source |
|---|---|---|---|---|---|
| chickensaag | Chicken saag | 5.9 | 7.7 | -23% | USDA FNDDS 2021-2023 FDC 2706437 "Chicken curry" (US recipe), per 100 g scaled to 150 g |
| hyderabadibiryani | Hyderabadi mutton biryani | 65.6 | 35.8 | 83% | USDA FNDDS 2021-2023 FDC 2706490 "Biryani with meat" (US recipe), per 100 g scaled to 320 g |
| lucknowibiryani | Lucknowi mutton biryani | 64.1 | 33.6 | 91% | USDA FNDDS 2021-2023 FDC 2706490 "Biryani with meat" (US recipe), per 100 g scaled to 300 g |
| macherjhol | Macher jhol | 7.4 | 9.5 | -22% | USDA FNDDS 2021-2023 FDC 2706460 "Fish curry" (US recipe), per 100 g scaled to 180 g |
| rohucurry | Rohu fish curry | 6.6 | 9.5 | -31% | USDA FNDDS 2021-2023 FDC 2706460 "Fish curry" (US recipe), per 100 g scaled to 180 g |
| meencurry | Kerala meen curry | 7 | 8.9 | -21% | USDA FNDDS 2021-2023 FDC 2706460 "Fish curry" (US recipe), per 100 g scaled to 170 g |
| kalachana | Kala chana masala | 19.6 | 27.6 | -29% | USDA FNDDS 2021-2023 FDC 2707415 "Chickpeas, from dried, fat added" (US recipe), per 100 g scaled to 150 g |
| sabutmasoor | Sabut masoor dal | 16.8 | 13.4 | 25% | USDA FNDDS 2021-2023 FDC 2707431 "Lentil curry" (US recipe), per 100 g scaled to 150 g |
| ravaidli | Rava idli | 13.5 | 9.6 | 41% | USDA FNDDS 2021-2023 FDC 2708346 "Idli" (US recipe), per 100 g scaled to 50 g |
| ragiidli | Ragi idli | 13.9 | 8.6 | 62% | USDA FNDDS 2021-2023 FDC 2708346 "Idli" (US recipe), per 100 g scaled to 45 g |
| kanchipuramidli | Kanchipuram idli | 15.7 | 11.5 | 37% | USDA FNDDS 2021-2023 FDC 2708346 "Idli" (US recipe), per 100 g scaled to 60 g |
| thatteidli | Thatte idli | 34.4 | 23 | 50% | USDA FNDDS 2021-2023 FDC 2708346 "Idli" (US recipe), per 100 g scaled to 120 g |
| ravakichdi | Rava kichdi | 37.1 | 25 | 48% | USDA FNDDS 2021-2023 FDC 2709128 "Upma" (US recipe), per 100 g scaled to 200 g |
| semiyaupma | Semiya upma | 38.2 | 22.5 | 70% | USDA FNDDS 2021-2023 FDC 2709128 "Upma" (US recipe), per 100 g scaled to 180 g |
| arisiupma | Arisi upma | 45.3 | 25 | 81% | USDA FNDDS 2021-2023 FDC 2709128 "Upma" (US recipe), per 100 g scaled to 200 g |
| southvegbiryani | South Indian veg biryani | 63.5 | 50.1 | 27% | USDA FNDDS 2021-2023 FDC 2708985 "Biryani with vegetables" (US recipe), per 100 g scaled to 300 g |
| vegkurma | Vegetable kurma | 14.6 | 10.5 | 39% | USDA FNDDS 2021-2023 FDC 2710067 "Vegetable curry" (US recipe), per 100 g scaled to 150 g |
| amti | Amti | 23.1 | 17.5 | 32% | USDA FNDDS 2021-2023 FDC 2707427 "Dal" (US recipe), per 100 g scaled to 150 g |

## Other things to check
- dalbaatichurma: 1158 kcal per serving
- IFCT paneer (L003) lists 12.4 g carbs/100 g, higher than most labels (~3–4 g); 13 dishes use it: chhanardalna, kadhaipaneer, shahipaneer, malaikofta, paneerbhurji, chamankaliya, paneerdopyaza, navratankorma, paneerparatha, paneerroll, rasmalai, sandesh, chhenapoda
