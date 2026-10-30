import { seed } from '@/data/seed';
import { normalize } from '@/store/migrate';
import type { Med } from '@/types';
import { CONSENT_VERSION, decodeBackup, encodeBackup, needsConsent } from '../backup';
import { checkupStatus, checkupsToNudge, monthsAgo } from '../checkups';
import { afterDose, daysLeft, doseTimes, lowMeds, medKey } from '../meds';

const meta = { id: 'x', createdAt: 0, updatedAt: 0 };
const med = (n: string, t: Med['t'], at: string): Med => ({ ...meta, n, t, s: null, at });

describe('checkups', () => {
  it('is unknown with no date, then ok, soon and due as time passes', () => {
    expect(checkupStatus('a1c', undefined, '2026-10-23').state).toBe('unknown');
    expect(checkupStatus('a1c', '2026-10-01', '2026-10-23')).toMatchObject({ state: 'ok', due: '2026-12-30' });
    expect(checkupStatus('a1c', '2026-08-01', '2026-10-23').state).toBe('soon');
    expect(checkupStatus('a1c', '2026-07-01', '2026-10-23').state).toBe('due');
    expect(checkupStatus('eye', '2026-01-01', '2026-10-23').state).toBe('ok');
  });

  it('nudges overdue checkups before unrecorded ones', () => {
    const list = checkupsToNudge({ a1c: '2026-01-01', eye: '2026-10-01', foot: '2026-10-01' }, '2026-10-23');
    expect(list.map((c) => c.id)).toEqual(['a1c', 'kidney']);
  });

  it('turns "3 months ago" into a date', () => {
    expect(monthsAgo('2026-10-23', 3)).toBe('2026-07-24');
  });
});

describe('medicine stock', () => {
  const meds = [med('Metformin', 'morning', '08:30'), med('metformin ', 'night', '21:00'), med('Glimepiride', 'morning', '08:30')];

  it('shares one count across doses of the same medicine', () => {
    expect(daysLeft(meds, { metformin: 9 }, 'metformin')).toBe(4);
    expect(daysLeft(meds, {}, 'glimepiride')).toBeNull();
  });

  it('warns once per medicine when 5 days or fewer are left', () => {
    expect(lowMeds(meds, { metformin: 10, glimepiride: 30 })).toEqual([{ name: 'Metformin', left: 10, days: 5 }]);
    expect(lowMeds(meds, { metformin: 12 })).toEqual([]);
  });

  it('counts down on taking and back up on un-taking, never below 0', () => {
    expect(afterDose({ metformin: 3 }, 'Metformin', null, 'taken')).toEqual({ metformin: 2 });
    expect(afterDose({ metformin: 2 }, 'Metformin', 'taken', null)).toEqual({ metformin: 3 });
    expect(afterDose({ metformin: 0 }, 'Metformin', 'skipped', 'taken')).toEqual({ metformin: 0 });
    expect(afterDose({}, 'Metformin', null, 'taken')).toEqual({});
  });

  it('groups doses by time for one reminder each', () => {
    expect(doseTimes(meds)).toEqual([
      { at: '08:30', names: ['Metformin', 'Glimepiride'] },
      { at: '21:00', names: ['metformin '] },
    ]);
    expect(medKey(' Metformin ')).toBe('metformin');
  });
});

describe('backup and consent', () => {
  it('round-trips and rejects other files', () => {
    const s = seed('2026-10-23');
    expect(decodeBackup(encodeBackup(s))?.profiles.me.days.length).toBe(6);
    expect(decodeBackup('{"app":"other"}')).toBeNull();
    expect(decodeBackup('not json')).toBeNull();
    expect(decodeBackup(JSON.stringify({ app: 'glucobuddy', v: 99, state: s }))).toBeNull();
  });

  it('asks for consent again when never versioned', () => {
    const s = seed();
    expect(needsConsent(s.setup)).toBe(true);
    expect(needsConsent({ ...s.setup, consentVer: CONSENT_VERSION })).toBe(false);
  });

  it('fills dose times, stock, checkups and after-meal time for older data', () => {
    const s = seed('2026-10-23');
    const old = JSON.parse(JSON.stringify(s));
    delete old.setup.ta;
    old.setup.consentAt = 1;
    old.setup.tm = '09:00';
    for (const id in old.profiles) {
      delete old.profiles[id].stock;
      delete old.profiles[id].checkups;
      for (const m of old.profiles[id].meds) delete m.at;
    }
    const n = normalize(old);
    expect(n.setup).toMatchObject({ ta: '14:30', consentVer: 1 });
    expect(n.profiles.me.meds.map((m) => m.at)).toEqual(['09:00', '21:00']);
    expect(n.profiles.me).toMatchObject({ stock: {}, checkups: {} });
  });
});
