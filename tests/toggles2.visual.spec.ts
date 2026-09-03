/**
 * Phase 7 收尾（Checkbox / Radio Group）视觉回归。
 *
 * ⚠️ **快照是平台相关的，这个 project 默认不在 CI 跑。**理由见 playwright.config.ts。
 *
 * ⚠️ 与前几批不同，这里**不跑 Tier A/B/C，也不跑材质档位** ——
 * 这两个组件里没有玻璃（apple-metrics.md §10.3），
 * 那两个维度对它们来说不存在，跑了只是把同一张图存三遍。
 *
 * 换成跑的是**背景**：条纹是高频背景，一旦哪天有人给控件加了折射，
 * 条纹会立刻把它抖出来 —— 这比多存两档档位有用得多
 * （依据见 component-inventory.md「修订二」：真正让折射现形的是背景频率，不是尺寸）。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/toggles2-demo.html')).href;

async function open(page: Page, only: string, theme: string, bg: string) {
  const q = new URLSearchParams({ only, theme, tier: 'a', tint: '0.34', bg });
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.waitForTimeout(200);
}

const SHOT = { maxDiffPixelRatio: 0.01 } as const;

for (const theme of ['light', 'dark']) {
  for (const only of ['checkbox', 'radio', 'in-card']) {
    test(`${only} · ${theme}`, async ({ page }) => {
      await open(page, only, theme, 'grouped');
      await expect(page.getByTestId(`row-${only}`)).toHaveScreenshot(
        `toggles2-${only}-${theme}.png`,
        SHOT,
      );
    });
  }

  // 条纹背景：给「不该有折射」这件事留一张会说话的底片
  test(`checkbox · ${theme} · 条纹背景`, async ({ page }) => {
    await open(page, 'checkbox', theme, 'stripes');
    await expect(page.getByTestId('row-checkbox')).toHaveScreenshot(
      `toggles2-checkbox-${theme}-stripes.png`,
      SHOT,
    );
  });
}

test('focus 环', async ({ page }) => {
  await open(page, 'checkbox', 'light', 'grouped');
  await page.getByTestId('cb-unchecked').focus();
  await page.waitForTimeout(200);
  await expect(page.getByTestId('row-checkbox')).toHaveScreenshot('toggles2-focus-ring.png', SHOT);
});

test('高对比：未选中底色必须能与背景分开', async ({ browser }) => {
  const ctx = await browser.newContext({ contrast: 'more' });
  const page = await ctx.newPage();
  await open(page, 'checkbox', 'light', 'grouped');
  await expect(page.getByTestId('row-checkbox')).toHaveScreenshot(
    'toggles2-checkbox-contrast-more.png',
    SHOT,
  );
  await ctx.close();
});
