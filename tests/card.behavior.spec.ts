/**
 * Card 的行为与几何回归。
 *
 * 几何基准来自 iOS 27 官方设计资源里的两块 Grouped List
 * （节点 12740:33850 与 12740:33923，见 apple-metrics §8）：
 *   区块 370 宽、圆角 26（亚像素拟合）、行高 52、
 *   行内左右内缩 16、分隔线 1pt 且两侧各内缩 16
 *
 * ⚠️ 本组件最重要的断言不是几何，而是**「里面一个 .lg-surface 都不许有」** ——
 *    PROJECT_SPEC §2 规定 Card 既不用 Layer B 也不用 Layer I，§15 第 9 条
 *    明令禁止在内容型组件上堆玻璃。那条测试是这份规格的机器可执行版本。
 */

import { test, expect, type Page, type Browser } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/card-demo.html')).href;

async function open(
  page: Page,
  opts: { theme?: string; tier?: string; tint?: number; only?: string; bg?: string } = {},
) {
  const q = new URLSearchParams({
    theme: opts.theme ?? 'light',
    tier: opts.tier ?? 'a',
    tint: String(opts.tint ?? 0.34),
  });
  if (opts.only) q.set('only', opts.only);
  if (opts.bg) q.set('bg', opts.bg);
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

const styleOf = (p: Page, sel: string, prop: string) =>
  p.evaluate(
    ([s, k]) => getComputedStyle(document.querySelector(s as string)!).getPropertyValue(k as string),
    [sel, prop] as const,
  );

const styleOfNth = (p: Page, sel: string, nth: number, prop: string) =>
  p.evaluate(
    ([s, n, k]) =>
      getComputedStyle(document.querySelectorAll(s as string)[n as number]!).getPropertyValue(
        k as string,
      ),
    [sel, nth, prop] as const,
  );

test.describe('几何 —— 对齐 iOS 27 实测值', () => {
  test('区块 370 宽、圆角 26、底色完全不透明', async ({ page }) => {
    await open(page, { only: 'reference', bg: 'grouped' });
    const b = (await page.locator('[data-slot="card"]').boundingBox())!;
    expect(Math.round(b.width)).toBe(370);
    expect(await styleOf(page, '[data-slot="card"]', 'border-radius')).toBe('26px');
    // 实测 alpha 通道是 255 —— 分组区块**不是**半透明材质
    expect(await styleOf(page, '[data-slot="card"]', 'background-color')).toBe('rgb(255, 255, 255)');
  });

  test('行高 52、行内左右内缩 16、标签 17/22', async ({ page }) => {
    await open(page, { only: 'reference' });
    const rows = page.locator('[data-slot="card-row"]');
    await expect(rows).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      const b = (await rows.nth(i).boundingBox())!;
      expect(Math.round(b.height), `第 ${i} 行高`).toBe(52);
      expect(await styleOfNth(page, '[data-slot="card-row"]', i, 'padding-left')).toBe('16px');
      expect(await styleOfNth(page, '[data-slot="card-row"]', i, 'padding-right')).toBe('16px');
    }
    expect(await styleOf(page, '[data-slot="card-row"]', 'font-size')).toBe('17px');
    expect(await styleOf(page, '[data-slot="card-row"]', 'line-height')).toBe('22px');
  });

  test('分隔线：首行没有，其余 1pt 且两侧各内缩 16', async ({ page }) => {
    await open(page, { only: 'reference' });
    // 首行那条要是画出来，就正好压在区块的上边缘上
    expect(await styleOfNth(page, '[data-slot="card-row-separator"]', 0, 'display')).toBe('none');
    expect(await styleOfNth(page, '[data-slot="card-row-separator"]', 1, 'display')).toBe('block');

    const geo = await page.evaluate(() => {
      const card = document.querySelector('[data-slot="card"]')!.getBoundingClientRect();
      const sep = document
        .querySelectorAll('[data-slot="card-row-separator"]')[1]!
        .getBoundingClientRect();
      return {
        left: Math.round(sep.left - card.left),
        right: Math.round(card.right - sep.right),
        height: Math.round(sep.height),
        top: Math.round(sep.top - card.top),
      };
    });
    expect(geo).toEqual({ left: 16, right: 16, height: 1, top: 52 });
    // 实测 #e6e6e6 压在白底上 = 黑 9.8%
    expect(await styleOfNth(page, '[data-slot="card-row-separator"]', 1, 'background-color')).toBe(
      'rgba(0, 0, 0, 0.1)',
    );
  });

  test('装了 CardRow 的区块没有竖直内边距，装正文槽位的有', async ({ page }) => {
    await open(page, { only: 'reference' });
    // 分组列表里行必须贴着区块上下边缘 —— 靠 :has(> [data-slot=card-row]) 去掉
    expect(await styleOf(page, '[data-slot="card"]', 'padding-top')).toBe('0px');
    expect(await styleOf(page, '[data-slot="card"]', 'row-gap')).toBe('0px');

    await open(page, { only: 'grouped' });
    expect(await styleOf(page, '[data-slot="card"]', 'padding-top')).toBe('16px');
    expect(await styleOf(page, '[data-slot="card"]', 'row-gap')).toBe('16px');
    expect(await styleOf(page, '[data-slot="card-header"]', 'padding-left')).toBe('16px');
    expect(await styleOf(page, '[data-slot="card-content"]', 'padding-left')).toBe('16px');
  });

  test('圆角要裁剪 —— 否则整行铺满的按下高亮会从圆角处露出直角', async ({ page }) => {
    await open(page, { only: 'interactive' });
    expect(await styleOf(page, '[data-slot="card"]', 'overflow')).toBe('hidden');
  });
});

test.describe('分层 —— PROJECT_SPEC §2「Card 两者都不用」', () => {
  test('整个卡片里一个 .lg-surface 都没有', async ({ page }) => {
    await open(page); // 不带 only：五种卡片同时在页面上
    const inside = await page.evaluate(() =>
      [...document.querySelectorAll('[data-slot="card"]')].filter(
        (c) => c.querySelector(':scope > .lg-surface, :scope > * > .lg-surface') !== null,
      ).length,
    );
    expect(inside).toBe(0);
    // 页面上确实有 .lg-surface（Switch 与 Button 的），否则这条断言等于没测
    expect(await page.locator('.lg-surface').count()).toBeGreaterThan(0);
  });

  test('material 变体走内容层材质，不经过 GlassSurface', async ({ page }) => {
    await open(page, { only: 'material' });
    const card = page.locator('[data-slot="card"]');
    await expect(card).toHaveClass(/lg-content/);
    await expect(card).toHaveAttribute('data-material', 'regular');
    // 内容层材质只有模糊，**没有折射**（折射是 url(#…) 的 SVG 滤镜）
    const bd = await styleOf(page, '[data-slot="card"]', 'backdrop-filter');
    expect(bd).toContain('blur');
    expect(bd).not.toContain('url(');
  });

  test('Tier C 下 material 退化为更实的纯色且不再模糊', async ({ page }) => {
    await open(page, { only: 'material', tier: 'c' });
    expect(await styleOf(page, '[data-slot="card"]', 'backdrop-filter')).toBe('none');
    const alpha = await page.evaluate(() => {
      const m = getComputedStyle(document.querySelector('[data-slot="card"]')!)
        .backgroundColor.match(/[\d.]+/g)!;
      return m.length === 4 ? Number(m[3]) : 1;
    });
    expect(alpha).toBeGreaterThan(0.9);
  });

  test('plain 变体不画底 —— 只提供几何', async ({ page }) => {
    await open(page, { only: 'plain' });
    expect(await styleOf(page, '[data-slot="card"]', 'background-color')).toBe('rgba(0, 0, 0, 0)');
    // 几何仍在
    expect(await styleOf(page, '[data-slot="card"]', 'border-radius')).toBe('26px');
  });

  test('dark 是独立的一套，不是亮色反色', async ({ page }) => {
    await open(page, { only: 'reference', theme: 'light' });
    const light = await styleOf(page, '[data-slot="card"]', 'background-color');
    await open(page, { only: 'reference', theme: 'dark' });
    const dark = await styleOf(page, '[data-slot="card"]', 'background-color');
    expect(light).toBe('rgb(255, 255, 255)');
    // iOS 暗色分组区块是 #1c1c1e，**不是**纯黑 —— 纯黑会和页面底色糊在一起
    expect(dark).toBe('rgb(28, 28, 30)');
  });
});

test.describe('可点的行', () => {
  const row = (p: Page, nth = 0) => p.locator('[data-slot="card-row"]').nth(nth);

  test('渲染成真正的 button，不是 role=button 的 div', async ({ page }) => {
    await open(page, { only: 'interactive' });
    const tag = await page.evaluate(
      () => document.querySelector('[data-slot="card-row"]')!.tagName,
    );
    expect(tag).toBe('BUTTON');
    await expect(row(page)).toHaveAttribute('type', 'button');
    await expect(row(page)).toHaveAttribute('data-interactive', 'true');
  });

  test('不可点的行是 div，且没有高亮层', async ({ page }) => {
    await open(page, { only: 'reference' });
    const tag = await page.evaluate(
      () => document.querySelector('[data-slot="card-row"]')!.tagName,
    );
    expect(tag).toBe('DIV');
    await expect(page.locator('[data-slot="card-row-highlight"]')).toHaveCount(0);
  });

  test('按下出现高亮，松手撤销', async ({ page }) => {
    await open(page, { only: 'interactive' });
    const opacity = () =>
      page.evaluate(() =>
        Number(
          getComputedStyle(document.querySelector('[data-slot="card-row-highlight"]')!).opacity,
        ),
      );
    const b = (await row(page).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-slot="card-row-highlight"]') as HTMLElement;
      return Number(getComputedStyle(el).opacity) > 0.9;
    });
    await page.mouse.up();
    await expect(row(page)).not.toHaveAttribute('data-pressed', 'true');
    expect(await opacity()).toBeLessThan(1);
  });

  test('指针移出后按下态不会卡住', async ({ page }) => {
    await open(page, { only: 'interactive' });
    const b = (await row(page).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + 600, b.y + 400);
    await page.mouse.up();
    await expect(page.locator('[data-slot="card-row"][data-pressed="true"]')).toHaveCount(0);
  });

  test('键盘可达且能触发；disabled 行不可点', async ({ page }) => {
    await open(page, { only: 'interactive' });
    await page.evaluate(() => {
      (window as unknown as { __hits: number }).__hits = 0;
      document
        .querySelectorAll('[data-slot="card-row"]')
        .forEach((el) =>
          el.addEventListener('click', () => {
            (window as unknown as { __hits: number }).__hits++;
          }),
        );
    });
    await row(page).focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __hits: number }).__hits))
      .toBe(1);

    await expect(row(page, 2)).toBeDisabled();
    await row(page, 2).click({ force: true });
    expect(await page.evaluate(() => (window as unknown as { __hits: number }).__hits)).toBe(1);
  });

  test('装饰层不进无障碍树', async ({ page }) => {
    await open(page, { only: 'interactive' });
    await expect(page.locator('[data-slot="card-row-separator"]').first()).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await expect(page.locator('[data-slot="card-row-highlight"]').first()).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});

test.describe('无障碍偏好降级（PROJECT_SPEC §13）', () => {
  /**
   * Playwright 没有 prefers-reduced-transparency 的开关，但 CDP 有 ——
   * `Emulation.setEmulatedMedia` 能塞任意 media feature。
   *
   * 这比之前的做法（改 tier=c 去走「同一条路径」）强：它模拟的是**真的偏好**，
   * 于是 Provider 自己读 matchMedia 的那条链路也一起被测到了。
   */
  async function withReducedTransparency(browser: Browser, fn: (page: Page) => Promise<void>) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
    });
    try {
      await fn(page);
    } finally {
      await ctx.close();
    }
  }

  test('reduced-transparency 下 material 变成真的不透明', async ({ browser }) => {
    await withReducedTransparency(browser, async (page) => {
      await open(page, { only: 'material' });
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches))
        .toBe(true);
      // 只摘掉模糊是不够的 —— 那会得到「既不糊又能看见背景」的最糟组合
      expect(await styleOf(page, '[data-slot="card"]', 'backdrop-filter')).toBe('none');
      expect(await styleOf(page, '[data-slot="card"]', 'background-color')).toBe(
        'rgb(255, 255, 255)',
      );
    });
  });

  test('contrast: more 下分隔线加强', async ({ browser }) => {
    const read = async (contrast: 'more' | 'no-preference') => {
      const ctx = await browser.newContext({ contrast });
      const page = await ctx.newPage();
      await open(page, { only: 'reference' });
      const v = await styleOfNth(page, '[data-slot="card-row-separator"]', 1, 'background-color');
      await ctx.close();
      return v;
    };
    const normal = await read('no-preference');
    const more = await read('more');
    expect(normal).toBe('rgba(0, 0, 0, 0.1)');
    // 黑 10% 在高对比下几乎看不见
    expect(more).toBe('rgba(0, 0, 0, 0.3)');
  });

  test('reduced-motion 下高亮过渡明显更短', async ({ browser }) => {
    /**
     * 判据是**两次实测相比**，不是某个绝对阈值。
     *
     * PROJECT_SPEC §13 只要求「≤120ms 的透明度过渡」，没规定曲线；
     * 写死某个时刻该到多少，等于把 springs 预设的内部参数抄进测试里，
     * 以后调预设就会误报。所以这里同一时刻各测一次，比大小。
     */
    const at = async (reducedMotion: 'reduce' | 'no-preference', ms: number) => {
      const ctx = await browser.newContext({ reducedMotion });
      const page = await ctx.newPage();
      await open(page, { only: 'interactive' });
      const b = (await page.locator('[data-slot="card-row"]').first().boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(ms);
      const o = await page.evaluate(() =>
        Number(
          getComputedStyle(document.querySelector('[data-slot="card-row-highlight"]')!).opacity,
        ),
      );
      await page.mouse.up();
      await ctx.close();
      return o;
    };
    expect(await at('reduce', 60)).toBeGreaterThan(await at('no-preference', 60));
    // 120ms 的上限来自 §13，这一条是硬指标，可以卡绝对值
    expect(await at('reduce', 200)).toBeGreaterThan(0.95);
  });
});
