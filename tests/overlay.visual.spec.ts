/**
 * Popover / ResponsiveOverlay 视觉回归。
 *
 * ⚠️ **快照是平台相关的，这个 project 默认不在 CI 跑。**理由见 playwright.config.ts。
 *
 * ResponsiveOverlay 那几张是**整屏**：这个原语的价值就在于「同一段调用在两种
 * 视口下长成两个东西」，只截浮层本身就把这件事截没了。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/overlay-demo.html')).href;

async function open(
  page: Page,
  q: Record<string, string>,
) {
  const params = new URLSearchParams({ tint: '0.34', tier: 'a', open: '1', ...q });
  await page.goto(`${HARNESS}?${params}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.waitForTimeout(600);
}

const SHOT = { maxDiffPixelRatio: 0.01 } as const;
const panel = (page: Page) => page.locator('[data-slot="popover-content"]');

test.describe('Popover', () => {
  for (const theme of ['light', 'dark']) {
    for (const tier of ['a', 'b', 'c']) {
      test(`${theme} · tier ${tier}`, async ({ page }) => {
        await open(page, { theme, tier, only: 'popover' });
        await expect(panel(page)).toHaveScreenshot(`popover-${theme}-tier${tier}.png`, SHOT);
      });
    }
    for (const tint of ['0', '1']) {
      test(`${theme} · 材质档位 ${tint}`, async ({ page }) => {
        await open(page, { theme, tint, only: 'popover' });
        await expect(panel(page)).toHaveScreenshot(`popover-${theme}-tint${tint}.png`, SHOT);
      });
    }
  }

  test('side=top · align=end —— 缩放原点换到右下角', async ({ page }) => {
    await open(page, { theme: 'light', only: 'popover', side: 'top', align: 'end' });
    await expect(panel(page)).toHaveScreenshot('popover-top-end.png', SHOT);
  });
});

test.describe('ResponsiveOverlay —— 同一段调用，两种视口', () => {
  test.describe('桌面', () => {
    test.use({ viewport: { width: 1280, height: 800 } });
    for (const theme of ['light', 'dark']) {
      test(`${theme}`, async ({ page }) => {
        await open(page, { theme, only: 'responsive' });
        await expect(page).toHaveScreenshot(`overlay-desktop-${theme}.png`, SHOT);
      });
    }
  });

  test.describe('紧凑视口', () => {
    // 402×874 = 参考图那块屏
    test.use({ viewport: { width: 402, height: 874 } });
    for (const theme of ['light', 'dark']) {
      test(`${theme}`, async ({ page }) => {
        await open(page, { theme, only: 'responsive' });
        await expect(page).toHaveScreenshot(`overlay-compact-${theme}.png`, SHOT);
      });
    }
  });
});
