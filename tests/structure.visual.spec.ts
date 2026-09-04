/**
 * P2 第一批（Accordion / Collapsible / ScrollArea / Table）视觉回归。
 *
 * ⚠️ **快照是平台相关的，这个 project 默认不在 CI 跑。**理由见 playwright.config.ts。
 *
 * ⚠️ 与 toggles2 那批同理：这四个都没有玻璃，**不跑 Tier A/B/C，也不跑材质档位** ——
 * 那两个维度对它们不存在。唯一的例外是 ScrollArea 的边缘效果，
 * 它在 Tier C 下会丢掉模糊、改用加浓的雾（core 的降级），所以那一格跑三档。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/structure-demo.html')).href;

async function open(page: Page, only: string, theme: string, tier = 'a') {
  const q = new URLSearchParams({ only, theme, tier, tint: '0.34' });
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.waitForTimeout(250);
}

const SHOT = { maxDiffPixelRatio: 0.01 } as const;

for (const theme of ['light', 'dark']) {
  for (const only of ['collapsible', 'accordion', 'table']) {
    test(`${only} · ${theme}`, async ({ page }) => {
      await open(page, only, theme);
      await expect(page.getByTestId(`row-${only}`)).toHaveScreenshot(
        `structure-${only}-${theme}.png`,
        SHOT,
      );
    });
  }

  /*
   * ScrollArea 单独拍 `sa-always` 那一份 —— 默认的 `scroll` 档会在停止滚动后
   * 把滚动条收走，拍到的是空轨道。这不是挑好看的，是**可测性**：
   * 会淡出的东西拍不了稳定快照。
   */
  test(`scrollbar · ${theme}`, async ({ page }) => {
    await open(page, 'scroll', theme);
    await expect(page.getByTestId('sa-always')).toHaveScreenshot(
      `structure-scrollbar-${theme}.png`,
      SHOT,
    );
  });

  // 边缘效果：Tier A（有模糊）与 Tier C（丢模糊、雾加浓）两端点
  for (const tier of ['a', 'c']) {
    test(`scroll-edges · ${theme} · tier ${tier}`, async ({ page }) => {
      await open(page, 'scroll', theme, tier);
      await expect(page.getByTestId('sa-edges')).toHaveScreenshot(
        `structure-edges-${theme}-tier${tier}.png`,
        SHOT,
      );
    });
  }
}

test('表格选中行 · 有焦点时是实心蓝', async ({ page }) => {
  await open(page, 'table', 'light');
  await page.getByTestId('tbl-default').getByTestId('tr-1').focus();
  await page.waitForTimeout(200);
  await expect(page.getByTestId('tbl-default')).toHaveScreenshot(
    'structure-table-selected-focus.png',
    SHOT,
  );
});

test('高对比：滚动条与交替行都要能看见', async ({ browser }) => {
  const ctx = await browser.newContext({ contrast: 'more' });
  const page = await ctx.newPage();
  await open(page, 'table', 'light');
  await expect(page.getByTestId('row-table')).toHaveScreenshot(
    'structure-table-contrast-more.png',
    SHOT,
  );
  await ctx.close();
});
