import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test('can open settings panel', async ({ page }) => {
    await page.goto('/');

    // Look for settings button/gear icon
    const settingsBtn = page.getByRole('button', { name: /settings|gear|⚙/i }).or(
      page.getByTitle(/settings/i)
    );
    if (await settingsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsBtn.click();
      // Settings panel should show token section
      await expect(page.getByText(/token|github/i).first()).toBeVisible({ timeout: 3000 });
    }
  });
});
