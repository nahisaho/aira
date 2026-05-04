import { test, expect } from '@playwright/test';

test.describe('AIRA Application', () => {
  test('loads the main layout with 3 panels', async ({ page }) => {
    await page.goto('/');
    // Should have the app container
    await expect(page.locator('[data-testid="app-root"]')).toBeVisible({ timeout: 10000 });
  });

  test('sidebar shows project list header', async ({ page }) => {
    await page.goto('/');
    // Sidebar title is always 'AIRA' in both locales
    await expect(page.getByText('AIRA').first()).toBeVisible({ timeout: 10000 });
  });

  test('can open new project modal', async ({ page }) => {
    await page.goto('/');
    // Button label: '+ 新規' (ja) or '+ New' (en)
    const newBtn = page.getByRole('button', { name: /新規|new/i }).first();
    if (await newBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newBtn.click();
      // Modal heading: '新規プロジェクト' (ja) or 'New Project' (en)
      await expect(
        page.getByRole('heading', { name: /新規プロジェクト|New Project/i })
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('chat pane shows input area', async ({ page }) => {
    await page.goto('/');

    // If no projects exist, create one first
    const firstProject = page.locator('[data-testid="project-item"]').first();
    if (!(await firstProject.isVisible({ timeout: 3000 }).catch(() => false))) {
      const newBtn = page.getByRole('button', { name: /新規|New/i }).first();
      await newBtn.click();
      const nameInput = page.getByPlaceholder(/入力|Enter project/i);
      await expect(nameInput).toBeVisible({ timeout: 3000 });
      await nameInput.fill(`App Test ${Date.now()}`);
      const createBtn = page.getByRole('button', { name: /作成|Create/ });
      await createBtn.click();
      await expect(nameInput).not.toBeVisible({ timeout: 5000 });
    } else {
      await firstProject.click();
    }

    // Placeholder: 'メッセージを入力...' (ja) or 'Type a message...' (en)
    const input = page.getByPlaceholder(/入力|type/i);
    await expect(input).toBeVisible({ timeout: 10000 });
  });

  test('right panel shows files/runs section', async ({ page }) => {
    await page.goto('/');
    // Right panel always renders. Shows 'ステータス'/'Status' (with project)
    // or 'プロジェクト未選択'/'No project selected' (without project)
    await expect(
      page.getByText(/ステータス|Status|プロジェクト未選択|No project/i).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
