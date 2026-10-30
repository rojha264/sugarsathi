import { expect, test } from '@playwright/test';

const shots = process.env.SHOTS_DIR;

test('dietitian adds sample YouTube videos to an exercise', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText('My patients')).toBeVisible();
  await page.goto('/exercises');
  await page.getByText('Brisk walk').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Sample videos (YouTube)')).toBeVisible();

  await dialog.getByRole('button', { name: /Add sample video/ }).click();
  await dialog.getByPlaceholder(/youtu\.be/).nth(0).fill('https://www.youtube.com/watch?v=SPTWBCwAZEs');
  await dialog.getByPlaceholder(/Title/).nth(0).fill('5-minute indoor walk');
  await expect(dialog.getByText('SPTWBCwAZEs')).toBeVisible();

  await dialog.getByRole('button', { name: /Add sample video/ }).click();
  await dialog.getByPlaceholder(/youtu\.be/).nth(1).fill('https://vimeo.com/12345');
  await expect(dialog.getByText('Not a YouTube video link').first()).toBeVisible();
  await dialog.getByPlaceholder(/youtu\.be/).nth(1).fill('https://m.youtube.com/watch?v=bO6NNfX_1ns');
  await dialog.getByPlaceholder(/Title/).nth(1).fill('10-minute walk for seniors');
  await expect(dialog.getByText('bO6NNfX_1ns')).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/v1-admin-videos.png` });

  await dialog.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByText('Saved')).toBeVisible();
  await expect(page.locator('tr', { hasText: 'Brisk walk' }).getByText('+1')).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/v2-admin-list.png` });
});
