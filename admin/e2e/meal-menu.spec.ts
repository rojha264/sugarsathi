import { expect, test } from '@playwright/test';

test('dietitian sets a meal menu for a patient, then resets it to default', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('dietitian2@glucobuddy.local');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText('My patients')).toBeVisible();
  await page.goto('/patients/show/e69a86e0-65f3-425d-bd9c-d67d774494d7');
  await page.getByRole('tab', { name: /Meal menu/ }).click();
  await expect(page.getByText(/Ate something else/)).toBeVisible();

  // Start from the default menu, then add two foods.
  const rows = page.locator('.ant-table-tbody tr.ant-table-row');
  const reset = page.getByRole('button', { name: /Reset to default/ });
  if (await reset.isEnabled()) {
    await reset.click();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.getByRole('button', { name: /Save meal menu/ }).click();
    await expect(page.getByText(/default menu on the next sync/)).toBeVisible();
  }
  await expect(rows).toHaveCount(0);
  const search = page.getByRole('combobox').nth(1);
  for (const q of ['Salad', 'Sambar']) {
    await search.click();
    await search.fill(q);
    await page.locator('.ant-select-item-option').first().click();
  }
  await expect(rows).toHaveCount(2);

  // A category narrows the picker and can add all of its foods at once.
  await page.getByRole('combobox').first().click();
  await page.keyboard.type('Smoothies');
  await page.locator('.ant-select-item-option').filter({ hasText: 'Smoothies' }).first().click();
  const addAll = page.getByRole('button', { name: /Add all \(\d+\)/ });
  await expect(addAll).toBeVisible();
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/meal-menu-category.png`, fullPage: true });
  await page.getByRole('combobox').first().locator('xpath=ancestor::div[contains(@class,"ant-select")][1]').hover();
  await page.locator('.ant-select-clear').first().click();
  await expect(addAll).toBeHidden();
  const lunch = rows.first().getByRole('checkbox', { name: 'Lunch' });
  await lunch.click();
  await expect(lunch).toBeChecked();
  await rows.first().getByRole('combobox').fill('Eat this first, before roti');
  await expect(page.getByText('What the patient sees per meal')).toBeVisible();
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/meal-menu-admin.png`, fullPage: true });
  await page.getByRole('button', { name: /Save meal menu/ }).click();
  await expect(page.getByText(/Saved/)).toBeVisible();
  await expect(page.getByText('Custom menu')).toBeVisible();

  // Reset goes back to the default (diet plan foods or the full list).
  await page.getByRole('button', { name: /Reset to default/ }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(rows).toHaveCount(0);
  await page.getByRole('button', { name: /Save meal menu/ }).click();
  await expect(page.getByText(/default menu on the next sync/)).toBeVisible();
  expect(errors).toEqual([]);
});
