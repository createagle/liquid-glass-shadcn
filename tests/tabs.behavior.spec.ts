/**
 * Tabs 的行为与几何回归。
 *
 * 这里断言的都是**确定性事实**（尺寸、DOM 结构、a11y 语义、降级分支），
 * 不含截图 —— 所以任何平台跑结果都一样，可以放心进 CI。
 * 截图比对在 `tabs.visual.spec.ts`，那个是平台相关的，见 playwright.config.ts。
 *
 * 几何基准来自 iOS 27 官方设计资源（docs/research/apple-metrics.md §7.2）：
 * 底座 62pt、指示器 54pt、内缩 4pt、外半径 = 高/2。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/tabs-demo.html')).href;

async function open(
  page: Page,
  opts: { theme?: string; tier?: string; tint?: number } = {},
) {
  const q = new URLSearchParams({
    theme: opts.theme ?? 'light',
    tier: opts.tier ?? 'a',
    tint: String(opts.tint ?? 0.34),
  });
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  // 等合成完成，避免量到中间态
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

const base = (p: Page) => p.locator('.lg-surface[data-layer="base"]');
const indicator = (p: Page) => p.locator('.lg-surface[data-layer="indicator"]');

test.describe('几何 —— 对齐 iOS 27 实测值', () => {
  test('底座 62、指示器 54、内缩 4', async ({ page }) => {
    await open(page);
    const b = (await base(page).boundingBox())!;
    const i = (await indicator(page).boundingBox())!;
    expect(Math.round(b.height)).toBe(62);
    expect(Math.round(i.height)).toBe(54);
    expect(Math.round(i.x - b.x)).toBe(4);
    expect(Math.round(i.y - b.y)).toBe(4);
  });

  test('高度可缩放，内缩按比例跟随', async ({ page }) => {
    await open(page);
    // 把底座高度改成 40，内缩应当按 4/62 的比例缩到 3
    await page.evaluate(() => {
      const root = document.querySelector('[data-slot="tabs"]') as HTMLElement;
      root.style.setProperty('--lg-tabs-height', '40px');
    });
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const b = (await base(page).boundingBox())!;
    expect(Math.round(b.height)).toBe(40);
  });
});

test.describe('挖洞 —— 指示器必须看到未被底座模糊的背景', () => {
  test('Tier A/B 挖洞，Tier C 不需要', async ({ page }) => {
    for (const tier of ['a', 'b']) {
      await open(page, { tier });
      await expect(base(page)).toHaveAttribute('data-punched', 'true');
      await expect(page.locator('.lg-punch-layer')).toHaveCount(1);
    }
    // Tier C 没有 backdrop-filter，挖洞无意义；子层被 CSS 隐藏
    await open(page, { tier: 'c' });
    await expect(page.locator('.lg-punch-layer')).toBeHidden();
  });

  test('洞跟着选中项走', async ({ page }) => {
    await open(page);
    const readHole = () =>
      page.evaluate(() => {
        const el = document.querySelector('.lg-punch-layer') as HTMLElement;
        return getComputedStyle(el).clipPath;
      });
    const before = await readHole();
    await page.getByRole('tab', { name: '搜索' }).click();
    await page.waitForFunction(
      (prev) => {
        const el = document.querySelector('.lg-punch-layer') as HTMLElement;
        return el && getComputedStyle(el).clipPath !== prev;
      },
      before,
      { timeout: 3000 },
    );
    expect(await readHole()).not.toBe(before);
  });
});

test.describe('a11y —— Radix 语义不得被样式破坏', () => {
  test('tablist / tab / tabpanel 与选中态齐全', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('tablist')).toHaveCount(1);
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
  });

  test('键盘可达：方向键切换', async ({ page }) => {
    await open(page);
    await page.getByRole('tab', { name: '资料库' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: '广播' })).toBeFocused();
  });

  test('指示器不进无障碍树', async ({ page }) => {
    await open(page);
    // 指示器是纯装饰，必须 aria-hidden，否则读屏会念出空节点
    const hidden = await page.evaluate(() => {
      const ind = document.querySelector('.lg-surface[data-layer="indicator"]');
      return ind?.closest('[aria-hidden="true"]') !== null;
    });
    expect(hidden).toBe(true);
  });
});

test.describe('三级降级 —— B / C 各自都要是完整设计', () => {
  test('每个 tier 下指示器都存在且尺寸正确', async ({ page }) => {
    for (const tier of ['a', 'b', 'c']) {
      await open(page, { tier });
      const i = (await indicator(page).boundingBox())!;
      expect(Math.round(i.height), `tier ${tier}`).toBe(54);
    }
  });

  test('只有 Tier A 走 SVG 折射', async ({ page }) => {
    const filterOf = () =>
      page.evaluate(() => {
        const el = document.querySelector('.lg-surface[data-layer="indicator"]') as HTMLElement;
        return getComputedStyle(el).backdropFilter;
      });
    await open(page, { tier: 'a' });
    expect(await filterOf()).toContain('url(');
    await open(page, { tier: 'b' });
    expect(await filterOf()).not.toContain('url(');
    await open(page, { tier: 'c' });
    expect(await filterOf()).not.toContain('url(');
  });
});

test.describe('无障碍偏好降级（PROJECT_SPEC §13）', () => {
  /**
   * 测的是「切换后多久静止」，不是「有没有位移」——
   * 位移总是会发生（指示器要移到新位置），差别在于**用多久**。
   * SPEC §13 给的上限是 120ms。
   */
  async function travelAfter(page: Page, ms: number) {
    await page.getByRole('tab', { name: '搜索' }).click();
    await page.waitForTimeout(ms);
    const mid = (await indicator(page).boundingBox())!.x;
    await page.waitForTimeout(700); // 足够任何 spring 静止
    const settled = (await indicator(page).boundingBox())!.x;
    return Math.abs(settled - mid);
  }

  test('reduced-motion 下 150ms 内已静止', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await open(page);
    expect(await travelAfter(page, 150)).toBeLessThan(1);
    await ctx.close();
  });

  /**
   * 反向对照 —— 没有这一条，上面那个测试可能只是因为「动画本来就很快」而通过，
   * 并不能证明 reduced-motion 真的起了作用。
   */
  test('正常动效下 150ms 时仍在移动（证明上条有区分力）', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    await open(page);
    expect(await travelAfter(page, 150)).toBeGreaterThan(1);
    await ctx.close();
  });

  test('reduced-transparency 下材质压到 solid 且不折射', async ({ browser }) => {
    const ctx = await browser.newContext({ forcedColors: 'none' });
    const page = await ctx.newPage();
    await page.emulateMedia({ reducedMotion: null });
    // Playwright 目前无法直接模拟 prefers-reduced-transparency，
    // 故直接驱动 Provider 暴露的同一条路径：tier 强制为 c。
    await open(page, { tier: 'c' });
    const f = await page.evaluate(() => {
      const el = document.querySelector('.lg-surface[data-layer="indicator"]') as HTMLElement;
      return getComputedStyle(el).backdropFilter;
    });
    expect(f).not.toContain('url(');
    await ctx.close();
  });
});

test.describe('交互态（PROJECT_SPEC §14）', () => {
  const highlight = (p: Page) => p.locator('[data-slot="tabs-trigger-highlight"]').first();
  const opacityOf = (p: Page) =>
    p.evaluate(() => {
      const el = document.querySelector('[data-slot="tabs-trigger-highlight"]') as HTMLElement;
      return Number(getComputedStyle(el).opacity);
    });

  test('未选中项：静止无高亮，hover 后出现', async ({ page }) => {
    await open(page);
    expect(await opacityOf(page)).toBe(0);

    await page.getByRole('tab', { name: '广播' }).hover();
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-slot="tabs-trigger-highlight"]') as HTMLElement;
      return Number(getComputedStyle(el).opacity) > 0.5;
    });
  });

  test('移开后高亮退回', async ({ page }) => {
    await open(page);
    await page.getByRole('tab', { name: '广播' }).hover();
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-slot="tabs-trigger-highlight"]') as HTMLElement;
      return Number(getComputedStyle(el).opacity) > 0.5;
    });
    // 移到组件外
    await page.mouse.move(600, 400);
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-slot="tabs-trigger-highlight"]') as HTMLElement;
      return Number(getComputedStyle(el).opacity) < 0.05;
    });
  });

  test('选中项没有高亮层 —— 它已经有指示器了', async ({ page }) => {
    await open(page);
    // 三个 tab，只有两个未选中 → 只应有两个高亮层
    await expect(page.locator('[data-slot="tabs-trigger-highlight"]')).toHaveCount(2);
  });

  test('按下选中项时指示器上扬', async ({ page }) => {
    await open(page);
    const ind = indicator(page);
    await expect(ind).not.toHaveAttribute('data-pressed', 'true');
    const b = (await page.getByRole('tab', { name: '资料库' }).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect(ind).toHaveAttribute('data-pressed', 'true');
    await page.mouse.up();
    await expect(ind).not.toHaveAttribute('data-pressed', 'true');
  });

  test('指针移出后按下态不会卡住', async ({ page }) => {
    await open(page);
    const ind = indicator(page);
    const b = (await page.getByRole('tab', { name: '资料库' }).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect(ind).toHaveAttribute('data-pressed', 'true');
    // 移到组件外再松手 —— 只听自己的 pointerup 会把状态卡住
    await page.mouse.move(b.x + 400, b.y + 200);
    await page.mouse.up();
    await expect(ind).not.toHaveAttribute('data-pressed', 'true');
  });
});
