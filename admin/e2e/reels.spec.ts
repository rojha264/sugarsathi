import { expect, test } from '@playwright/test';

test('staff add a YouTube Shorts reel with Hindi and English titles', async ({ page, request }) => {
  const title = `E2E reel ${Date.now() % 100000}`;
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('owner@glucobuddy.local');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByText('My patients').waitFor();
  await page.goto('/reels');
  await page.getByRole('button', { name: /New reel/ }).click();
  const modal = page.locator('.ant-modal');
  await modal.getByLabel('YouTube link').fill('https://www.youtube.com/shorts/abcdefghijk');
  await expect(modal.getByText(/Video id/)).toBeVisible();
  await modal.getByLabel('Title (English)').fill(title);
  await expect(modal.getByText(/Hindi title missing/)).toBeVisible();
  await modal.getByLabel(/शीर्षक/).fill('टेस्ट रील');
  await modal.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/Phones get it on their next sync/)).toBeVisible();
  await expect(page.locator('.ant-list-item', { hasText: title })).toContainText('टेस्ट रील');

  // Clean up through the API.
  const login = await request.post('http://localhost:4000/auth/staff/login', { data: { email: 'owner@glucobuddy.local', password: 'Admin@123' } });
  const token = (await login.json()).accessToken as string;
  const rows = (await (await request.get('http://localhost:4000/admin/reels', { headers: { Authorization: `Bearer ${token}` } })).json()).data as { id: string; titleEn: string }[];
  for (const r of rows.filter((x) => x.titleEn === title)) await request.delete(`http://localhost:4000/admin/reels/${r.id}`, { headers: { Authorization: `Bearer ${token}` } });
});
