/**
 * Phase 7 第三批（Tooltip / Toast / InputGroup）视觉回归。
 *
 * ⚠️ **快照是平台相关的，这个 project 默认不在 CI 跑。**理由见 playwright.config.ts。
 *
 * 三个都是玻璃组件，所以三档渲染路径都要跑。
 * 材质档位只跑 0 与 1 两个端点 —— 中间那两档是插值出来的，
 * 端点对了中间不会单独错（Card / 表单批也是这个口径）。
 *
 * ⚠️ Toast 那一档的验证台把 viewport 改成了 `position: static` ——
 * fixed 的元素不在 `[data-testid^="row-"]` 的盒子里，截图会拍到一片空白。
 * 位置行为由行为测试覆盖，不靠快照。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/overlay2-demo.html')).href;

async function open(page: Page, only: string, theme: string, tier = 'a', tint = '0.34') {
  const q = new URLSearchParams({ only, theme, tier, tint });
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.waitForTimeout(250);
}

const row = (page: Page) => page.locator('[data-testid^="row-"]');
const SHOT = { maxDiffPixelRatio: 0.01 } as const;

for (const theme of ['light', 'dark']) {
  for (const only of ['tooltip', 'toast', 'input-group']) {
    test(`${only} · ${theme}`, async ({ page }) => {
      await open(page, only, theme);
      await expect(row(page)).toHaveScreenshot(`overlay2-${only}-${theme}.png`, SHOT);
    });

    for (const tier of ['b', 'c']) {
      test(`${only} · ${theme} · tier ${tier}`, async ({ page }) => {
        await open(page, only, theme, tier);
        await expect(row(page)).toHaveScreenshot(`overlay2-${only}-${theme}-tier${tier}.png`, SHOT);
      });
    }
  }

  for (const tint of ['0', '1']) {
    test(`input-group · ${theme} · 材质档位 ${tint}`, async ({ page }) => {
      await open(page, 'input-group', theme, 'a', tint);
      await expect(row(page)).toHaveScreenshot(`overlay2-input-group-${theme}-tint${tint}.png`, SHOT);
    });
  }
}
