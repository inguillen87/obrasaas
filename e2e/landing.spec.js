import { expect, test } from '@playwright/test';

test.describe('landing responsive navigation', () => {
  test.use({ viewport: { width: 900, height: 900 } });

  test('restores page scrolling when an open mobile menu crosses into desktop', async ({ page }) => {
    await page.goto('/');

    const trigger = page.locator('button[aria-controls="mobile-navigation-panel"]');
    await trigger.click();

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

    await page.setViewportSize({ width: 1100, height: 900 });

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#mobile-navigation-panel')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  });
});
