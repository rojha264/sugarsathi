import { screenName } from '../screen';

describe('screen names for time-in-app', () => {
  it('keeps plain routes and folds ids so screens group together', () => {
    expect(screenName('/')).toBe('/');
    expect(screenName('/meal')).toBe('/meal');
    expect(screenName('/onboarding/lang')).toBe('/onboarding/lang');
    expect(screenName('/remote/8f2c1a90-1b2c-4d5e-9f00-123456789abc')).toBe('/remote/:id');
    expect(screenName('')).toBe('/');
  });
});
