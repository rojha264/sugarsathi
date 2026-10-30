import { expect, test } from '@playwright/test';

test('search autocompletes in Hindi or English on lists and pickers', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('owner@glucobuddy.local');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByText('My patients').waitFor();

  // Foods list: Hindi query, English food suggested; picking opens it.
  await page.goto('/foods');
  await page.getByPlaceholder(/Search foods/).fill('रोटी');
  await expect(page.locator('.ant-select-item-option').first()).toContainText('Roti');
  await expect(page.locator('.ant-table-tbody tr.ant-table-row').first()).toContainText('Roti');
  await page.locator('.ant-select-item-option').first().click();
  await expect(page).toHaveURL(/\/foods\/edit\/roti/);

  // Hinglish spelling in a food picker (thali builder).
  await page.goto('/thalis');
  await page.getByRole('button', { name: /new thali/i }).click();
  const search = page.getByRole('combobox');
  await search.click();
  await search.fill('chaval');
  await expect(page.locator('.ant-select-item-option').first()).toContainText('Rice');
});
