/**
 * `prefers-contrast: more` 降级（PROJECT_SPEC §13 / §14）。
 *
 * 这一项此前只有 token 分支、没有测试 —— Tabs 的 §14 自查里把它记成未过。
 * 现在一次性覆盖全部已交付的组件。
 *
 * 判据分两层，缺一不可：
 *   1. **变量层** —— Provider 是否真的把偏好写到了 data-glass-contrast，
 *      对应的 token 是否切到了高对比分支。
 *   2. **绘制层** —— 描边是否真的变了。只查变量会漏掉「变量改了但
 *      引用它的声明写在 :root 上、后代拿到的是算好的旧值」这类坑
 *      （semantic.css 里为此专门重写过一整套，注释在那里）。
 */

import { test, expect, type Page, type Browser } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESSES = {
  tabs: pathToFileURL(resolve('apps/www/dev/tabs-demo.html')).href,
  controls: pathToFileURL(resolve('apps/www/dev/controls-demo.html')).href,
};

async function open(page: Page, harness: keyof typeof HARNESSES, theme = 'light') {
  await page.goto(`${HARNESSES[harness]}?theme=${theme}&tier=a&tint=0.34`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

const cssVar = (page: Page, name: string) =>
  page.evaluate(
    (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name,
  );

const baseShadow = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector('.lg-surface[data-layer="base"]') as HTMLElement;
    return getComputedStyle(el).boxShadow;
  });

async function withContrast(
  browser: Browser,
  contrast: 'more' | 'no-preference',
  fn: (page: Page) => Promise<void>,
) {
  const ctx = await browser.newContext({ contrast });
  const page = await ctx.newPage();
  try {
    await fn(page);
  } finally {
    await ctx.close();
  }
}

test.describe('prefers-contrast: more', () => {
  test('Provider 把偏好写到 data-glass-contrast', async ({ browser }) => {
    await withContrast(browser, 'more', async (page) => {
      await open(page, 'controls');
      await expect(page.locator('html')).toHaveAttribute('data-glass-contrast', 'more');
    });
    await withContrast(browser, 'no-preference', async (page) => {
      await open(page, 'controls');
      await expect(page.locator('html')).toHaveAttribute('data-glass-contrast', 'normal');
    });
  });

  test('描边加强、折射与色散收敛', async ({ browser }) => {
    await withContrast(browser, 'more', async (page) => {
      await open(page, 'controls');
      // 档位强度（JS 拥有）与无障碍加成（CSS 拥有）是两个变量 ——
      // 合成一个的话会被 Provider 的内联样式盖掉，见 semantic.css 的注释。
      expect(await cssVar(page, '--lg-stroke-boost')).toBe('1.8');
      // 高对比下折射本身会降低可读性，必须收敛
      expect(Number(await cssVar(page, '--lg-refract-scale'))).toBeLessThan(0.85);
      expect(Number(await cssVar(page, '--lg-disperse-scale'))).toBeLessThan(0.9);
    });
  });

  test('描边真的画出来了 —— 不只是变量变了', async ({ browser }) => {
    let normal = '';
    let more = '';
    await withContrast(browser, 'no-preference', async (page) => {
      await open(page, 'controls');
      normal = await baseShadow(page);
    });
    await withContrast(browser, 'more', async (page) => {
      await open(page, 'controls');
      more = await baseShadow(page);
    });
    expect(normal).not.toBe('');
    expect(more).not.toBe(normal);
  });

  test('三个组件在高对比下结构完好', async ({ browser }) => {
    await withContrast(browser, 'more', async (page) => {
      await open(page, 'tabs');
      // 指示器与底座都还在，几何未被高对比分支破坏
      const b = (await page.locator('.lg-surface[data-layer="base"]').boundingBox())!;
      const i = (await page.locator('.lg-surface[data-layer="indicator"]').boundingBox())!;
      expect(Math.round(b.height)).toBe(62);
      expect(Math.round(i.height)).toBe(54);

      await open(page, 'controls');
      const track = (await page.locator('[data-slot="slider-track"]').boundingBox())!;
      expect(Math.round(track.height)).toBe(6);
      const sw = (await page.locator('[data-slot="switch"]').first().boundingBox())!;
      expect(Math.round(sw.width)).toBe(64);
      expect(Math.round(sw.height)).toBe(28);
    });
  });

  test('dark + 高对比是独立的一套，不是亮色套壳', async ({ browser }) => {
    let lightSecondary = '';
    let darkSecondary = '';
    await withContrast(browser, 'more', async (page) => {
      await open(page, 'controls', 'light');
      lightSecondary = await cssVar(page, '--lg-label-secondary');
      await open(page, 'controls', 'dark');
      darkSecondary = await cssVar(page, '--lg-label-secondary');
    });
    expect(lightSecondary).not.toBe('');
    expect(darkSecondary).not.toBe(lightSecondary);
  });
});
