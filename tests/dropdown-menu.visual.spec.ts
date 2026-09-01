/**
 * DropdownMenu 视觉回归。
 *
 * ⚠️ **快照是平台相关的，这个 project 默认不在 CI 跑。**理由见 playwright.config.ts。
 *
 * 这里有一张比别的都重要：`menu-highlight-zoom` —— 高亮项的特写。
 * Layer I 的「可见色散」这条验收在 Sheet 的抓手上是**没达标**的（4pt 太矮），
 * 到菜单项才第一次有 218×40 的尺度可看。那张图就是留给这件事的证据。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/overlay-demo.html')).href;

async function open(page: Page, q: Record<string, string>) {
  const params = new URLSearchParams({ tint: '0.34', tier: 'a', open: '1', only: 'menu', ...q });
  await page.goto(`${HARNESS}?${params}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.waitForTimeout(500);
}

const SHOT = { maxDiffPixelRatio: 0.01 } as const;
const panel = (page: Page) =>
  page.locator('[data-slot="dropdown-menu-content"] .lg-surface[data-layer="elevated"]');

test.describe('桌面路径', () => {
  // 必须 > 768，否则 useIsCompact() 判成紧凑视口，渲染的是 Drawer
  test.use({ viewport: { width: 900, height: 800 } });

  for (const theme of ['light', 'dark']) {
    for (const tier of ['a', 'b', 'c']) {
      test(`${theme} · tier ${tier}`, async ({ page }) => {
        await open(page, { theme, tier });
        await expect(panel(page)).toHaveScreenshot(`menu-${theme}-tier${tier}.png`, SHOT);
      });
    }

    test(`${theme} · 高亮项`, async ({ page }) => {
      await open(page, { theme });
      await page.locator('[data-slot="dropdown-menu-item"]').nth(1).hover();
      await page.waitForTimeout(500);
      await expect(panel(page)).toHaveScreenshot(`menu-${theme}-highlighted.png`, SHOT);
    });
  }

  /**
   * 高亮项特写 —— 判「Layer I 有没有可见色散」的那张图。
   * 只截高亮项加上下各 10px，dsf 2 下就是 456×120 的实像素。
   */
  for (const bg of ['gradient', 'stripes'] as const) {
    test(`高亮项特写（${bg}）—— Layer I 在 218×40 上的实际样子`, async ({ page }) => {
      /**
       * 条纹那张才是判色散的。平滑渐变上折射与色散**本来就看不出来** ——
       * 全库的光学诊断（sweep / ab / 对比度审计）一直用 6px 黑白条纹当高频最坏情况，
       * 同一个道理：没有高频内容，折射就没有可位移的东西。
       */
      await open(page, { theme: 'light', ...(bg === 'stripes' ? { bg: 'stripes' } : {}) });
      const item = page.locator('[data-slot="dropdown-menu-item"]').nth(1);
      await item.hover();
      await page.waitForTimeout(500);
      const b = (await item.boundingBox())!;
      await expect(page).toHaveScreenshot(`menu-highlight-zoom-${bg}.png`, {
        ...SHOT,
        clip: { x: b.x - 6, y: b.y - 10, width: b.width + 12, height: b.height + 20 },
      });
    });
  }
});

test.describe('移动路径 —— 底部 Drawer', () => {
  // 402×874 = 参考图那块屏
  test.use({ viewport: { width: 402, height: 874 } });

  for (const theme of ['light', 'dark']) {
    test(`${theme}`, async ({ page }) => {
      await open(page, { theme });
      await expect(page).toHaveScreenshot(`menu-drawer-${theme}.png`, SHOT);
    });
  }
});
