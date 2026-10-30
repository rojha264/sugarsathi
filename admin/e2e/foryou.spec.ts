import { expect, test } from '@playwright/test';

test('dietitian picks "For you" foods for a patient', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('dietitian2@glucobuddy.local');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText('My patients')).toBeVisible();
  await page.goto('/patients/show/e69a86e0-65f3-425d-bd9c-d67d774494d7');
  await page.getByRole('tab', { name: /For you foods/ }).click();
  await expect(page.getByText(/appear first in the patient/)).toBeVisible();

  // Start clean, then add two foods.
  const rows = page.locator('.ant-table-tbody tr.ant-table-row');
  while (await rows.count()) await rows.first().getByRole('button', { name: 'Remove' }).click();
  const search = page.getByRole('combobox').first();
  for (const q of ['Salad', 'Sambar']) {
    await search.click();
    await search.fill(q);
    await page.locator('.ant-select-item-option').first().click();
  }
  await expect(rows).toHaveCount(2);
  const lunch = rows.first().getByRole('checkbox', { name: 'Lunch' });
  await lunch.click();
  await expect(lunch).toBeChecked();
  await rows.first().getByRole('combobox').fill('Eat this first, before roti');
  await expect(page.getByText('What the patient sees per meal')).toBeVisible();
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/foryou-admin.png`, fullPage: true });
  await page.getByRole('button', { name: /Save "For you" foods/ }).click();
  await expect(page.getByText(/Saved/)).toBeVisible();
  expect(errors).toEqual([]);
});
