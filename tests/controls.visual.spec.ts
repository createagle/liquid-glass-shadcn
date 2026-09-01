/**
 * Slider / Switch 视觉回归。
 *
 * ⚠️ **快照是平台相关的，这个 project 默认不在 CI 跑。**
 * 理由与 tabs.visual.spec.ts 相同（Windows 与 Linux CI 的 blur 渲染不一致），
 * 详见那份文件顶部的说明与 STATUS.md §0.5。
 *
 * 跑法：
 *   npx playwright test --project=visual                    比对
 *   npx playwright test --project=visual --update-snapshots 重录基线
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/controls-demo.html')).href;

async function open(page: Page, only: string, theme: string, tier: string, tint: number) {
  await page.goto(`${HARNESS}?only=${only}&theme=${theme}&tier=${tier}&tint=${tint}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  // 等 spring 静止：开关的初始位置是按 props 直接给的，但缩放/着色仍会跑一帧
  await page.waitForTimeout(200);
}

/** 只截组件本身，不截背景 —— 背景渐变里的平滑色带会让整页比对变脆弱 */
const target = (page: Page, only: string) =>
  only === 'slider' ? page.locator('[data-slot="slider"]') : page.locator('#root > div');

const SHOT = { maxDiffPixelRatio: 0.01 } as const;

for (const only of ['slider', 'switch']) {
  /**
   * 材质档位全覆盖（PROJECT_SPEC §14「档位 0/1/2/3 下都正常且可读」）。
   * 只在 Tier A 上跑满四档 —— 档位影响的是底座材质，三条渲染路径共用同一组值。
   */
  for (const theme of ['light', 'dark']) {
    for (const tint of [0, 0.34, 0.67, 1]) {
      test(`${only} · ${theme} · tier a · 档位 ${tint}`, async ({ page }) => {
        await open(page, only, theme, 'a', tint);
        await expect(target(page, only)).toHaveScreenshot(
          `${only}-${theme}-tiera-tint${tint}.png`,
          SHOT,
        );
      });
    }

    // 降级路径在默认档位上各来一张：B、C 各自都必须是完整设计
    for (const tier of ['b', 'c']) {
      test(`${only} · ${theme} · tier ${tier}`, async ({ page }) => {
        await open(page, only, theme, tier, 0.34);
        await expect(target(page, only)).toHaveScreenshot(
          `${only}-${theme}-tier${tier}.png`,
          SHOT,
        );
      });
    }
  }
}

test('switch 切换到开启态后到位', async ({ page }) => {
  await open(page, 'switch', 'light', 'a', 0.34);
  await page.getByRole('switch').first().click();
  await page.waitForTimeout(800); // 等 spring 静止
  await expect(page.locator('#root > div')).toHaveScreenshot('switch-toggled-on.png', SHOT);
});

test('slider 拖到末端', async ({ page }) => {
  await open(page, 'slider', 'light', 'a', 0.34);
  const track = (await page.locator('[data-slot="slider-track"]').boundingBox())!;
  await page.mouse.move(track.x + track.width, track.y + track.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(600);
  await expect(page.locator('[data-slot="slider"]')).toHaveScreenshot('slider-max.png', SHOT);
});
