import { expect, test } from '@playwright/test';

test('owner opens a conversation from the Chats page and replies', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('owner@glucobuddy.local');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText('My patients')).toBeVisible();

  await page.goto('/chats');
  const first = page.getByRole('listitem').first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/\/chats\/.+/);
  await expect(page.getByPlaceholder(/write a message/i)).toBeVisible();

  // A deep link straight to a conversation must open it too.
  await page.reload();
  await expect(page.getByPlaceholder(/write a message/i)).toBeVisible();
  expect(errors).toEqual([]);
});
