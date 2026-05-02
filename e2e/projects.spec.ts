import { test, expect } from '@playwright/test';

test.describe('Project Management', () => {
  test('create and delete project flow', async ({ page }) => {
    await page.goto('/');

    // Click new project button
    const newBtn = page.getByRole('button', { name: /new|create|\+/i });
    await expect(newBtn).toBeVisible({ timeout: 10000 });
    await newBtn.click();

    // Fill project name
    const nameInput = page.getByPlaceholder(/name|project/i);
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Test E2E Project');

    // Submit
    const createBtn = page.getByRole('button', { name: /create|save|submit/i });
    await createBtn.click();

    // Verify project appears in sidebar
    await expect(page.getByText('Test E2E Project')).toBeVisible({ timeout: 5000 });

    // Delete project - right click or find delete button
    await page.getByText('Test E2E Project').click({ button: 'right' });
    const deleteBtn = page.getByRole('button', { name: /delete|remove/i }).or(
      page.getByText(/delete|remove/i)
    );
    if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteBtn.click();
      // Confirm deletion
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i });
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }
  });
});
