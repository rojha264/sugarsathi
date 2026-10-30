import { dailyKcal, pickTemplate, portionScale, programDay, results, riskFor, riskReasons } from '@shared/program';

describe('14-day programme rules', () => {
  it('works out daily kcal bands with a deficit only when overweight, and safe floors', () => {
    // 58 y woman, 158 cm, 72 kg (BMI 28.8): BMR ≈ 1255 → ×1.3 ≈ 1632 − 500 = 1132 → floor 1200
    expect(dailyKcal({ sex: 'female', age: 58, heightCm: 158, weightKg: 72 })).toBe(1200);
    // 40 y man, 175 cm, 68 kg (BMI 22.2, no deficit): BMR 1599 → 2079 → 2100 band
    expect(dailyKcal({ sex: 'male', age: 40, heightCm: 175, weightKg: 68 })).toBe(2100);
    // 45 y man, 170 cm, 85 kg (BMI 29.4): BMR 1693 → 2201 − 500 = 1701 → 1800
    expect(dailyKcal({ sex: 'male', age: 45, heightCm: 170, weightKg: 85 })).toBe(1800);
    // Pregnancy: no calorie cut
    expect(dailyKcal({ sex: 'female', age: 30, heightCm: 160, weightKg: 75, flags: ['pregnant'] })).toBeGreaterThanOrEqual(1800);
  });

  it('scales only grain portions, in quarter steps within ½–1½', () => {
    expect(portionScale(1500)).toBe(1);
    expect(portionScale(1200)).toBe(0.75);
    expect(portionScale(1800)).toBe(1.25);
    expect(portionScale(2100)).toBe(1.5);
  });

  it('sends risky profiles to a dietitian first', () => {
    expect(riskReasons({ type: 'type2', age: 50, meds: 'none', flags: [], a1c: 8, sugar: { v: 160, ctx: 'fasting' } })).toEqual([]);
    expect(riskReasons({ type: 'type1', age: 16, meds: 'insulin', flags: ['pregnant', 'kidney'], a1c: 11, sugar: { v: 260, ctx: 'random' } })).toEqual(
      ['type1', 'child', 'insulin', 'pregnant', 'kidney', 'a1c_high', 'sugar_high'],
    );
    expect(riskReasons({ type: 'gdm', age: 80, sugar: { v: 60, ctx: 'fasting' } })).toEqual(['gdm', 'senior75', 'sugar_low']);
    expect(riskFor({ meds: 'tablets' })).toBe('hypo_safe');
    expect(riskFor({ meds: 'none' })).toBe('standard');
  });

  it('picks the closest template the person can eat', () => {
    const t = [
      { id: 'veg-north', diet: 'veg', region: 'north', risk: 'standard', active: true },
      { id: 'veg-north-safe', diet: 'veg', region: 'north', risk: 'hypo_safe', active: true },
      { id: 'veg-south', diet: 'veg', region: 'south', risk: 'standard', active: true },
      { id: 'nonveg-south', diet: 'nonveg', region: 'south', risk: 'standard', active: true },
      { id: 'nonveg-east-off', diet: 'nonveg', region: 'east', risk: 'standard', active: false },
    ];
    expect(pickTemplate(t, { diet: 'veg', region: 'north', risk: 'hypo_safe' })?.id).toBe('veg-north-safe');
    expect(pickTemplate(t, { diet: 'nonveg', region: 'south', risk: 'standard' })?.id).toBe('nonveg-south');
    expect(pickTemplate(t, { diet: 'egg', region: 'south', risk: 'standard' })?.id).toBe('veg-south'); // eggetarian → veg plan
    expect(pickTemplate(t, { diet: 'nonveg', region: 'east', risk: 'standard' })?.id).toBe('nonveg-south'); // inactive skipped, nearest region
    expect(pickTemplate(t, { diet: 'veg', region: 'east', risk: 'standard' })?.id).toMatch(/^veg-/); // never a non-veg plan for a vegetarian
  });

  it('counts programme days and measures before/after honestly', () => {
    expect(programDay('2026-10-27', '2026-10-27')).toBe(1);
    expect(programDay('2026-10-27', '2026-11-09')).toBe(14);
    expect(programDay('2026-10-27', '2026-10-26')).toBe(0);
    const r = results(
      [
        { day: 1, v: 168, ctx: 'fasting' }, { day: 2, v: 160, ctx: 'fasting' }, { day: 3, v: 172, ctx: 'fasting' }, { day: 2, v: 230, ctx: 'after' },
        { day: 12, v: 142, ctx: 'fasting' }, { day: 13, v: 138, ctx: 'fasting' }, { day: 14, v: 146, ctx: 'fasting' }, { day: 13, v: 190, ctx: 'after' },
      ],
      [{ day: 1, kg: 74 }, { day: 14, kg: 73.2 }],
      11,
    );
    expect(r).toMatchObject({ fastingBefore: 167, fastingAfter: 142, afterMealBefore: 230, afterMealAfter: 190, weightBefore: 74, weightAfter: 73.2, daysFollowed: 11, improved: true });
    const flat = results([{ day: 1, v: 150, ctx: 'fasting' }, { day: 13, v: 150, ctx: 'fasting' }, { day: 13, v: 62, ctx: 'random' }], [], 4);
    expect(flat.improved).toBe(false); // new low, no gain
  });
});
