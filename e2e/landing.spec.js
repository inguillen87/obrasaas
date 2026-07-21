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

  test('mobile navigation lands on the requested section below the sticky header', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await page.locator('button[aria-controls="mobile-navigation-panel"]').click();
    await page.locator('#mobile-navigation-panel a[href="#precios"]').click();

    await expect(page).toHaveURL(/#precios$/);
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
    await expect.poll(async () => page.locator('#precios').evaluate(
      (section) => Math.round(section.getBoundingClientRect().top),
    )).toBeGreaterThanOrEqual(80);
    await expect.poll(async () => page.locator('#precios').evaluate(
      (section) => Math.round(section.getBoundingClientRect().top),
    )).toBeLessThanOrEqual(112);
  });
});
