import { eats } from '@shared/diet';
import type { Diet } from '@/types';
import { nutritionFor } from './nutrition/compute';

export type FoodGroup = 'starter' | 'grain' | 'dalsabzi' | 'protein' | 'snack' | 'drink' | 'sweet' | 'treat' | 'alcohol' | 'mixer';
export type GI = 'low' | 'med' | 'high';
/** pcs = curry pieces, 2 per standard portion; peg = 30 ml; beer = 330 ml bottle. */
export type Unit = 'piece' | 'katori' | 'glass' | 'plate' | 'pcs' | 'peg' | 'beer' | 'wine';

/** Sample values per standard portion for the MVP demo. Replace with the dietitian-verified database. */
/** Where a food sits on the diabetes plate: ½ veg, ¼ protein, ¼ grain/starch. */
export type PlateRole = 'veg' | 'protein' | 'grain' | 'other';

type FoodBase = {
  id: string;
  e: string;
  n: { en: string; hi: string };
  diet: Diet;
  group: FoodGroup;
  gi: GI;
  unit: Unit;
  /** Standard drinks per portion (alcohol only). */
  std?: number;
  /** Sugary drink or mixer that spikes sugar. */
  sweet?: boolean;
  /**
   * Voice / search keywords. A spoken word matches if it starts with a keyword.
   * Multi-word phrases ("brown rice") win over single words ("rice").
   */
  kw: string[];
};

/** Per standard portion, computed from the recipe (see nutrition/). */
export type Food = FoodBase & {
  /** Served grams (ml for drinks). */
  g: number;
  /** Available carbs, g. */
  c: number;
  /** Protein, g. */
  p: number;
  /** Fiber, g. */
  f: number;
  fat: number;
  kcal: number;
  src: string[];
  role: PlateRole;
};

const F = (
  id: string, e: string, en: string, hi: string, diet: Diet, group: FoodGroup, gi: GI, unit: Unit, kw: string[],
): FoodBase => ({ id, e, n: { en, hi }, diet, group, gi, unit, kw });

const drink = (id: string, e: string, en: string, hi: string, unit: Unit, std: number, sweet: boolean, kw: string[]): FoodBase => ({
  ...F(id, e, en, hi, 'veg', 'alcohol', sweet ? 'high' : 'low', unit, kw),
  std,
  sweet,
});

const mixer = (id: string, e: string, en: string, hi: string, sweet: boolean, kw: string[]): FoodBase => ({
  ...F(id, e, en, hi, 'veg', 'mixer', sweet ? 'high' : 'low', 'glass', kw),
  sweet,
});

const BASE: FoodBase[] = [
  // Eat first: fiber and protein before the main meal slow the sugar rise.
  F('salad', '🥗', 'Salad', 'सलाद', 'veg', 'starter', 'low', 'plate', ['salad', 'सलाद']),
  F('cucumber', '🥒', 'Cucumber', 'खीरा', 'veg', 'starter', 'low', 'plate', ['cucumber', 'kheera', 'khira', 'खीरा']),
  F('sprouts', '🌱', 'Sprouts', 'अंकुरित', 'veg', 'starter', 'low', 'katori', ['sprouts', 'sprout', 'ankurit', 'अंकुरित', 'स्प्राउट']),
  F('chana', '🫘', 'Roasted chana', 'भुने चने', 'veg', 'starter', 'low', 'katori', ['roasted chana', 'bhuna chana', 'chana', 'भुने चने', 'भुना चना', 'चना', 'चने']),
  F('chaas', '🥤', 'Chaas', 'छाछ', 'veg', 'starter', 'low', 'glass', ['chaas', 'chhaas', 'chhachh', 'buttermilk', 'mattha', 'छाछ', 'मट्ठा']),
  F('soup', '🍲', 'Veg soup', 'सब्ज़ी सूप', 'veg', 'starter', 'low', 'katori', ['soup', 'सूप']),
  F('raita', '🍶', 'Raita', 'रायता', 'veg', 'starter', 'low', 'katori', ['raita', 'रायता']),
  F('methi', '💧', 'Methi water', 'मेथी पानी', 'veg', 'starter', 'low', 'glass', ['methi water', 'methi pani', 'methi', 'मेथी पानी', 'मेथी']),

  // Roti and rice.
  F('roti', '🫓', 'Roti', 'रोटी', 'veg', 'grain', 'med', 'piece', ['roti', 'chapati', 'chapatti', 'phulka', 'रोटी', 'रोटि', 'चपाती']),
  F('jowar', '🌾', 'Jowar roti', 'ज्वार रोटी', 'veg', 'grain', 'low', 'piece', ['jowar roti', 'jowar', 'ज्वार रोटी', 'ज्वार']),
  F('bajra', '🌾', 'Bajra roti', 'बाजरा रोटी', 'veg', 'grain', 'low', 'piece', ['bajra roti', 'bajre ki roti', 'bajra', 'बाजरा रोटी', 'बाजरे', 'बाजरा']),
  F('ragi', '🌾', 'Ragi roti', 'रागी रोटी', 'veg', 'grain', 'low', 'piece', ['ragi roti', 'ragi', 'nachni', 'रागी रोटी', 'रागी']),
  F('makki', '🌽', 'Makki roti', 'मक्की रोटी', 'veg', 'grain', 'med', 'piece', ['makki roti', 'makki', 'मक्की रोटी', 'मक्की']),
  F('bhakri', '🫓', 'Bhakri', 'भाकरी', 'veg', 'grain', 'low', 'piece', ['bhakri', 'भाकरी']),
  F('thepla', '🫓', 'Thepla', 'थेपला', 'veg', 'grain', 'med', 'piece', ['thepla', 'थेपला']),
  F('puri', '🟡', 'Puri', 'पूरी', 'veg', 'grain', 'high', 'piece', ['puri', 'poori', 'पूरी', 'पूड़ी']),
  F('naan', '🫓', 'Naan', 'नान', 'veg', 'grain', 'high', 'piece', ['naan', 'नान']),
  F('kulcha', '🫓', 'Kulcha', 'कुलचा', 'veg', 'grain', 'high', 'piece', ['kulcha', 'कुलचा']),
  F('bhatura', '🫓', 'Bhatura', 'भटूरा', 'veg', 'grain', 'high', 'piece', ['bhatura', 'bhature', 'भटूरा', 'भटूरे']),
  F('paratha', '🌯', 'Paratha', 'पराठा', 'veg', 'grain', 'high', 'piece', ['paratha', 'parantha', 'पराठा', 'परांठा']),
  F('alooparatha', '🌯', 'Aloo paratha', 'आलू पराठा', 'veg', 'grain', 'high', 'piece', ['aloo paratha', 'aloo ka paratha', 'आलू पराठा']),
  F('rice', '🍚', 'Rice', 'चावल', 'veg', 'grain', 'high', 'katori', ['rice', 'chawal', 'चावल']),
  F('brownrice', '🍚', 'Brown rice', 'ब्राउन चावल', 'veg', 'grain', 'med', 'katori', ['brown rice', 'brown chawal', 'ब्राउन चावल', 'ब्राउन राइस']),
  F('khichdi', '🥣', 'Khichdi', 'खिचड़ी', 'veg', 'grain', 'med', 'katori', ['khichdi', 'khichri', 'खिचड़ी', 'खिचड़ी']),
  F('pulao', '🍛', 'Pulao', 'पुलाव', 'veg', 'grain', 'high', 'katori', ['pulao', 'pulav', 'पुलाव']),
  F('vbiryani', '🍛', 'Veg biryani', 'वेज बिरयानी', 'veg', 'grain', 'high', 'plate', ['veg biryani', 'biryani', 'वेज बिरयानी', 'बिरयानी']),
  F('cbiryani', '🍛', 'Chicken biryani', 'चिकन बिरयानी', 'nonveg', 'grain', 'high', 'plate', ['chicken biryani', 'चिकन बिरयानी']),
  F('mbiryani', '🍛', 'Mutton biryani', 'मटन बिरयानी', 'nonveg', 'grain', 'high', 'plate', ['mutton biryani', 'मटन बिरयानी']),
  F('curdrice', '🍚', 'Curd rice', 'दही चावल', 'veg', 'grain', 'med', 'katori', ['curd rice', 'dahi chawal', 'दही चावल']),
  F('lemonrice', '🍋', 'Lemon rice', 'नींबू चावल', 'veg', 'grain', 'high', 'katori', ['lemon rice', 'नींबू चावल']),
  F('idli', '🍙', 'Idli', 'इडली', 'veg', 'grain', 'med', 'piece', ['idli', 'idly', 'इडली']),
  F('dosa', '🥞', 'Dosa', 'डोसा', 'veg', 'grain', 'high', 'piece', ['dosa', 'dosai', 'डोसा']),
  F('masaladosa', '🥞', 'Masala dosa', 'मसाला डोसा', 'veg', 'grain', 'high', 'piece', ['masala dosa', 'मसाला डोसा']),
  F('uttapam', '🥞', 'Uttapam', 'उत्तपम', 'veg', 'grain', 'med', 'piece', ['uttapam', 'uthappam', 'उत्तपम']),
  F('appam', '🥞', 'Appam', 'अप्पम', 'veg', 'grain', 'high', 'piece', ['appam', 'अप्पम']),
  F('pongal', '🥣', 'Pongal', 'पोंगल', 'veg', 'grain', 'med', 'katori', ['pongal', 'पोंगल']),
  F('poha', '🍛', 'Poha', 'पोहा', 'veg', 'grain', 'high', 'plate', ['poha', 'पोहा']),
  F('upma', '🥘', 'Upma', 'उपमा', 'veg', 'grain', 'med', 'plate', ['upma', 'उपमा']),

  // Dal and sabzi.
  F('dal', '🥣', 'Dal', 'दाल', 'veg', 'dalsabzi', 'low', 'katori', ['dal', 'daal', 'dhal', 'दाल']),
  F('dalmakhani', '🥣', 'Dal makhani', 'दाल मखनी', 'veg', 'dalsabzi', 'med', 'katori', ['dal makhani', 'daal makhani', 'दाल मखनी']),
  F('chanadal', '🥣', 'Chana dal', 'चना दाल', 'veg', 'dalsabzi', 'low', 'katori', ['chana dal', 'चना दाल']),
  F('moongdal', '🥣', 'Moong dal', 'मूंग दाल', 'veg', 'dalsabzi', 'low', 'katori', ['moong dal', 'मूंग दाल']),
  F('chole', '🫛', 'Chole / Rajma', 'छोले / राजमा', 'veg', 'dalsabzi', 'low', 'katori', ['chole', 'chhole', 'rajma', 'छोले', 'राजमा']),
  F('kadhi', '🍛', 'Kadhi', 'कढ़ी', 'veg', 'dalsabzi', 'med', 'katori', ['kadhi', 'karhi', 'कढ़ी']),
  F('sambar', '🍲', 'Sambar', 'सांभर', 'veg', 'dalsabzi', 'low', 'katori', ['sambar', 'sambhar', 'सांभर', 'सांबर']),
  F('rasam', '🍲', 'Rasam', 'रसम', 'veg', 'dalsabzi', 'low', 'katori', ['rasam', 'रसम']),
  F('chutney', '🥥', 'Chutney', 'चटनी', 'veg', 'dalsabzi', 'low', 'katori', ['chutney', 'चटनी']),
  F('sabzi', '🥦', 'Sabzi', 'सब्ज़ी', 'veg', 'dalsabzi', 'low', 'katori', ['sabzi', 'sabji', 'subzi', 'vegetable', 'सब्ज़ी', 'सब्जी']),
  F('aloo', '🥔', 'Aloo sabzi', 'आलू सब्ज़ी', 'veg', 'dalsabzi', 'high', 'katori', ['aloo sabzi', 'aloo ki sabzi', 'aloo', 'alu', 'potato', 'आलू सब्ज़ी', 'आलू']),
  F('aloogobhi', '🥦', 'Aloo gobhi', 'आलू गोभी', 'veg', 'dalsabzi', 'med', 'katori', ['aloo gobhi', 'aloo gobi', 'alu gobhi', 'आलू गोभी']),
  F('aloojhol', '🍲', 'Aloo jhol / rasa', 'आलू झोल / रसा', 'veg', 'dalsabzi', 'high', 'katori', ['aloo jhol', 'aloo ka jhol', 'aloo rasa', 'aloo tamatar', 'आलू झोल', 'आलू रसा', 'आलू का झोल']),
  F('aloomatar', '🫛', 'Aloo matar', 'आलू मटर', 'veg', 'dalsabzi', 'med', 'katori', ['aloo matar', 'आलू मटर']),
  F('lauki', '🥒', 'Ghiya / Lauki', 'घीया / लौकी', 'veg', 'dalsabzi', 'low', 'katori', ['ghiya', 'ghia', 'lauki', 'dudhi', 'bottle gourd', 'घीया', 'लौकी']),
  F('kaddu', '🎃', 'Petha / Kaddu sabzi', 'पेठा / कद्दू सब्ज़ी', 'veg', 'dalsabzi', 'med', 'katori', ['petha sabzi', 'petha ki sabzi', 'kaddu', 'pumpkin', 'पेठे की सब्ज़ी', 'कद्दू']),
  F('bhindi', '🫑', 'Bhindi', 'भिंडी', 'veg', 'dalsabzi', 'low', 'katori', ['bhindi', 'okra', 'भिंडी']),
  F('baingan', '🍆', 'Baingan bharta', 'बैंगन भर्ता', 'veg', 'dalsabzi', 'low', 'katori', ['baingan', 'bharta', 'brinjal', 'बैंगन']),
  F('tinda', '🟢', 'Tinda', 'टिंडा', 'veg', 'dalsabzi', 'low', 'katori', ['tinda', 'टिंडा']),
  F('karela', '🥒', 'Karela', 'करेला', 'veg', 'dalsabzi', 'low', 'katori', ['karela', 'bitter gourd', 'करेला']),
  F('cabbage', '🥬', 'Patta gobhi', 'पत्ता गोभी', 'veg', 'dalsabzi', 'low', 'katori', ['patta gobhi', 'band gobhi', 'cabbage', 'पत्ता गोभी']),
  F('mixveg', '🥕', 'Mix veg', 'मिक्स वेज', 'veg', 'dalsabzi', 'low', 'katori', ['mix veg', 'mixed veg', 'मिक्स वेज']),
  F('palak', '🥬', 'Palak / Saag', 'पालक / साग', 'veg', 'dalsabzi', 'low', 'katori', ['palak', 'saag', 'sarson', 'पालक', 'साग']),
  F('palakpaneer', '🥬', 'Palak paneer', 'पालक पनीर', 'veg', 'dalsabzi', 'low', 'katori', ['palak paneer', 'पालक पनीर']),
  F('matarpaneer', '🧀', 'Matar paneer', 'मटर पनीर', 'veg', 'dalsabzi', 'low', 'katori', ['matar paneer', 'मटर पनीर']),
  F('pbm', '🧀', 'Paneer butter masala', 'पनीर बटर मसाला', 'veg', 'dalsabzi', 'med', 'katori', ['paneer butter masala', 'shahi paneer', 'पनीर बटर मसाला', 'शाही पनीर']),

  // Protein.
  F('paneer', '🧀', 'Paneer', 'पनीर', 'veg', 'protein', 'low', 'katori', ['paneer', 'पनीर']),
  F('paneertikka', '🍢', 'Paneer tikka', 'पनीर टिक्का', 'veg', 'protein', 'low', 'plate', ['paneer tikka', 'पनीर टिक्का']),
  F('soya', '🟤', 'Soya chunks', 'सोया चंक्स', 'veg', 'protein', 'low', 'katori', ['soya', 'सोया']),
  F('curd', '🥛', 'Curd', 'दही', 'veg', 'protein', 'low', 'katori', ['curd', 'dahi', 'yogurt', 'yoghurt', 'दही']),
  F('egg', '🥚', 'Boiled egg', 'उबला अंडा', 'egg', 'protein', 'low', 'piece', ['boiled egg', 'egg', 'anda', 'ande', 'अंडा', 'अंडे']),
  F('omelette', '🍳', 'Omelette', 'आमलेट', 'egg', 'protein', 'low', 'piece', ['omelette', 'omelet', 'amlet', 'आमलेट']),
  F('bhurji', '🍳', 'Egg bhurji', 'अंडा भुर्जी', 'egg', 'protein', 'low', 'plate', ['egg bhurji', 'anda bhurji', 'bhurji', 'अंडा भुर्जी', 'भुर्जी']),
  F('eggcurry', '🍛', 'Egg curry', 'अंडा करी', 'egg', 'protein', 'low', 'katori', ['egg curry', 'anda curry', 'अंडा करी']),
  F('chicken', '🍗', 'Chicken curry', 'चिकन करी', 'nonveg', 'protein', 'low', 'pcs', ['chicken curry', 'chicken', 'murga', 'murgh', 'चिकन', 'मुर्गा']),
  F('butterchicken', '🍗', 'Butter chicken', 'बटर चिकन', 'nonveg', 'protein', 'med', 'katori', ['butter chicken', 'बटर चिकन']),
  F('tandoori', '🍗', 'Tandoori chicken', 'तंदूरी चिकन', 'nonveg', 'protein', 'low', 'pcs', ['tandoori chicken', 'tandoori', 'तंदूरी चिकन', 'तंदूरी']),
  F('tikka', '🍢', 'Chicken tikka', 'चिकन टिक्का', 'nonveg', 'protein', 'low', 'plate', ['chicken tikka', 'tikka', 'चिकन टिक्का', 'टिक्का']),
  F('malaitikka', '🍢', 'Chicken malai tikka', 'चिकन मलाई टिक्का', 'nonveg', 'protein', 'low', 'plate', ['chicken malai tikka', 'malai tikka', 'चिकन मलाई टिक्का', 'मलाई टिक्का']),
  F('roastchicken', '🍗', 'Roasted chicken', 'रोस्टेड चिकन', 'nonveg', 'protein', 'low', 'pcs', ['roasted chicken', 'roast chicken', 'grilled chicken', 'रोस्टेड चिकन']),
  F('chickenkebab', '🍢', 'Chicken kebab', 'चिकन कबाब', 'nonveg', 'protein', 'low', 'plate', ['chicken kebab', 'chicken kabab', 'चिकन कबाब']),
  F('chillichicken', '🌶️', 'Chilli chicken', 'चिली चिकन', 'nonveg', 'protein', 'med', 'katori', ['chilli chicken', 'chili chicken', 'चिली चिकन']),
  F('mutton', '🍖', 'Mutton curry', 'मटन करी', 'nonveg', 'protein', 'low', 'pcs', ['mutton curry', 'mutton', 'gosht', 'मटन', 'गोश्त']),
  F('muttonkebab', '🍢', 'Mutton seekh kebab', 'मटन सीख कबाब', 'nonveg', 'protein', 'low', 'plate', ['mutton seekh kebab', 'seekh kebab', 'mutton kebab', 'mutton kabab', 'सीख कबाब', 'मटन कबाब']),
  F('keema', '🍖', 'Keema', 'कीमा', 'nonveg', 'protein', 'low', 'katori', ['keema', 'qeema', 'कीमा']),
  F('fish', '🐟', 'Fish curry', 'मछली करी', 'nonveg', 'protein', 'low', 'katori', ['fish curry', 'fish', 'machli', 'machhli', 'मछली']),
  F('fishfry', '🐟', 'Fish fry', 'मछली फ्राई', 'nonveg', 'protein', 'med', 'pcs', ['fish fry', 'fried fish', 'मछली फ्राई']),
  F('prawns', '🦐', 'Prawns', 'झींगा', 'nonveg', 'protein', 'low', 'katori', ['prawns', 'prawn', 'shrimp', 'jhinga', 'झींगा']),

  // Snacks and street food.
  F('samosa', '🥟', 'Samosa', 'समोसा', 'veg', 'snack', 'high', 'piece', ['samosa', 'समोसा']),
  F('kachori', '🥟', 'Kachori', 'कचौरी', 'veg', 'snack', 'high', 'piece', ['kachori', 'कचौरी']),
  F('pakora', '🍤', 'Pakora', 'पकौड़ा', 'veg', 'snack', 'high', 'plate', ['pakora', 'pakoda', 'bhajiya', 'पकौड़ा', 'पकोड़े']),
  F('dhokla', '🟨', 'Dhokla', 'ढोकला', 'veg', 'snack', 'med', 'piece', ['dhokla', 'ढोकला']),
  F('vada', '🍩', 'Vada', 'वड़ा', 'veg', 'snack', 'high', 'piece', ['medu vada', 'vada', 'wada', 'वड़ा']),
  F('vadapav', '🍔', 'Vada pav', 'वड़ा पाव', 'veg', 'snack', 'high', 'piece', ['vada pav', 'wada pav', 'वड़ा पाव']),
  F('pavbhaji', '🍛', 'Pav bhaji', 'पाव भाजी', 'veg', 'snack', 'high', 'plate', ['pav bhaji', 'पाव भाजी']),
  F('cholebhature', '🍛', 'Chole bhature', 'छोले भटूरे', 'veg', 'snack', 'high', 'plate', ['chole bhature', 'chhole bhature', 'छोले भटूरे']),
  F('panipuri', '🫧', 'Pani puri', 'पानी पूरी', 'veg', 'snack', 'high', 'plate', ['pani puri', 'golgappa', 'gol gappa', 'puchka', 'पानी पूरी', 'गोलगप्पे']),
  F('bhel', '🥗', 'Bhel', 'भेल', 'veg', 'snack', 'high', 'plate', ['bhel', 'भेल']),
  F('namkeen', '🥨', 'Namkeen', 'नमकीन', 'veg', 'snack', 'high', 'katori', ['namkeen', 'mixture', 'bhujia', 'नमकीन', 'भुजिया']),
  F('peanuts', '🥜', 'Peanuts', 'मूंगफली', 'veg', 'snack', 'low', 'katori', ['peanuts', 'peanut', 'moongfali', 'mungfali', 'मूंगफली']),
  F('makhana', '⚪', 'Makhana', 'मखाना', 'veg', 'snack', 'low', 'katori', ['makhana', 'fox nut', 'मखाना']),

  // Sweets, fruit and everyday drinks.
  F('fruit', '🍎', 'Fruit', 'फल', 'veg', 'sweet', 'low', 'piece', ['fruit', 'phal', 'apple', 'guava', 'amrood', 'फल', 'सेब', 'अमरूद']),
  F('sweet', '🍬', 'Sweets', 'मिठाई', 'veg', 'sweet', 'high', 'piece', ['sweet', 'mithai', 'मिठाई']),
  F('petha', '🧊', 'Petha (Agra sweet)', 'आगरा पेठा', 'veg', 'sweet', 'high', 'piece', ['agra petha', 'petha', 'आगरा पेठा', 'पेठा']),
  F('jalebi', '🥨', 'Jalebi', 'जलेबी', 'veg', 'sweet', 'high', 'piece', ['jalebi', 'जलेबी']),
  F('gulabjamun', '🟤', 'Gulab jamun', 'गुलाब जामुन', 'veg', 'sweet', 'high', 'piece', ['gulab jamun', 'gulabjamun', 'गुलाब जामुन']),
  F('rasgulla', '⚪', 'Rasgulla', 'रसगुल्ला', 'veg', 'sweet', 'high', 'piece', ['rasgulla', 'rasagola', 'रसगुल्ला']),
  F('ladoo', '🟠', 'Ladoo', 'लड्डू', 'veg', 'sweet', 'high', 'piece', ['ladoo', 'laddu', 'लड्डू']),
  F('barfi', '🔶', 'Barfi', 'बर्फी', 'veg', 'sweet', 'high', 'piece', ['barfi', 'burfi', 'बर्फी']),
  F('kheer', '🍮', 'Kheer', 'खीर', 'veg', 'sweet', 'high', 'katori', ['kheer', 'payasam', 'खीर']),
  F('halwa', '🍮', 'Halwa', 'हलवा', 'veg', 'sweet', 'high', 'katori', ['halwa', 'sheera', 'हलवा']),
  F('icecream', '🍨', 'Ice cream', 'आइसक्रीम', 'veg', 'sweet', 'high', 'katori', ['ice cream', 'icecream', 'kulfi', 'आइसक्रीम', 'कुल्फी']),
  F('chai', '☕', 'Chai', 'चाय', 'veg', 'drink', 'med', 'glass', ['chai', 'tea', 'चाय']),
  F('chains', '🍵', 'Chai, no sugar', 'फीकी चाय', 'veg', 'drink', 'low', 'glass', ['chai without sugar', 'tea without sugar', 'chai bina chini', 'phiki chai', 'pheeki chai', 'फीकी चाय', 'बिना चीनी']),
  F('coffee', '☕', 'Coffee', 'कॉफ़ी', 'veg', 'drink', 'med', 'glass', ['coffee', 'कॉफ़ी', 'कॉफी']),
  F('lassi', '🥛', 'Sweet lassi', 'मीठी लस्सी', 'veg', 'drink', 'high', 'glass', ['lassi', 'लस्सी']),
  F('nimbupani', '🍋', 'Nimbu pani', 'नींबू पानी', 'veg', 'drink', 'high', 'glass', ['nimbu pani', 'shikanji', 'lemonade', 'नींबू पानी', 'शिकंजी']),

  // Treat / cheat meals.
  F('pizza', '🍕', 'Pizza (2 slices)', 'पिज़्ज़ा (2 स्लाइस)', 'veg', 'treat', 'high', 'plate', ['pizza', 'पिज़्ज़ा', 'पिज्जा']),
  F('burger', '🍔', 'Burger', 'बर्गर', 'veg', 'treat', 'high', 'piece', ['burger', 'बर्गर']),
  F('noodles', '🍜', 'Noodles / Maggi', 'नूडल्स / मैगी', 'veg', 'treat', 'high', 'plate', ['noodles', 'chowmein', 'maggi', 'नूडल्स', 'चाउमीन', 'मैगी']),
  F('momos', '🥟', 'Momos (6)', 'मोमोज़ (6)', 'veg', 'treat', 'high', 'plate', ['momos', 'momo', 'मोमोज़', 'मोमो']),
  F('friedchicken', '🍗', 'Fried chicken', 'फ्राइड चिकन', 'nonveg', 'treat', 'high', 'pcs', ['fried chicken', 'फ्राइड चिकन']),
  F('cake', '🍰', 'Cake / pastry', 'केक / पेस्ट्री', 'veg', 'treat', 'high', 'piece', ['cake', 'pastry', 'केक', 'पेस्ट्री']),
  F('colddrink', '🥤', 'Cold drink', 'कोल्ड ड्रिंक', 'veg', 'treat', 'high', 'glass', ['cold drink', 'soft drink', 'thums up', 'sprite', 'कोल्ड ड्रिंक']),
  F('juice', '🧃', 'Packaged juice', 'पैक जूस', 'veg', 'treat', 'high', 'glass', ['packaged juice', 'frooti', 'maaza', 'पैक जूस']),

  // Alcohol (opt-in). Spirits have almost no carbs but can drop sugar hours later.
  drink('whisky', '🥃', 'Whisky', 'व्हिस्की', 'peg', 1, false, ['whisky', 'whiskey', 'व्हिस्की']),
  drink('rum', '🥃', 'Rum', 'रम', 'peg', 1, false, ['rum', 'रम']),
  drink('vodka', '🍸', 'Vodka', 'वोडका', 'peg', 1, false, ['vodka', 'वोडका']),
  drink('gin', '🍸', 'Gin', 'जिन', 'peg', 1, false, ['gin', 'जिन']),
  drink('beer', '🍺', 'Beer', 'बीयर', 'beer', 1, true, ['beer', 'बीयर']),
  drink('wine', '🍷', 'Wine', 'वाइन', 'wine', 1, false, ['wine', 'वाइन']),
  drink('breezer', '🍹', 'Breezer', 'ब्रीज़र', 'glass', 1, true, ['breezer', 'ब्रीज़र']),
  drink('cocktail', '🍹', 'Cocktail', 'कॉकटेल', 'glass', 1, true, ['cocktail', 'कॉकटेल']),

  // Mixers.
  mixer('water', '💧', 'Water', 'पानी', false, ['water', 'pani', 'पानी']),
  mixer('soda', '🫧', 'Soda', 'सोडा', false, ['soda', 'सोडा']),
  mixer('dietcola', '🥤', 'Diet cola', 'डाइट कोला', false, ['diet coke', 'diet cola', 'diet pepsi', 'डाइट कोला']),
  mixer('limesoda', '🍋', 'Lime soda, no sugar', 'नींबू सोडा, बिना चीनी', false, ['lime soda', 'nimbu soda', 'नींबू सोडा']),
  mixer('cola', '🥤', 'Cola', 'कोला', true, ['cola', 'coke', 'pepsi', 'कोला', 'कोक']),
  mixer('mjuice', '🧃', 'Juice', 'जूस', true, ['juice', 'जूस']),
  mixer('tonic', '🫙', 'Tonic', 'टॉनिक', true, ['tonic', 'टॉनिक']),
  mixer('energy', '⚡', 'Energy drink', 'एनर्जी ड्रिंक', true, ['energy drink', 'red bull', 'एनर्जी ड्रिंक']),
];

const GROUP_ROLE: Record<FoodGroup, PlateRole> = {
  starter: 'veg', grain: 'grain', dalsabzi: 'veg', protein: 'protein', snack: 'other',
  drink: 'other', sweet: 'other', treat: 'other', alcohol: 'other', mixer: 'other',
};
/** Pulses count as protein; potato dishes and biryani count as starch (plate method). */
const ROLE_OVERRIDE: Record<string, PlateRole> = {
  dal: 'protein', dalmakhani: 'protein', chanadal: 'protein', moongdal: 'protein', chole: 'protein', sambar: 'protein',
  sprouts: 'protein', chana: 'protein', palakpaneer: 'protein', matarpaneer: 'protein', pbm: 'protein', kadhi: 'protein', raita: 'protein', chaas: 'protein',
  aloo: 'grain', aloojhol: 'grain', aloomatar: 'grain', alooparatha: 'grain', fruit: 'other',
  cbiryani: 'grain', mbiryani: 'grain', vbiryani: 'grain',
};

export const FOODS: Food[] = BASE.map((b) => ({ ...b, ...nutritionFor(b.id), role: ROLE_OVERRIDE[b.id] ?? GROUP_ROLE[b.group] }));

export const FOOD_BY_ID: Record<string, Food> = Object.fromEntries(FOODS.map((f) => [f.id, f]));

/** Lower-spike swap for a food. */
export const SWAPS: Record<string, string> = {
  rice: 'brownrice',
  pulao: 'brownrice',
  roti: 'jowar',
  paratha: 'roti',
  alooparatha: 'roti',
  naan: 'roti',
  puri: 'roti',
  bhatura: 'roti',
  dosa: 'idli',
  poha: 'upma',
  aloo: 'aloogobhi',
  aloojhol: 'lauki',
  sweet: 'fruit',
  petha: 'fruit',
  jalebi: 'fruit',
  chai: 'chains',
  lassi: 'chaas',
  nimbupani: 'chaas',
  colddrink: 'chaas',
  namkeen: 'chana',
  pakora: 'paneertikka',
  friedchicken: 'tandoori',
  fishfry: 'fish',
  butterchicken: 'tandoori',
  chillichicken: 'tandoori',
  cola: 'dietcola',
  mjuice: 'soda',
  tonic: 'soda',
  energy: 'soda',
};

/** Veg eaters see veg; egg eaters see veg + egg; non-veg sees everything (same rule as the API and admin). */
export function allowed(food: Food, diet: Diet): boolean {
  return eats(diet, food.diet);
}

/** Meal-screen filter: 'all' = everything this person eats; the others show exactly that kind. */
export type DietFilter = 'all' | Diet;

export function matchesDiet(f: Food, filter: DietFilter, profileDiet: Diet): boolean {
  return filter === 'all' ? allowed(f, profileDiet) : f.diet === filter;
}

/** Diet used for suggestions: browsing egg or non-veg means the person eats it today. */
export function suggestDiet(filter: DietFilter, profileDiet: Diet): Diet {
  if (filter === 'all' || filter === 'veg') return profileDiet;
  return eats(profileDiet, filter) ? profileDiet : filter;
}

/** Foods that are drinks-only (no food value for "did you eat"). */
export const isDrinkOnly = (f: Food) => f.group === 'alcohol' || f.group === 'mixer';

export type Portion = { mult: number; amount: number; unit: 'katori' | 'piece' | 'plate' | 'glass' | 'pcs' | 'ml' };

/** Size options for the portion sheet; mult is relative to one standard portion. */
export function portionsFor(f: Food): Portion[] {
  switch (f.unit) {
    case 'katori':
      return [0.5, 1, 1.5, 2].map((m) => ({ mult: m, amount: m, unit: 'katori' }));
    case 'piece':
      return [1, 2, 3, 4, 5, 6].map((m) => ({ mult: m, amount: m, unit: 'piece' }));
    case 'pcs':
      return [1, 2, 3].map((m) => ({ mult: m, amount: m * 2, unit: 'pcs' }));
    case 'peg':
      return [1, 2, 3].map((m) => ({ mult: m, amount: m * 30, unit: 'ml' }));
    case 'beer':
      return [
        { mult: 1, amount: 330, unit: 'ml' },
        { mult: 1.5, amount: 500, unit: 'ml' },
        { mult: 2, amount: 650, unit: 'ml' },
      ];
    case 'wine':
      return [1, 2].map((m) => ({ mult: m, amount: m, unit: 'glass' }));
    default:
      return [0.5, 1, 2].map((m) => ({ mult: m, amount: m, unit: f.unit as 'plate' | 'glass' }));
  }
}

export const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, a: 1, an: 1, half: 0.5,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, chhe: 6, aadha: 0.5, adha: 0.5,
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'छह': 6, 'आधा': 0.5,
};
