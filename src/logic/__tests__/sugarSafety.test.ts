import { eventAlert, SUGAR_ALERT_HIGH, SUGAR_ALERT_LOW, alertText } from '@shared/family';
import { isUrgentLow, LOW, sugarStatus, VERY_HIGH } from '@shared/sugar';

describe('sugar safety levels', () => {
  it('flags very low (< 54) apart from low', () => {
    expect(sugarStatus(50, 'random')).toEqual({ l: 'r', k: 'sVeryLow' });
    expect(sugarStatus(60, 'random')).toEqual({ l: 'r', k: 'sLow' });
    expect(isUrgentLow(53)).toBe(true);
    expect(isUrgentLow(54)).toBe(false);
  });

  it('uses tighter targets in pregnancy (GDM)', () => {
    expect(sugarStatus(110, 'fasting').l).toBe('g');
    expect(sugarStatus(110, 'fasting', { type: 'gdm' }).l).toBe('a');
    expect(sugarStatus(95, 'fasting', { type: 'gdm' }).l).toBe('g');
    expect(sugarStatus(130, 'after', { type: 'gdm' }).l).toBe('a');
    expect(sugarStatus(130, 'after', { type: 'type2' }).l).toBe('g');
  });

  it('alerts family on the same readings the app shows in red', () => {
    expect([SUGAR_ALERT_LOW, SUGAR_ALERT_HIGH]).toEqual([LOW, VERY_HIGH]);
    expect(eventAlert('sugar', { v: 260 }, 'Papa', 'e1')?.vars.level).toBe('high');
    expect(eventAlert('sugar', { v: 240 }, 'Papa', 'e2')).toBeNull();
    const veryLow = eventAlert('sugar', { v: 48 }, 'Papa', 'e3')!;
    expect(veryLow.vars.level).toBe('veryLow');
    expect(alertText(veryLow, 'hi').title).toContain('बहुत कम');
    expect(alertText(veryLow, 'en').body).toContain('108');
  });
});
