/**
 * P2 第二批（Pagination / Breadcrumb / ContextMenu / Resizable）视觉回归。
 *
 * ⚠️ **快照是平台相关的，这个 project 默认不在 CI 跑。**理由见 playwright.config.ts。
 *
 * 只有 Pagination 与 ContextMenu 是玻璃，所以只有它们跑三档 Tier；
 * Breadcrumb / Resizable 是内容层，跑那三档只是把同一张图存三遍。
 *
 * ⚠️ 背景用渐变而不是分组底色 —— Pagination 的容器是 **Ultrathin**，
 * 压在纯色上根本看不出它是玻璃，快照也就守不住材质。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/nav-demo.html')).href;

async function open(page: Page, only: string, theme: string, tier = 'a', bg = 'gradient') {
  const q = new URLSearchParams({ only, theme, tier, tint: '0.34', bg });
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.waitForTimeout(250);
}

const SHOT = { maxDiffPixelRatio: 0.01 } as const;

for (const theme of ['light', 'dark']) {
  test(`pagination · ${theme}`, async ({ page }) => {
    await open(page, 'pagination', theme);
    await expect(page.getByTestId('row-pagination')).toHaveScreenshot(
      `nav-pagination-${theme}.png`,
      SHOT,
    );
  });

  // 玻璃 → 三档渲染路径都要跑
  for (const tier of ['b', 'c']) {
    test(`pagination · ${theme} · tier ${tier}`, async ({ page }) => {
      await open(page, 'pagination', theme, tier);
      await expect(page.getByTestId('row-pagination')).toHaveScreenshot(
        `nav-pagination-${theme}-tier${tier}.png`,
        SHOT,
      );
    });
  }

  test(`breadcrumb · ${theme}`, async ({ page }) => {
    await open(page, 'breadcrumb', theme, 'a', 'grouped');
    await expect(page.getByTestId('row-breadcrumb')).toHaveScreenshot(
      `nav-breadcrumb-${theme}.png`,
      SHOT,
    );
  });

  test(`resizable · ${theme}`, async ({ page }) => {
    await open(page, 'resizable', theme, 'a', 'grouped');
    await expect(page.getByTestId('row-resizable')).toHaveScreenshot(
      `nav-resizable-${theme}.png`,
      SHOT,
    );
  });

  /*
   * ContextMenu 拍**整页**，不是拍某个盒子 ——
   * 面板是 Portal 出去的，压暗层更是覆盖全屏。
   * 这一条是上一批（Tooltip 气泡从来没被拍到）留下的教训。
   */
  test(`context-menu · ${theme}`, async ({ page }) => {
    await open(page, 'context-menu', theme);
    await page.locator('[data-slot="context-menu-trigger"]').click({ button: 'right' });
    await expect(page.locator('[data-slot="context-menu-content"]')).toBeVisible();
    await page.waitForTimeout(250);
    await expect(page).toHaveScreenshot(`nav-context-menu-${theme}.png`, SHOT);
  });
}

test('context-menu · tier c（丢模糊之后压暗层仍在）', async ({ page }) => {
  await open(page, 'context-menu', 'light', 'c');
  await page.locator('[data-slot="context-menu-trigger"]').click({ button: 'right' });
  await expect(page.locator('[data-slot="context-menu-content"]')).toBeVisible();
  await page.waitForTimeout(250);
  await expect(page).toHaveScreenshot('nav-context-menu-tierc.png', SHOT);
});
