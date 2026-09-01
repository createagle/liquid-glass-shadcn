/**
 * Card 视觉回归。
 *
 * ⚠️ **快照是平台相关的，这个 project 默认不在 CI 跑。**理由见 playwright.config.ts。
 *
 * 覆盖策略与控件类组件不同：
 *   - **不跑材质档位 0/1/2/3。** 档位滑杆调的是玻璃材质，Card 是内容层，
 *     压根不吃那组变量 —— 跑四档等于把同一张图存四遍。
 *   - **只有 `material` 变体跑 Tier A/B/C**，因为只有它有 backdrop-filter，
 *     三条路径才有区别；`grouped` / `plain` 是纯色，三档必然一样。
 *   - `reference` 那张压在 systemGroupedBackground 上 —— 那是分组列表真正的场景，
 *     也是 Fidelity 对照图用的那一档。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/card-demo.html')).href;

async function open(page: Page, only: string, theme: string, tier = 'a', bg?: string) {
  const q = new URLSearchParams({ only, theme, tier, tint: '0.34' });
  if (bg) q.set('bg', bg);
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
  test(`分组列表 · ${theme} · 压在 systemGroupedBackground 上`, async ({ page }) => {
    await open(page, 'reference', theme, 'a', 'grouped');
    await expect(row(page)).toHaveScreenshot(`card-reference-${theme}.png`, SHOT);
  });

  test(`可点的行 · ${theme}`, async ({ page }) => {
    await open(page, 'interactive', theme, 'a', 'grouped');
    await expect(row(page)).toHaveScreenshot(`card-interactive-${theme}.png`, SHOT);
  });

  test(`正文卡片 · grouped · ${theme}`, async ({ page }) => {
    await open(page, 'grouped', theme);
    await expect(row(page)).toHaveScreenshot(`card-grouped-${theme}.png`, SHOT);
  });

  test(`正文卡片 · plain · ${theme}`, async ({ page }) => {
    await open(page, 'plain', theme);
    await expect(row(page)).toHaveScreenshot(`card-plain-${theme}.png`, SHOT);
  });

  for (const tier of ['a', 'b', 'c']) {
    test(`正文卡片 · material · ${theme} · tier ${tier}`, async ({ page }) => {
      await open(page, 'material', theme, tier);
      await expect(row(page)).toHaveScreenshot(`card-material-${theme}-tier${tier}.png`, SHOT);
    });
  }
}

test('行按下时的高亮', async ({ page }) => {
  await open(page, 'interactive', 'light', 'a', 'grouped');
  const b = (await page.locator('[data-slot="card-row"]').first().boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700); // 等过渡静止
  await expect(row(page)).toHaveScreenshot('card-row-pressed.png', SHOT);
  await page.mouse.up();
});
