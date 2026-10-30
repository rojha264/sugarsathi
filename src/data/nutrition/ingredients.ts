/**
 * Raw ingredients, per 100 g edible portion (per 100 ml for drinks).
 * carb = available carbohydrate (fiber excluded), as used for diabetes carb counting.
 * Sources: IFCT 2017 (Longvah et al., ICMR-NIN) by food code; USDA FoodData Central
 * (SR Legacy) by description; label averages where marked. See SOURCES.md.
 * Values transcribed from the published tables; no third-party code is bundled.
 */
export type Nutrients = { carb: number; protein: number; fat: number; fiber: number; alc?: number };
export type Ingredient = Nutrients & { src: string };

const I = (src: string, carb: number, protein: number, fat: number, fiber: number, alc?: number): Ingredient => ({ src, carb, protein, fat, fiber, alc });

export const INGREDIENTS = {
  // Cereals and millets
  atta: I('IFCT A019 Wheat flour, atta', 64.17, 10.57, 1.53, 11.36),
  maida: I('IFCT A018 Wheat flour, refined', 74.27, 10.36, 0.76, 2.76),
  sooji: I('IFCT A022 Wheat, semolina', 68.43, 11.38, 0.74, 9.72),
  rice: I('IFCT A015 Rice, raw, milled', 78.24, 7.94, 0.52, 2.81),
  brownrice: I('IFCT A013 Rice, raw, brown', 74.8, 9.16, 1.24, 4.43),
  poha: I('IFCT A011 Rice, flakes', 76.75, 7.44, 1.14, 3.46),
  jowar: I('IFCT A005 Jowar', 67.68, 9.97, 1.73, 10.22),
  bajra: I('IFCT A003 Bajra', 61.78, 10.96, 5.43, 11.49),
  ragi: I('IFCT A010 Ragi', 66.82, 7.16, 1.92, 11.18),
  maize: I('IFCT A006 Maize, dry', 64.77, 8.8, 3.77, 12.24),
  // Pulses
  toor: I('IFCT B021 Red gram, dal', 55.23, 21.7, 1.56, 9.06),
  moong: I('IFCT B010 Green gram, dal', 52.59, 23.88, 1.35, 9.37),
  chanadal: I('IFCT B001 Bengal gram, dal', 46.72, 21.55, 5.31, 15.15),
  urad: I('IFCT B003 Black gram, dal', 51, 23.06, 1.69, 11.93),
  masoor: I('IFCT B013 Lentil, dal', 52.53, 24.35, 0.75, 10.43),
  chana: I('IFCT B002 Bengal gram, whole', 39.56, 18.77, 5.11, 25.22),
  rajma: I('IFCT B020 Rajmah, red', 48.61, 19.91, 1.77, 16.57),
  drypeas: I('IFCT B017 Peas, dry', 48.93, 20.43, 1.89, 17.01),
  soya: I('IFCT B024 Soya bean, brown', 12.79, 35.58, 19.82, 21.55),
  // Vegetables
  potato: I('IFCT F006 Potato, brown skin', 14.89, 1.54, 0.23, 1.71),
  colocasia: I('IFCT F004 Colocasia', 17.85, 3.31, 0.17, 3.22),
  cauli: I('IFCT D036 Cauliflower', 2.03, 2.15, 0.44, 3.71),
  lauki: I('IFCT D007 Bottle gourd', 1.68, 0.53, 0.13, 2.12),
  ashgourd: I('IFCT D001 Ash gourd', 2.84, 0.79, 0.14, 3.37),
  pumpkin: I('IFCT D066 Pumpkin, orange', 4, 0.84, 0.16, 2.56),
  bhindi: I('IFCT D056 Ladies finger', 3.62, 2.08, 0.22, 4.08),
  baingan: I('IFCT D010 Brinjal', 3.49, 1.77, 0.39, 3.57),
  karela: I('IFCT D004 Bitter gourd', 2.82, 1.44, 0.24, 3.78),
  tinda: I('IFCT D073 Tinda, tender', 1.9, 1.02, 0.17, 2),
  cabbage: I('IFCT C015 Cabbage, green', 3.25, 1.36, 0.12, 2.76),
  carrot: I('IFCT F002 Carrot, orange', 5.55, 0.95, 0.47, 4.18),
  cucumber: I('IFCT D043 Cucumber, green', 3.48, 0.71, 0.16, 2.14),
  spinach: I('IFCT C033 Spinach', 2.05, 2.14, 0.64, 2.38),
  mustardleaf: I('IFCT C026 Mustard leaves', 2.41, 3.52, 0.51, 3.92),
  peas: I('IFCT D061 Peas, fresh', 11.88, 7.25, 0.13, 6.32),
  onion: I('IFCT G017 Onion, big', 9.56, 1.5, 0.24, 2.45),
  tomato: I('IFCT D076 Tomato, ripe', 2.71, 0.9, 0.47, 1.77),
  methiseed: I('IFCT G026 Fenugreek seeds', 10.57, 25.41, 5.72, 47.55),
  coconut: I('IFCT H007 Coconut, kernel, fresh', 6.3, 3.84, 41.38, 10.42),
  // Fruit
  apple: I('IFCT E001 Apple', 13.11, 0.29, 0.64, 2.59),
  guava: I('IFCT E028 Guava, white flesh', 5.13, 1.44, 0.32, 8.59),
  banana: I('IFCT E012 Banana, ripe, robusta', 23.63, 1.23, 0.33, 1.94),
  lemon: I('IFCT E033 Lemon, juice', 0, 0.41, 0.75, 0),
  // Nuts, dairy, eggs, meat, fish
  peanut: I('IFCT H012 Ground nut', 17.27, 23.65, 39.63, 10.38),
  makhana: I('NIN 1989 Lotus seed, dry (makhana)', 76.9, 9.7, 0.1, 7.6),
  paneer: I('IFCT L003 Paneer', 12.41, 18.86, 14.78, 0),
  milk: I('IFCT L002 Milk, whole, cow', 4.94, 3.26, 4.48, 0),
  khoa: I('IFCT L004 Khoa', 16.53, 16.34, 20.62, 0),
  curd: I('USDA FDC Yogurt, plain, whole milk', 4.66, 3.47, 3.25, 0),
  egg: I('IFCT M004 Egg, whole, boiled', 0, 13.43, 10.54, 0),
  chicken: I('IFCT N002 Chicken, thigh, skinless', 0, 18.18, 14.23, 0),
  chickenbreast: I('IFCT N003 Chicken, breast, skinless', 0, 21.81, 9, 0),
  mutton: I('IFCT O001 Goat, shoulder, meat', 0, 20.33, 11.94, 0),
  fish: I('IFCT S006 Rohu', 0, 19.71, 2.39, 0),
  prawn: I('IFCT S008 Prawns, big', 0, 19.24, 0.52, 0),
  // Fats and sugars
  oil: I('IFCT T012 Sunflower oil', 0, 0, 100, 0),
  ghee: I('IFCT T013 Ghee', 0, 0, 100, 0),
  butter: I('USDA FDC Butter, salted', 0.06, 0.85, 81.1, 0),
  sugar: I('USDA FDC Sugars, granulated', 99.98, 0, 0, 0),
  jaggery: I('IFCT I001 Jaggery, cane', 84.87, 1.85, 0.16, 0),
  // Drinks, per 100 ml. alc = grams of alcohol (7 kcal/g).
  spirit: I('USDA FDC Distilled spirits, 80 proof (whisky, rum, vodka, gin)', 0, 0, 0, 0, 33.4),
  beer: I('USDA FDC Beer, regular', 3.55, 0.46, 0, 0, 3.9),
  wine: I('USDA FDC Wine, table, red', 2.61, 0.07, 0, 0, 10.6),
  breezer: I('Label average, flavoured alcoholic cooler (4.8% ABV)', 12, 0, 0, 0, 3.8),
  cocktail: I('Estimate, sweet mixed cocktail', 14, 0, 0, 0, 6),
  cola: I('USDA FDC Carbonated beverage, cola', 10.36, 0.07, 0.02, 0),
  tonic: I('USDA FDC Carbonated beverage, tonic water', 8.8, 0, 0, 0),
  juice: I('Label average, packaged fruit drink (mango/orange)', 13.5, 0.2, 0, 0.1),
  energy: I('Label average, energy drink', 11, 0, 0, 0),
  zero: I('Water / soda / diet cola (no sugar)', 0, 0, 0, 0),
  // Packaged / fast food, per 100 g
  pizza: I('USDA FDC Pizza, cheese, regular crust', 33.3, 11.4, 10.4, 2.3),
  burger: I('USDA FDC Fast food hamburger, single patty, with condiments', 29.1, 12.9, 11.5, 1.4),
  instantnoodles: I('Label average, instant masala noodles (dry)', 60, 8.9, 16.9, 2.5),
  cake: I('USDA FDC Cake, pound / sponge, commercial', 52.6, 5.2, 15.3, 0.6),
  icecream: I('USDA FDC Ice cream, vanilla', 23.6, 3.5, 11, 0.7),
} satisfies Record<string, Ingredient>;

export type IngredientId = keyof typeof INGREDIENTS;
