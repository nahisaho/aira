import { test, expect } from '@playwright/test';

test.describe('Chat Functionality', () => {
  test('send message shows in chat', async ({ page }) => {
    await page.goto('/');

    // First create a project if needed
    const newBtn = page.getByRole('button', { name: /new|create|\+/i });
    if (await newBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newBtn.click();
      const nameInput = page.getByPlaceholder(/name|project/i);
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('Chat Test Project');
        const createBtn = page.getByRole('button', { name: /create|save/i });
        await createBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Select the project if not selected
    const projectItem = page.getByText(/Chat Test|Projects/i).first();
    if (await projectItem.isVisible()) {
      await projectItem.click();
    }

    // Type a message
    const input = page.getByPlaceholder(/message|type|send/i);
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill('Hello AIRA');
    await input.press('Enter');

    // Message should appear in chat area
    await expect(page.getByText('Hello AIRA')).toBeVisible({ timeout: 5000 });
  });
});
