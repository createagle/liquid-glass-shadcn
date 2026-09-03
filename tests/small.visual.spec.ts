/**
 * Phase 7 第二批（Progress / Badge / Separator / Skeleton / Avatar）视觉回归。
 *
 * ⚠️ **快照是平台相关的，这个 project 默认不在 CI 跑。**理由见 playwright.config.ts。
 *
 * 覆盖策略直接照搬这一批的分层结论 —— 谁吃那组变量谁才跑：
 *
 *   Progress   **跑 tier A/B/C 与档位两个端点**。它的轨道是 Layer B，
 *              三条渲染路径与档位真的会改变它的样子。
 *   其余四个   **只跑明暗**。它们是内容层，一块玻璃都没有，
 *              跑 tier 等于把同一张图存三遍（Card 那边也是这么定的）。
 *
 * Skeleton 的微光是无限循环动画 —— Playwright 截图时会 disable CSS animations，
 * 所以快照拿到的是第一帧，稳定可比。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/small-demo.html')).href;

async function open(page: Page, only: string, theme: string, tier = 'a', tint = '0.34') {
  const q = new URLSearchParams({ only, theme, tier, tint });
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.waitForTimeout(200);
}

const row = (page: Page) => page.locator('[data-testid^="row-"]');
const SHOT = { maxDiffPixelRatio: 0.01 } as const;

for (const theme of ['light', 'dark']) {
  for (const only of ['badge', 'separator', 'skeleton', 'avatar']) {
    test(`${only} · ${theme}`, async ({ page }) => {
      await open(page, only, theme);
      await expect(row(page)).toHaveScreenshot(`small-${only}-${theme}.png`, SHOT);
    });
  }

  for (const tier of ['a', 'b', 'c']) {
    test(`progress · ${theme} · tier ${tier}`, async ({ page }) => {
      await open(page, 'progress', theme, tier);
      await expect(row(page)).toHaveScreenshot(`small-progress-${theme}-tier${tier}.png`, SHOT);
    });
  }

  for (const tint of ['0', '1']) {
    test(`progress · ${theme} · 材质档位 ${tint}`, async ({ page }) => {
      await open(page, 'progress', theme, 'a', tint);
      await expect(row(page)).toHaveScreenshot(`small-progress-${theme}-tint${tint}.png`, SHOT);
    });
  }
}
