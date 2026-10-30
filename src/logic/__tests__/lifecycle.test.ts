import { daysUntil, stageOf, trialInfo } from '@shared/lifecycle';

describe('patient lifecycle (trial → subscriber)', () => {
  it('puts each patient in exactly one stage, paid first', () => {
    expect(stageOf({ status: 'active', startsOn: '2026-10-20' }, true, true)).toBe('subscriber');
    expect(stageOf({ status: 'pending_review', startsOn: '2026-10-26' }, false, false)).toBe('waiting');
    expect(stageOf({ status: 'active', startsOn: '2026-10-20' }, false, false)).toBe('trial');
    expect(stageOf({ status: 'completed', startsOn: '2026-10-01' }, false, false)).toBe('ended');
    expect(stageOf(null, false, true)).toBe('ended'); // subscription lapsed
    expect(stageOf(null, false, false)).toBe('none');
  });

  it('counts trial days from the day the plan was shared', () => {
    expect(trialInfo('2026-10-26', '2026-10-26')).toEqual({ day: 1, daysLeft: 13, endsOn: '2026-11-08' });
    expect(trialInfo('2026-10-26', '2026-11-08')).toMatchObject({ day: 14, daysLeft: 0 });
    expect(trialInfo('2026-10-26', '2026-11-10').daysLeft).toBe(0);
  });

  it('counts days until a subscription ends', () => {
    const now = Date.parse('2026-10-26T10:00:00Z');
    expect(daysUntil('2026-11-02T10:00:00Z', now)).toBe(7);
    expect(daysUntil('2026-10-26T20:00:00Z', now)).toBe(1);
    expect(daysUntil('2026-10-20T10:00:00Z', now)).toBe(0);
  });
});
