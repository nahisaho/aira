import { test, expect } from '@playwright/test';

test.describe('Project Management', () => {
  test('create and delete project flow', async ({ page }) => {
    await page.goto('/');

    // Use a unique name to avoid conflicts across test runs
    const projectName = `E2E Project ${Date.now()}`;

    // Click new project button (ja: '+ 新規' / en: '+ New')
    const newBtn = page.getByRole('button', { name: /新規|New/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 10000 });
    await newBtn.click();

    // Fill project name (placeholder: 'プロジェクト名を入力' ja / 'Enter project name' en)
    const nameInput = page.getByPlaceholder(/入力|Enter project/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(projectName);

    // Submit (ja: '作成' / en: 'Create')
    const createBtn = page.getByRole('button', { name: /作成|Create/ });
    await createBtn.click();

    // Modal should close and project appears in sidebar
    await expect(page.getByText(projectName)).toBeVisible({ timeout: 5000 });

    // Delete: find the specific project row, then click its delete button
    const projectRow = page.locator('[data-testid="project-row"]').filter({ has: page.getByText(projectName) });
    await projectRow.hover();
    const deleteBtn = projectRow.locator('[data-testid="delete-project-btn"]');
    await expect(deleteBtn).toBeVisible({ timeout: 3000 });
    await deleteBtn.click();

    // Confirm deletion in the dialog (ja: '削除' / en: 'Delete')
    const confirmBtn = page.getByRole('button', { name: /^削除$|^Delete$/ });
    await expect(confirmBtn).toBeVisible({ timeout: 3000 });
    await confirmBtn.click();

    // Project should disappear from sidebar
    await expect(
      page.locator('[data-testid="project-row"]').filter({ hasText: projectName })
    ).not.toBeVisible({ timeout: 5000 });
  });
});
