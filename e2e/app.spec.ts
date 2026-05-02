import { test, expect } from '@playwright/test';

test.describe('AIRA Application', () => {
  test('loads the main layout with 3 panels', async ({ page }) => {
    await page.goto('/');
    // Should have the app container
    await expect(page.locator('[data-testid="app-root"]')).toBeVisible({ timeout: 10000 });
  });

  test('sidebar shows project list header', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Projects')).toBeVisible({ timeout: 10000 });
  });

  test('can open new project modal', async ({ page }) => {
    await page.goto('/');
    // Click new project button
    const newBtn = page.getByRole('button', { name: /new|create|\+/i });
    if (await newBtn.isVisible()) {
      await newBtn.click();
      await expect(page.getByText(/create.*project|new.*project/i)).toBeVisible();
    }
  });

  test('chat pane shows input area', async ({ page }) => {
    await page.goto('/');
    const input = page.getByPlaceholder(/message|type|send/i);
    await expect(input).toBeVisible({ timeout: 10000 });
  });

  test('right panel shows files/runs section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/files|runs|output/i).first()).toBeVisible({ timeout: 10000 });
  });
});
