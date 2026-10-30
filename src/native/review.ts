import * as StoreReview from 'expo-store-review';

import { repo } from '@/data/repo';
import { sugarStatus } from '@/logic/sugar';
import type { Profile } from '@/types';

const ASKED_KEY = 'review-asked';
/** A "good week": this many of the last 7 days scored at least GOOD_SCORE. */
const GOOD_DAYS = 5;
const GOOD_SCORE = 60;

/** True when the person is having a good week and has not been asked yet (never right after a worrying reading). */
export function reviewDue(p: Pick<Profile, 'days' | 'sugar'>, asked: boolean): boolean {
  if (asked) return false;
  if (p.sugar.some((r) => sugarStatus(r.v, r.ctx).l === 'r')) return false;
  return p.days.slice(-7).filter((d) => d.score >= GOOD_SCORE).length >= GOOD_DAYS;
}

/** Asks for a store rating once, at a happy moment. The store decides whether the dialog actually shows. */
export async function maybeAskReview(p: Pick<Profile, 'days' | 'sugar'>) {
  try {
    if (!reviewDue(p, repo.getItem(ASKED_KEY) === '1')) return;
    if (!(await StoreReview.isAvailableAsync()) || !(await StoreReview.hasAction())) return;
    repo.setItem(ASKED_KEY, '1');
    await StoreReview.requestReview();
  } catch {
    // Ratings are optional; never bother the user with an error.
  }
}
