/**
 * Select 视觉回归。
 *
 * ⚠️ **快照是平台相关的，这个 project 默认不在 CI 跑。**理由见 playwright.config.ts。
 *
 * 这里有一张比别的都重要：`select-hole-align-stripes` —— 高亮项压在 6px 黑白
 * 条纹上的特写。这一批查出来挖洞**偏了一个内边距**（DropdownMenu 一直是错的），
 * 那张图就是「洞现在真的盖在项上」的证据：
 * 项的四条边之内条纹清晰，项之外立刻回到被面板模糊过的样子。
 *
 * ⚠️ 快照比对的容差是 maxDiffPixelRatio 0.01。**它抓不到 1px 的描边** ——
 * 250×220 的面板上，上下各一条 1px 内描边只占 0.9%，正好在容差之内。
 * 这一批修掉的 `--lg-glow: none` 就是这么漏过去的（亮色下所有 elevated 面板
 * 既没描边也没落影，13 张快照一张都没红）。要抓这类问题得靠像素统计，
 * 不能只靠快照。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/select-demo.html')).href;

async function open(page: Page, q: Record<string, string>) {
  const params = new URLSearchParams({
    tint: '0.34',
    tier: 'a',
    open: '1',
    value: 'size',
    ...q,
  });
  await page.goto(`${HARNESS}?${params}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.waitForTimeout(500);
}

const SHOT = { maxDiffPixelRatio: 0.01 } as const;
const panel = (page: Page) =>
  page.locator('[data-slot="select-content"] .lg-surface[data-layer="elevated"]');

test.describe('桌面路径', () => {
  // 必须 > 768，否则 useIsCompact() 判成紧凑视口，渲染的是 Drawer
  test.use({ viewport: { width: 1000, height: 800 } });

  for (const theme of ['light', 'dark']) {
    for (const tier of ['a', 'b', 'c']) {
      test(`${theme} · tier ${tier}`, async ({ page }) => {
        await open(page, { theme, tier });
        await expect(panel(page)).toHaveScreenshot(`select-${theme}-tier${tier}.png`, SHOT);
      });
    }

    test(`${theme} · 触发器（静止）`, async ({ page }) => {
      await open(page, { theme, open: '0' });
      await expect(page.locator('[data-slot="select-trigger"]')).toHaveScreenshot(
        `select-trigger-${theme}.png`,
        SHOT,
      );
    });

    test(`${theme} · 未选中（占位文字 + 空的图标列）`, async ({ page }) => {
      await open(page, { theme, value: '' });
      await expect(panel(page)).toHaveScreenshot(`select-${theme}-empty.png`, SHOT);
    });
  }

  test('分组 + 分隔线 + 禁用项', async ({ page }) => {
    await open(page, { theme: 'light', only: 'groups' });
    await expect(panel(page)).toHaveScreenshot('select-groups.png', SHOT);
  });

  /**
   * 挖洞对齐的证据图。条纹背景才判得出来 —— 平滑渐变上折射本来就看不出来
   * （全库的光学诊断一直用 6px 黑白条纹当高频最坏情况）。
   *
   * 洞如果像修复前那样偏了 (16, 10)，这张图上会看到：
   * 项的左边界外有一条清晰带、右边界内有一条模糊带。
   */
  for (const bg of ['gradient', 'stripes'] as const) {
    test(`高亮项特写（${bg}）—— 洞与项是否严丝合缝`, async ({ page }) => {
      await open(page, {
        theme: 'light',
        ...(bg === 'stripes' ? { bg: 'stripes' } : {}),
      });
      const item = page.locator('[data-slot="select-item"]').nth(2);
      const b = (await item.boundingBox())!;
      await expect(page).toHaveScreenshot(`select-hole-align-${bg}.png`, {
        ...SHOT,
        clip: { x: b.x - 12, y: b.y - 12, width: b.width + 24, height: b.height + 24 },
      });
    });
  }

  /** 对勾特写 —— 实测的 28×20 图标列 + 8pt 间距长什么样 */
  test('对勾特写', async ({ page }) => {
    await open(page, { theme: 'light' });
    const item = page.locator('[data-slot="select-item"]').nth(2);
    const b = (await item.boundingBox())!;
    await expect(page).toHaveScreenshot('select-checkmark-zoom.png', {
      ...SHOT,
      clip: { x: b.x - 2, y: b.y - 2, width: 120, height: b.height + 4 },
    });
  });
});

test.describe('移动路径 —— 底部 Drawer', () => {
  // 402×874 = 参考图那块屏
  test.use({ viewport: { width: 402, height: 874 } });

  for (const theme of ['light', 'dark']) {
    test(`${theme}`, async ({ page }) => {
      await open(page, { theme });
      await expect(page).toHaveScreenshot(`select-drawer-${theme}.png`, SHOT);
    });
  }
});
