/**
 * Button 视觉回归。
 *
 * ⚠️ **快照是平台相关的，这个 project 默认不在 CI 跑。**
 * 理由与 tabs.visual.spec.ts 相同（Windows 与 Linux CI 的 blur 渲染不一致）。
 *
 * 覆盖策略：材质档位只影响 `glass` 变体的底座，所以只有它跑满四档 + 三条
 * 渲染路径；实心与 plain 变体各来一张明暗对照就够了 —— 它们的差异在填充色，
 * 与材质阶梯无关。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/button-demo.html')).href;

async function open(page: Page, only: string, theme: string, tier: string, tint: number) {
  await page.goto(`${HARNESS}?only=${only}&theme=${theme}&tier=${tier}&tint=${tint}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.waitForTimeout(200);
}

const row = (page: Page) => page.locator('[data-testid^="row-"]');
const SHOT = { maxDiffPixelRatio: 0.01 } as const;

for (const theme of ['light', 'dark']) {
  for (const tint of [0, 0.34, 0.67, 1]) {
    test(`glass · ${theme} · tier a · 档位 ${tint}`, async ({ page }) => {
      await open(page, 'glass', theme, 'a', tint);
      await expect(row(page)).toHaveScreenshot(`button-glass-${theme}-tiera-tint${tint}.png`, SHOT);
    });
  }
  for (const tier of ['b', 'c']) {
    test(`glass · ${theme} · tier ${tier}`, async ({ page }) => {
      await open(page, 'glass', theme, tier, 0.34);
      await expect(row(page)).toHaveScreenshot(`button-glass-${theme}-tier${tier}.png`, SHOT);
    });
  }
  for (const variant of ['prominent', 'destructive', 'plain']) {
    test(`${variant} · ${theme}`, async ({ page }) => {
      await open(page, variant, theme, 'a', 0.34);
      await expect(row(page)).toHaveScreenshot(`button-${variant}-${theme}.png`, SHOT);
    });
  }
}

test('glass 按下时升级为 Layer I', async ({ page }) => {
  await open(page, 'glass', 'light', 'a', 0.34);
  const b = (await page.locator('[data-slot="button"]').nth(1).boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700); // 等 spring 静止
  await expect(page.locator('[data-slot="button"]').nth(1)).toHaveScreenshot(
    'button-glass-pressed.png',
    SHOT,
  );
  await page.mouse.up();
});
