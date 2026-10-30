import { expect, test } from '@playwright/test';

test('owner reviews Kickstart plans and opens the 14-day template builder', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shots = process.env.SHOTS_DIR;
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('owner@glucobuddy.local');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText('🚀 Kickstart reviews')).toBeVisible();

  await page.goto('/programs');
  await expect(page.getByText('Veg · North Indian').first()).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/programs.png`, fullPage: true });
  await page.getByText('Veg · South Indian', { exact: true }).click();
  await expect(page.getByText('Meals by day')).toBeVisible();
  await page.getByText('Day 3', { exact: true }).click();
  await expect(page.getByText('Day total (day 3)')).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/program-editor.png` });
  await page.getByRole('tab', { name: /Tips, sugar checks/ }).click();
  await expect(page.getByText('Fasting').first()).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.goto('/kickstart');
  await expect(page.getByText('Kickstart (14-day plans)')).toBeVisible();
  const approve = page.getByRole('button', { name: /Approve/ }).first();
  if (await approve.count()) {
    if (shots) await page.screenshot({ path: `${shots}/kickstart-queue.png`, fullPage: true });
    await approve.click();
    await expect(page.getByText(/plan starts tomorrow/)).toBeVisible();
  }
  expect(errors).toEqual([]);
});
