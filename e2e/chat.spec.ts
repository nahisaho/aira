import { test, expect } from '@playwright/test';

test.describe('Chat Functionality', () => {
  test('send message shows in chat', async ({ page }) => {
    await page.goto('/');

    // Create a fresh project with a unique name
    const projectName = `Chat Test ${Date.now()}`;
    const newBtn = page.getByRole('button', { name: /新規|New/i }).first();
    if (await newBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newBtn.click();
      const nameInput = page.getByPlaceholder(/入力|Enter project/i);
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill(projectName);
        // ja: '作成' / en: 'Create'
        const createBtn = page.getByRole('button', { name: /作成|Create/ });
        await createBtn.click();
        // Wait for modal to close
        await expect(nameInput).not.toBeVisible({ timeout: 5000 });
      }
    }

    // Select the project if not already selected (uses data-testid)
    const projectItem = page.locator('[data-testid="project-item"]').filter({ hasText: projectName });
    if (await projectItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await projectItem.click();
    }

    // Type a message
    const input = page.getByPlaceholder(/入力|type/i);
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill('Hello AIRA');
    await input.press('Enter');

    // Message should appear in chat area
    await expect(page.getByText('Hello AIRA')).toBeVisible({ timeout: 5000 });
  });
});
