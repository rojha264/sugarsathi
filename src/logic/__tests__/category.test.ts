import { categoryOf } from '@shared/category';

import { FOODS } from '@/data/foods';

const food = (id: string, group: string, nameEn: string, diet = 'veg', aliases: string[] = []) => ({ id, group, diet, nameEn, aliases });

describe('food categories', () => {
  it('sorts drinks into smoothies, juices and milk drinks', () => {
    expect(categoryOf(food('chiasmoothie', 'drink', 'Chia berry smoothie'))).toBe('smoothie');
    expect(categoryOf(food('bananashake', 'drink', 'Banana shake'))).toBe('smoothie');
    expect(categoryOf(food('laukijuice', 'drink', 'Lauki juice'))).toBe('juice');
    expect(categoryOf(food('soda', 'mixer', 'Soda'))).toBe('juice');
    expect(categoryOf(food('chai', 'drink', 'Chai'))).toBe('milkdrink');
    expect(categoryOf(food('whisky', 'alcohol', 'Whisky'))).toBe('alcohol');
  });

  it('keeps fruit apart from sweets named after fruit', () => {
    expect(categoryOf(food('watermelon', 'snack', 'Watermelon'))).toBe('fruit');
    expect(categoryOf(food('guava', 'sweet', 'Guava'))).toBe('fruit');
    expect(categoryOf(food('gulabjamun', 'sweet', 'Gulab jamun'))).toBe('sweet');
    expect(categoryOf(food('gajarhalwa', 'sweet', 'Gajar halwa'))).toBe('sweet');
  });

  it('goes by the name before the aliases', () => {
    expect(categoryOf(food('akkirotti', 'grain', 'Akki rotti', 'veg', ['rice roti']))).toBe('roti');
    expect(categoryOf(food('masaladosa', 'grain', 'Masala dosa', 'veg', ['rice dosa']))).toBe('breakfast');
    expect(categoryOf(food('jeerarice', 'grain', 'Jeera rice'))).toBe('rice');
  });

  it('splits curries by diet and what is in them', () => {
    expect(categoryOf(food('fishcurry', 'dalsabzi', 'Fish curry', 'nonveg'))).toBe('fish');
    expect(categoryOf(food('chicken', 'protein', 'Chicken curry', 'nonveg'))).toBe('meat');
    expect(categoryOf(food('eggcurry', 'dalsabzi', 'Egg curry', 'egg'))).toBe('egg');
    expect(categoryOf(food('rajma', 'dalsabzi', 'Rajma masala'))).toBe('dal');
    expect(categoryOf(food('bhindi', 'dalsabzi', 'Bhindi'))).toBe('sabzi');
    expect(categoryOf(food('paneer', 'protein', 'Paneer'))).toBe('dairy');
  });

  it('a category chosen by staff wins', () => {
    expect(categoryOf({ ...food('dates', 'snack', 'Dates'), category: 'sweet' })).toBe('sweet');
    expect(categoryOf({ ...food('dates', 'snack', 'Dates'), category: 'nonsense' })).toBe('fruit');
  });

  it('gives every app food a category', () => {
    for (const f of FOODS) expect(categoryOf({ id: f.id, group: f.group, diet: f.diet, nameEn: f.n.en, aliases: f.kw })).toBeTruthy();
  });
});
