import { expect, test } from '@playwright/test';

test('owner sees growth, funnel, retention and time-in-app analytics', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('owner@glucobuddy.local');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText('Waiting for a dietitian')).toBeVisible();
  await page.getByRole('link', { name: /analytics/i }).first().click();
  await expect(page.getByText('Onboarding funnel')).toBeVisible();
  await expect(page.getByText('Time per user per day')).toBeVisible();
  await expect(page.getByText('Verified phone (signed up)').first()).toBeVisible();
  await page.waitForTimeout(1200);
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/analytics.png`, fullPage: true });
  await page.getByText('90 days').click();
  await expect(page.getByText('New users (90 d)')).toBeVisible();
  expect(errors).toEqual([]);
});
