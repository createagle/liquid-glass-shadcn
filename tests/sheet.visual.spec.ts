/**
 * Sheet 视觉回归。
 *
 * ⚠️ **快照是平台相关的，这个 project 默认不在 CI 跑。**理由见 playwright.config.ts。
 *
 * 视口固定成 402×874 —— 就是参考图那块屏。这样快照里的 pt 数与
 * apple-metrics §7.5 的实测值一一对得上，出了偏差一眼能看出来。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/sheet-demo.html')).href;

test.use({ viewport: { width: 402, height: 874 } });

async function open(page: Page, opts: { theme: string; tier?: string; tint?: number; detent?: number }) {
  const q = new URLSearchParams({
    theme: opts.theme,
    tier: opts.tier ?? 'a',
    tint: String(opts.tint ?? 0.34),
    open: '1',
    detent: String(opts.detent ?? 0),
  });
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  // 等入场 spring 停下来
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-slot="sheet-panel"]') as HTMLElement | null;
      if (!el) return false;
      const w = window as unknown as { __y?: number; __n?: number };
      const y = new DOMMatrixReadOnly(getComputedStyle(el).transform).m42;
      if (w.__y !== undefined && Math.abs(w.__y - y) < 0.05) w.__n = (w.__n ?? 0) + 1;
      else w.__n = 0;
      w.__y = y;
      return (w.__n ?? 0) >= 3;
    },
    undefined,
    { timeout: 5000 },
  );
  await page.waitForTimeout(150);
}

const SHOT = { maxDiffPixelRatio: 0.01 } as const;
/** 整屏比 —— 层叠后退是背后那一层的事，只截面板就看不见了 */
const full = () => ({ fullPage: false, ...SHOT }) as const;

for (const theme of ['light', 'dark']) {
  for (const detent of [0, 1]) {
    test(`${theme} · 档位 ${detent}`, async ({ page }) => {
      await open(page, { theme, detent });
      await expect(page).toHaveScreenshot(`sheet-${theme}-detent${detent}.png`, full());
    });
  }

  for (const tier of ['b', 'c']) {
    test(`${theme} · tier ${tier}`, async ({ page }) => {
      await open(page, { theme, tier });
      await expect(page).toHaveScreenshot(`sheet-${theme}-tier${tier}.png`, full());
    });
  }

  for (const tint of [0, 1]) {
    test(`${theme} · 材质档位 ${tint}`, async ({ page }) => {
      await open(page, { theme, tint });
      await expect(page).toHaveScreenshot(`sheet-${theme}-tint${tint}.png`, full());
    });
  }
}

test('抓手特写 —— Layer I 在 4pt 高度上的实际样子', async ({ page }) => {
  await open(page, { theme: 'light' });
  const g = (await page.locator('[data-slot="sheet-grabber"]').boundingBox())!;
  await expect(page).toHaveScreenshot('sheet-grabber-zoom.png', {
    ...SHOT,
    clip: { x: g.x - 30, y: g.y - 12, width: g.width + 60, height: g.height + 24 },
  });
});
