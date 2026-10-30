import { expect, test } from '@playwright/test';

test('patients are split into trial and subscriber tabs, and a trial can be converted', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shots = process.env.SHOTS_DIR;
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('owner@glucobuddy.local');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText(/Trials ending ≤ 3 days/)).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/dash-lifecycle.png` });

  await page.goto('/patients');
  await page.getByText(/On trial \(/).click();
  await expect(page.getByText(/Trial day \d+\/14/).first()).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/tab-trial.png`, fullPage: true });

  await page.getByText(/Subscribers \(/).click();
  await expect(page.getByText(/renews in|ends today/).first()).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/tab-subscribers.png`, fullPage: true });

  // Convert the first trial patient.
  await page.getByText(/On trial \(/).click();
  await expect(page.getByText(/Trial day \d+\/14/).first()).toBeVisible();
  await page.getByRole('button', { name: /Start subscription/ }).first().click();
  await expect(page.locator('.ant-modal-title', { hasText: 'Start subscription' })).toBeVisible();
  await page.getByPlaceholder('e.g. 4321XXXX9876').fill('E2E-UPI-1');
  if (shots) await page.screenshot({ path: `${shots}/sub-modal.png` });
  await page.getByRole('button', { name: /Record payment/ }).click();
  await expect(page.getByText(/Subscription started/)).toBeVisible();
  expect(errors).toEqual([]);
});
