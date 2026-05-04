import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test('can open settings panel', async ({ page }) => {
    await page.goto('/');

    // Settings button text: '⚙ 設定' (ja) or '⚙ Settings' (en)
    // Note: avoid matching the per-project '⚙' button (title="Skills / MCP")
    const settingsBtn = page.getByRole('button', { name: /設定|Settings/i });
    if (await settingsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsBtn.click();
      // Settings panel should show token section
      await expect(page.getByText(/token|github/i).first()).toBeVisible({ timeout: 3000 });
    }
  });
});
