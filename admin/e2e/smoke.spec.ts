import { expect, test } from '@playwright/test';

const shots = process.env.SHOTS_DIR;
const snap = async (page: import('@playwright/test').Page, name: string) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: false });
};

test('dietitian finds high-fasting patients, opens one, plans a diet and notifies', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText('My patients')).toBeVisible();
  await page.waitForTimeout(1200);
  await snap(page, '1-dashboard');

  await page.goto('/patients');
  await page.getByPlaceholder('e.g. 180').fill('180');
  await page.getByPlaceholder('e.g. 250').fill('250');
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.waitForTimeout(1200);
  const rows = page.locator('.ant-table-tbody tr.ant-table-row');
  await expect(rows.first()).toBeVisible();
  await snap(page, '2-patients-fasting-180-250');

  await rows.first().locator('td').nth(1).click();
  await expect(page.getByText('Blood sugar')).toBeVisible();
  await page.waitForTimeout(1500);
  await snap(page, '3-patient-overview');

  await page.getByRole('tab', { name: /Diet plan/ }).click();
  await page.waitForTimeout(1200);
  await snap(page, '4-diet-plan');

  await page.getByRole('button', { name: /Send notification/ }).click();
  await expect(page.getByText('Who gets it')).toBeVisible();
  await page.getByLabel('Title (English)').fill('Recheck fasting sugar');
  await page.getByLabel('Message (English)').fill('Please check before tea tomorrow and log it in the app.');
  await expect(page.getByText('1 patient(s) will get this')).toBeVisible();
  await snap(page, '5-compose');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Recheck fasting sugar').first()).toBeVisible();
  await snap(page, '6-notifications');

  await page.goto('/foods');
  await page.waitForTimeout(1000);
  await snap(page, '7-foods');
});
