/**
 * P2 第三批（Sidebar / Menubar / Navigation Menu）视觉回归。
 *
 * ⚠️ **快照是平台相关的，这个 project 默认不在 CI 跑。**理由见 playwright.config.ts。
 *
 * 背景一律用**渐变**：这一批的看点是材质（侧栏比控件层更不透明），
 * 压在纯色底上三档看起来一模一样，快照就守不住任何东西。
 *
 * ⚠️ 只有 Sidebar 与 NavigationMenu 的面板是玻璃，所以只有它们跑三档 Tier；
 *    Menubar 的条本身没有材质（实测），跑三档只是把同一张图存三遍。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/nav2-demo.html')).href;

async function open(page: Page, only: string, theme: string, tier = 'a') {
  const q = new URLSearchParams({ only, theme, tier, tint: '0.34', bg: 'gradient' });
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.waitForTimeout(300);
}

const SHOT = { maxDiffPixelRatio: 0.01 } as const;

for (const theme of ['light', 'dark']) {
  test(`sidebar · ${theme}`, async ({ page }) => {
    await open(page, 'sidebar', theme);
    await expect(page.getByTestId('row-sidebar')).toHaveScreenshot(
      `nav2-sidebar-${theme}.png`,
      SHOT,
    );
  });

  // 玻璃 → 三档渲染路径都要跑
  for (const tier of ['b', 'c']) {
    test(`sidebar · ${theme} · tier ${tier}`, async ({ page }) => {
      await open(page, 'sidebar', theme, tier);
      await expect(page.getByTestId('row-sidebar')).toHaveScreenshot(
        `nav2-sidebar-${theme}-tier${tier}.png`,
        SHOT,
      );
    });
  }

  /*
   * 材质对照 —— 本批唯一一张真正「有信息量」的图：
   * 同一块背景上，左边控件层玻璃、右边侧栏玻璃。
   * 那句 HIG「more opaque in larger elements like sidebars」肉眼可见与否，
   * 全靠这一张。
   */
  test(`scale 对照 · ${theme}`, async ({ page }) => {
    await open(page, 'scale', theme);
    await expect(page.getByTestId('row-scale')).toHaveScreenshot(
      `nav2-scale-${theme}.png`,
      SHOT,
    );
  });

  test(`menubar · ${theme}`, async ({ page }) => {
    await open(page, 'menubar', theme);
    await expect(page.getByTestId('row-menubar')).toHaveScreenshot(
      `nav2-menubar-${theme}.png`,
      SHOT,
    );
  });

  /*
   * 面板是 Portal 出去的 —— 拍**整页**，不是拍某个盒子。
   * 这一条是 Tooltip 气泡从来没被拍到那次留下的教训。
   */
  test(`menubar 展开 · ${theme}`, async ({ page }) => {
    await open(page, 'menubar', theme);
    await page.getByTestId('mb-app').click();
    await expect(page.getByTestId('mb-about')).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot(`nav2-menubar-open-${theme}.png`, SHOT);
  });

  test(`navigation-menu · ${theme}`, async ({ page }) => {
    await open(page, 'navigation-menu', theme);
    await page.getByTestId('nm-trigger-a').click();
    await expect(page.locator('[data-slot="navigation-menu-panel"]')).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot(`nav2-navmenu-${theme}.png`, SHOT);
  });
}
