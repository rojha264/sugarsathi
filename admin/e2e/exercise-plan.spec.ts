import { expect, test } from '@playwright/test';

test('dietitian adds an exercise to a chosen day of a 14-day plan', async ({ page, request }) => {
  const login = await request.post('http://localhost:4000/auth/staff/login', { data: { email: 'owner@glucobuddy.local', password: 'Admin@123' } });
  const token = (await login.json()).accessToken as string;
  const list = await request.get('http://localhost:4000/admin/patients?lifecycle=trial&pageSize=1', { headers: { Authorization: `Bearer ${token}` } });
  const patient = (await list.json()).data[0] as { id: string };

  await page.goto('/login');
  await page.getByLabel(/email/i).fill('owner@glucobuddy.local');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByText('My patients').waitFor();
  await page.goto(`/patients/show/${patient.id}`);
  await page.getByRole('tab', { name: /Exercise plan/ }).click();

  // Rows come sorted by day.
  await expect(page.locator('.ant-table-tbody tr.ant-table-row').first()).toContainText(/Day 1|Every day/);

  // Pick the day, then the exercise: editing opens by itself.
  const card = page.locator('.ant-card', { hasText: 'Add an exercise' });
  await card.locator('.ant-select').first().click();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(card.locator('.ant-select-selection-item').first()).toHaveText('Day 5');
  await card.getByRole('combobox').last().click();
  await card.getByRole('combobox').last().fill('सूर्य');
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: 'Surya' }).click();
  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect(page.getByText(/Exercise plan saved/)).toBeVisible();

  const plans = await request.get(`http://localhost:4000/admin/exercise-plans?patientId=${patient.id}`, { headers: { Authorization: `Bearer ${token}` } });
  const active = ((await plans.json()) as { status: string; items: { day: number | null }[] }[]).find((p) => p.status === 'active')!;
  expect(active.items.filter((i) => i.day === 5).length).toBeGreaterThanOrEqual(2);
});
