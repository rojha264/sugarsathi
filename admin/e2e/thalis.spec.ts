import { expect, test } from '@playwright/test';

test('dietitian builds a thali with live nutrition and an app preview', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shots = process.env.SHOTS_DIR;
  await page.goto('/login');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText('My patients')).toBeVisible();
  await page.goto('/thalis');
  await expect(page.getByText('North thali')).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/thalis-list.png`, fullPage: true });

  const name = `E2E plate ${Date.now() % 100000}`;
  await page.getByRole('button', { name: /new thali/i }).click();
  await page.getByPlaceholder('e.g. South Indian breakfast').fill(name);
  await page.getByPlaceholder('जैसे दक्षिण भारतीय नाश्ता').fill('ई2ई थाली');
  const search = page.getByRole('combobox');
  for (const q of ['Roti', 'Dal', 'Salad']) {
    await search.click();
    await search.fill(q);
    await page.locator('.ant-select-item-option').first().click();
  }
  await expect(page.getByText('Plate balance')).toBeVisible();
  await expect(page.getByText('📱 In the app')).toBeVisible();
  await expect(page.getByText(/Shown to:/)).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/thali-editor.png` });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(name)).toBeVisible();

  // Clean up so reruns start fresh.
  const card = page.locator('.ant-card').filter({ hasText: name });
  await card.locator('.anticon-delete').click();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByText(name)).toHaveCount(0);
  expect(errors).toEqual([]);
});
