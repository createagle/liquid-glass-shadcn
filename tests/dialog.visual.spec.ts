/**
 * Dialog 视觉回归。
 *
 * ⚠️ **快照是平台相关的，这个 project 默认不在 CI 跑。**
 * 理由与 tabs.visual.spec.ts 相同（Windows 与 Linux CI 的 blur 渲染不一致）。
 *
 * 只截**面板本身**，不截整页 —— 背景渐变里的平滑色带会让整页比对变脆弱。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/dialog-demo.html')).href;
const PANEL = '[data-slot="dialog-content"] .lg-surface[data-layer="elevated"]';
const SHOT = { maxDiffPixelRatio: 0.01 } as const;

async function open(page: Page, theme: string, tier: string, tint: number) {
  await page.goto(`${HARNESS}?theme=${theme}&tier=${tier}&tint=${tint}&open=1`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.waitForTimeout(700); // 等入场 spring 完全静止
}

for (const theme of ['light', 'dark']) {
  for (const tint of [0, 0.34, 0.67, 1]) {
    test(`${theme} · tier a · 档位 ${tint}`, async ({ page }) => {
      await open(page, theme, 'a', tint);
      await expect(page.locator(PANEL)).toHaveScreenshot(
        `dialog-${theme}-tiera-tint${tint}.png`,
        SHOT,
      );
    });
  }
  for (const tier of ['b', 'c']) {
    test(`${theme} · tier ${tier}`, async ({ page }) => {
      await open(page, theme, tier, 0.34);
      await expect(page.locator(PANEL)).toHaveScreenshot(`dialog-${theme}-tier${tier}.png`, SHOT);
    });
  }
}
