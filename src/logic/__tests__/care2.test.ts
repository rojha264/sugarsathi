import { bmi, bpBand, isOnline } from '@shared/presence';
import { seed } from '@/data/seed';
import { careFlags, personOf } from '../care';
import { rollover } from '../day';

describe('blood pressure bands', () => {
  it.each([
    [115, 75, 'normal'], [125, 78, 'elevated'], [132, 82, 'high1'], [145, 92, 'high2'], [185, 100, 'crisis'], [150, 125, 'crisis'], [85, 55, 'low'],
  ])('%i/%i is %s', (s, d, band) => {
    expect(bpBand(s, d)).toBe(band);
  });
  it('computes BMI only with a height', () => {
    expect(bmi(70, 170)).toBe(24.2);
    expect(bmi(70)).toBeNull();
  });
});

describe('presence', () => {
  it('is online within 2 minutes of activity', () => {
    const now = Date.now();
    expect(isOnline(new Date(now - 60_000), now)).toBe(true);
    expect(isOnline(new Date(now - 3 * 60_000), now)).toBe(false);
    expect(isOnline(null, now)).toBe(false);
  });
});

describe('family members have their own care info', () => {
  const s = seed('2026-10-23');
  it('uses the family member’s diet, type and age, not the phone owner’s', () => {
    const care = { diet: 'veg' as const, type: 'gdm' as const, age: 'adult' as const };
    expect(personOf('papa', { ...s.setup, diet: 'nonveg' }, care)).toEqual(care);
    const f = careFlags('papa', { ...s.setup, type: 'type2' }, care);
    expect([f.pregnant, f.drinkNotSafe, f.targetSetup?.diet]).toEqual([true, true, 'veg']);
  });
  it('gives no flags when nothing is known about a family member', () => {
    expect(careFlags('papa', s.setup).targetSetup).toBeNull();
  });
});

describe('late entries', () => {
  it('stay through midnight until synced, then age out', () => {
    const s = seed('2026-10-23');
    const old = Date.UTC(2026, 9, 10);
    const recent = Date.UTC(2026, 9, 22, 15);
    s.profiles.me.late = {
      meals: [{ id: 'm1', createdAt: recent, updatedAt: recent, slot: 'dinner', items: [], c: 0, p: 0 }, { id: 'm0', createdAt: old, updatedAt: old, slot: 'lunch', items: [], c: 0, p: 0 }],
      sugar: [],
    };
    const next = rollover(s, '2026-10-24');
    expect(next.profiles.me.late?.meals.map((m) => m.id)).toEqual(['m1']);
  });
});
