/** Food preference. An eggetarian eats vegetarian food plus eggs; a non-vegetarian eats everything. */
export type Diet = 'veg' | 'egg' | 'nonveg';

export const DIETS: Diet[] = ['veg', 'egg', 'nonveg'];
const RANK: Record<Diet, number> = { veg: 0, egg: 1, nonveg: 2 };

/** True when someone with this preference eats a food of `foodDiet`. */
export const eats = (personDiet: Diet, foodDiet: Diet) => RANK[foodDiet] <= RANK[personDiet];

/** The food kinds a person can browse: veg → veg; egg → veg, egg; non-veg → all three. */
export const kindsFor = (personDiet: Diet): Diet[] => DIETS.filter((d) => eats(personDiet, d));
