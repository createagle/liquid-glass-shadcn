/**
 * Tabs 视觉回归。
 *
 * ⚠️ **快照是平台相关的，这个 project 默认不在 CI 跑。**
 *
 * 已实测：Windows（有 GPU）与 Linux CI（headless 软件光栅）的 `blur()` 渲染
 * 不一致，同一个对比度测点能差 0.5（记录见 STATUS.md §0.5）。
 * 本机生成的基线推到 CI 上必然全红。
 *
 * Playwright 会给快照名加平台后缀（`-win32` / `-linux`），两套可以共存 ——
 * 但 Linux 那套必须**在 Linux 环境生成一次**。在那之前这里只是本地工具，
 * 这一点在 STATUS 里如实标注，不当作已完成的验收项。
 *
 * 跑法：
 *   npx playwright test --project=visual                  比对
 *   npx playwright test --project=visual --update-snapshots 重录基线
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/tabs-demo.html')).href;

async function open(page: Page, theme: string, tier: string, tint: number) {
  await page.goto(`${HARNESS}?theme=${theme}&tier=${tier}&tint=${tint}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

/**
 * 只截**底座**而不是整页：背景渐变里有大片平滑色带，
 * 编码噪声会让整页比对变得脆弱，而我们要盯的是组件本身。
 */
for (const theme of ['light', 'dark']) {
  for (const tier of ['a', 'b', 'c']) {
    for (const tint of [0, 0.34, 1]) {
      test(`${theme} · tier ${tier} · 档位 ${tint}`, async ({ page }) => {
        await open(page, theme, tier, tint);
        await expect(page.locator('.lg-surface[data-layer="base"]')).toHaveScreenshot(
          `tabs-${theme}-tier${tier}-tint${tint}.png`,
          {
            // 抗锯齿与合成会带来零星像素差，留一点余量避免噪声误报；
            // 但不能开太大，否则真实回归也会被放过。
            maxDiffPixelRatio: 0.01,
          },
        );
      });
    }
  }
}

test('切换选中项后指示器移动到位', async ({ page }) => {
  await open(page, 'light', 'a', 0.34);
  await page.getByRole('tab', { name: '搜索' }).click();
  await page.waitForTimeout(800); // 等 spring 静止
  await expect(page.locator('.lg-surface[data-layer="base"]')).toHaveScreenshot(
    'tabs-selected-last.png',
    { maxDiffPixelRatio: 0.01 },
  );
});
