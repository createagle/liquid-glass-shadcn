/**
 * 表单一批（Input / Textarea / Label / Field）视觉回归。
 *
 * ⚠️ **快照是平台相关的，这个 project 默认不在 CI 跑。**理由见 playwright.config.ts。
 *
 * 覆盖策略 —— 与 Card 一样，按「这一档到底吃不吃那组变量」来决定跑什么：
 *
 *   reference（list 变体）  **不跑 tier / 档位**。它是内容层，一块玻璃都没有，
 *                           跑三档等于把同一张图存三遍。只跑明暗。
 *                           压在 systemGroupedBackground 上 —— 那是 iOS 表单真正的场景。
 *   field 变体              **跑 tier A/B/C**，它是 Layer B，三条渲染路径真的不同。
 *                           另跑档位 0 与 1 两个端点：档位调的就是底座的通透度，
 *                           而输入框在最通透那一档最容易「消失」在复杂背景里。
 *   textarea / wiring       只跑明暗。多行框与接线那几行没有额外的材质分支。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/form-demo.html')).href;

async function open(
  page: Page,
  only: string,
  theme: string,
  tier = 'a',
  tint = '0.34',
  bg?: string,
) {
  const q = new URLSearchParams({ only, theme, tier, tint });
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
  test(`list 变体 · ${theme} · 压在 systemGroupedBackground 上`, async ({ page }) => {
    // 与 screenshots/ios27-list-screen.png 同构：370 宽、四行、四种状态
    await open(page, 'reference', theme, 'a', '0.34', 'grouped');
    await expect(row(page)).toHaveScreenshot(`form-list-${theme}.png`, SHOT);
  });

  test(`textarea · ${theme}`, async ({ page }) => {
    await open(page, 'textarea', theme);
    await expect(row(page).first()).toHaveScreenshot(`form-textarea-${theme}.png`, SHOT);
  });

  test(`Field 接线 · ${theme}`, async ({ page }) => {
    await open(page, 'wiring', theme);
    await expect(row(page)).toHaveScreenshot(`form-wiring-${theme}.png`, SHOT);
  });

  for (const tier of ['a', 'b', 'c']) {
    test(`field 变体 · ${theme} · tier ${tier}`, async ({ page }) => {
      await open(page, 'field', theme, tier);
      await expect(row(page)).toHaveScreenshot(`form-field-${theme}-tier${tier}.png`, SHOT);
    });
  }

  for (const tint of ['0', '1']) {
    test(`field 变体 · ${theme} · 材质档位 ${tint}`, async ({ page }) => {
      await open(page, 'field', theme, 'a', tint);
      await expect(row(page)).toHaveScreenshot(`form-field-${theme}-tint${tint}.png`, SHOT);
    });
  }
}
