import { expect, test } from '@playwright/test';

test('dietitian edits the active diet plan in place: delete, add, save', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // A patient with an active plan (any veg patient from the demo data).
  const login = await request.post('http://localhost:4000/auth/staff/login', { data: { email: 'owner@glucobuddy.local', password: 'Admin@123' } });
  const token = (await login.json()).accessToken;
  const H = { authorization: `Bearer ${token}` };
  const list = await (await request.get('http://localhost:4000/admin/patients?pageSize=60&diet=veg', { headers: H })).json();
  let pid = '';
  let planId = '';
  for (const r of list.data) {
    const plans = await (await request.get(`http://localhost:4000/admin/diet-plans?patientId=${r.id}`, { headers: H })).json();
    const a = plans.find((p: { status: string; items: { foodId: string }[] }) => p.status === 'active' && p.items.length > 2 && !p.items.some((i) => ['chicken', 'fish', 'egg', 'eggcurry'].includes(i.foodId)));
    if (a) {
      pid = r.id;
      planId = a.id;
      break;
    }
  }
  expect(pid).not.toBe('');
  const before = (await (await request.get(`http://localhost:4000/admin/diet-plans?patientId=${pid}`, { headers: H })).json()).find((p: { id: string }) => p.id === planId).items.length;

  await page.goto('/login');
  await page.getByLabel(/email/i).fill('owner@glucobuddy.local');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText('My patients')).toBeVisible();
  await page.goto(`/patients/show/${pid}`);
  await page.getByRole('tab', { name: /Diet plan/ }).click();

  // Delete the first food of the first meal shown, then add one.
  const card = page.locator('.ant-card').filter({ has: page.locator('.ant-card-head-title', { hasText: /Breakfast|Lunch/ }) }).first();
  await card.locator('.ant-table-tbody tr.ant-table-row').first().locator('button').last().click();
  await expect(page.getByText('Unsaved changes to this plan')).toBeVisible();
  await card.getByRole('combobox').last().click();
  await page.keyboard.type('Salad');
  await page.locator('.ant-select-item-option').first().click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText(/Plan updated/)).toBeVisible();

  const after = (await (await request.get(`http://localhost:4000/admin/diet-plans?patientId=${pid}`, { headers: H })).json()).find((p: { id: string }) => p.id === planId).items.length;
  expect(after).toBe(before); // one removed, one added
  expect(errors).toEqual([]);
});
