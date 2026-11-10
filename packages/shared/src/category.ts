/**
 * Food categories: finer than the app tab (`group`), so staff can find "all fruits" or "all smoothies"
 * when building a menu or plan. Stored on Food.category; empty means "work it out" with `categoryOf`.
 */
export const CATEGORIES = [
  'fruit', 'smoothie', 'juice', 'milkdrink', 'salad', 'soup', 'breakfast', 'roti', 'rice',
  'dal', 'sabzi', 'dairy', 'egg', 'meat', 'fish', 'snack', 'sweet', 'fastfood', 'alcohol',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, { en: string; hi: string }> = {
  fruit: { en: '🍎 Fruits', hi: '🍎 फल' },
  smoothie: { en: '🥤 Smoothies & shakes', hi: '🥤 स्मूदी और शेक' },
  juice: { en: '🧃 Juices & cold drinks', hi: '🧃 जूस और ठंडे पेय' },
  milkdrink: { en: '☕ Tea, coffee, lassi & chaas', hi: '☕ चाय, कॉफ़ी, लस्सी और छाछ' },
  salad: { en: '🥗 Salads & sprouts', hi: '🥗 सलाद और अंकुरित' },
  soup: { en: '🍲 Soups & rasam', hi: '🍲 सूप और रसम' },
  breakfast: { en: '🍳 Breakfast dishes', hi: '🍳 नाश्ते के व्यंजन' },
  roti: { en: '🫓 Roti, paratha & breads', hi: '🫓 रोटी, पराठा और ब्रेड' },
  rice: { en: '🍚 Rice, khichdi & biryani', hi: '🍚 चावल, खिचड़ी और बिरयानी' },
  dal: { en: '🥣 Dal, chana & rajma', hi: '🥣 दाल, चना और राजमा' },
  sabzi: { en: '🥬 Sabzi & veg curries', hi: '🥬 सब्ज़ी' },
  dairy: { en: '🧀 Paneer, curd & soya', hi: '🧀 पनीर, दही और सोया' },
  egg: { en: '🥚 Eggs', hi: '🥚 अंडे' },
  meat: { en: '🍗 Chicken & mutton', hi: '🍗 चिकन और मटन' },
  fish: { en: '🐟 Fish & seafood', hi: '🐟 मछली और सीफ़ूड' },
  snack: { en: '🥜 Snacks, nuts & chaat', hi: '🥜 नमकीन, मेवे और चाट' },
  sweet: { en: '🍬 Sweets & desserts', hi: '🍬 मिठाई' },
  fastfood: { en: '🍕 Fast food', hi: '🍕 फ़ास्ट फ़ूड' },
  alcohol: { en: '🍺 Alcohol', hi: '🍺 शराब' },
};

type FoodLike = { id: string; group: string; diet: string; nameEn: string; aliases?: readonly string[]; category?: string | null };

const has = (text: string, re: RegExp) => re.test(text);
const FRUIT = /\b(fruits?|apple|guava|amrood|papaya|banana|mango|orange|santra|jamun|amla|(water|musk)?melon|pear|grapes|pomegranate|anar|chikoo|chiku|sapota|berr(y|ies)|strawberry|pineapple|kiwi|plum|custard apple|sitaphal|mosambi|sweet lime|litchi|lychee|dates|khajur|kharbooja|tarbooz|raisins|kishmish|figs?|anjeer|peach|cherry)\b/;
const NOT_FRUIT = /halwa|kheer|ladoo|laddu|barfi|payasam|pudding|cake|mithai|jam\b|kesari|gulab|chips|wafers/;
const FISH = /fish|prawn|crab|meen|macher|machh|rohu|shrimp|pomfret|surmai|bangda|seafood|jhinga|hilsa|ilish/;
const DAL = /\bdal\b|\bdaal\b|chana|chole|rajma|lobia|moong|masoor|sambar|kadhi|usal|misal|pappu|amti|toor|urad|kulthi|pulses|beans curry/;
const DAIRY = /paneer|curd|dahi|raita|cheese|chhena|chhana|soya|tofu|yogurt/;
const RICE = /rice|biryani|pulao|pulav|khichdi|khichri|bhaat|chawal|bisibele|pongal/;
const ROTI = /roti|rotti|paratha|parantha|parotta|naan|kulcha|puri|poori|bhatura|thepla|bhakri|chapati|phulka|bread|toast|pav\b|rotla|luchi|litti|poli/;
const BREAKFAST = /idli|dosa|uttapam|appam|chilla|cheela|pesarattu|adai|idiyappam|sevai|pitha|puttu|kozhukattai|dhuska|upma|poha|porridge|dalia/;
const CHAAT = /chaat|puri|tikki|pattice|pakora|pakoda|mathri|chakli|cutlet|fafda|gota|vada|sandwich|chivda|bhel/;
const SOUP = /soup|rasam|shorba|saaru/;

/** The category a food belongs to: the stored one, else worked out from its tab, diet and names. */
export function categoryOf(f: FoodLike): Category {
  if (f.category && (CATEGORIES as readonly string[]).includes(f.category)) return f.category as Category;
  const t = [f.id, f.nameEn, ...(f.aliases ?? [])].join(' ').toLowerCase();
  const g = f.group;
  // The food's own name decides first; aliases ("made with rice flour") only when the name says nothing.
  const n = `${f.id} ${f.nameEn}`.toLowerCase();
  const fruit = (s: string) => has(s, FRUIT) && !has(s, NOT_FRUIT);
  if (g === 'alcohol') return 'alcohol';
  if (g === 'mixer') return 'juice';
  if (g === 'drink' || (g === 'treat' && has(t, /juice|cold drink|soft drink|cola/))) {
    if (has(t, /smoothie|shake/)) return 'smoothie';
    if (has(t, /chai|tea\b|coffee|milk|lassi|chaas|buttermilk|doodh|kadha|haldi|thandai/)) return 'milkdrink';
    return 'juice';
  }
  if (g === 'sweet' || g === 'treat') {
    if (fruit(n)) return 'fruit';
    if (g === 'sweet' || has(t, /cake|pastry|ice ?cream|kulfi|brownie|donut/)) return 'sweet';
    if (has(n, CHAAT)) return 'snack';
    return 'fastfood';
  }
  if (g === 'starter') {
    if (has(t, SOUP)) return 'soup';
    if (has(n, /water|juice/)) return 'juice';
    if (has(t, /chaas|buttermilk/)) return 'milkdrink';
    if (has(t, /raita/)) return 'dairy';
    return 'salad';
  }
  if (f.diet === 'nonveg' && (g === 'protein' || g === 'dalsabzi')) return has(t, FISH) ? 'fish' : 'meat';
  if (f.diet === 'egg' && (g === 'protein' || g === 'dalsabzi')) return 'egg';
  if (g === 'grain') {
    if (has(n, BREAKFAST)) return 'breakfast';
    if (has(n, ROTI)) return 'roti';
    if (has(n, RICE)) return 'rice';
    if (has(t, BREAKFAST)) return 'breakfast';
    if (has(t, ROTI)) return 'roti';
    if (has(t, RICE)) return 'rice';
    return 'breakfast';
  }
  if (g === 'protein') return has(t, DAIRY) ? 'dairy' : has(t, DAL) ? 'dal' : 'dairy';
  if (g === 'dalsabzi') {
    if (has(t, SOUP)) return 'soup';
    if (has(t, DAL)) return 'dal';
    if (has(t, /paneer/)) return 'dairy';
    return 'sabzi';
  }
  if (g === 'snack') return fruit(n) ? 'fruit' : 'snack';
  return 'snack';
}
