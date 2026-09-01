/**
 * Popover 的行为与几何回归。
 *
 * 几何基准来自 iOS 27 官方设计资源的 Edit Menu（节点 12740:24185，
 * 见 apple-metrics §7.7）：面板 250 宽、上下内边距 10、左右 16。
 *
 * ⚠️ **圆角 22 是推定值，不是实测。** 菜单面板是半透明玻璃压在中灰背景上，
 *    轮廓拟合不收敛（圆弧 RMSE 1.5–2.2px；自由超椭圆里 r 与 n 强烈互换）。
 *    这里断言 22 是为了**钉住实现不漂**，不是在断言 Apple 就是 22。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/overlay-demo.html')).href;

async function open(
  page: Page,
  opts: {
    theme?: string;
    tier?: string;
    tint?: number;
    open?: boolean;
    side?: string;
    align?: string;
  } = {},
) {
  const q = new URLSearchParams({
    theme: opts.theme ?? 'light',
    tier: opts.tier ?? 'a',
    tint: String(opts.tint ?? 0.34),
    only: 'popover',
  });
  if (opts.open !== false) q.set('open', '1');
  if (opts.side) q.set('side', opts.side);
  if (opts.align) q.set('align', opts.align);
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  if (opts.open !== false) await page.waitForTimeout(400); // 等入场 spring 静止
}

const PANEL = '[data-slot="popover-content"] .lg-surface';

const styleOf = (p: Page, sel: string, prop: string) =>
  p.evaluate(
    ([s, k]) => getComputedStyle(document.querySelector(s as string)!).getPropertyValue(k as string),
    [sel, prop] as const,
  );

test.describe('几何 —— 对齐 iOS 27 Edit Menu 的实测值', () => {
  test('面板 250 宽、内边距 10 / 16', async ({ page }) => {
    await open(page);
    const b = (await page.locator(PANEL).boundingBox())!;
    expect(Math.round(b.width)).toBe(250);
    expect(await styleOf(page, PANEL, 'padding-top')).toBe('10px');
    expect(await styleOf(page, PANEL, 'padding-bottom')).toBe('10px');
    expect(await styleOf(page, PANEL, 'padding-left')).toBe('16px');
    expect(await styleOf(page, PANEL, 'padding-right')).toBe('16px');
  });

  test('圆角 22（推定值，这条钉的是实现不漂）', async ({ page }) => {
    await open(page);
    expect(await styleOf(page, PANEL, 'border-radius')).toBe('22px');
  });

  test('width={null} 时由内容撑开', async ({ page }) => {
    await open(page);
    const natural = await page.evaluate(() => {
      const el = document.querySelector('[data-slot="popover-content"]') as HTMLElement;
      el.style.width = 'auto';
      return el.getBoundingClientRect().width;
    });
    // 内容是四个短标签，自然宽必然小于 250
    expect(natural).toBeLessThan(250);
  });
});

test.describe('分层 —— PROJECT_SPEC §2「弹层面板 + 高亮项」', () => {
  test('面板是 elevated', async ({ page }) => {
    await open(page);
    await expect(page.locator(PANEL)).toHaveAttribute('data-layer', 'elevated');
  });

  test('本组件里没有 Layer I —— 高亮项属于 Select / DropdownMenu', async ({ page }) => {
    await open(page);
    await expect(page.locator('.lg-surface[data-layer="indicator"]')).toHaveCount(0);
  });

  test('面板是磨砂的，**任何 Tier 下都不折射**', async ({ page }) => {
    /**
     * 这条容易写反：Tier A 是「折射可用」，不是「所有玻璃都折射」。
     * SPEC §2 的 Layer B 定义就是**磨砂底座，不折射** —— 折射（`url(#…)` 的
     * SVG 滤镜）只挂在 `layer="indicator"` 上。Popover 的面板是 elevated，
     * 属于 Layer B，所以三档下都只有 blur + saturate。
     * （第一版把它写成「Tier A 应当有 url(」，当场红了。）
     */
    const read = () => styleOf(page, PANEL, 'backdrop-filter');
    for (const tier of ['a', 'b'] as const) {
      await open(page, { tier });
      const v = await read();
      expect(v, `tier ${tier} 应当有模糊`).toContain('blur');
      expect(v, `tier ${tier} 不该有折射`).not.toContain('url(');
    }
    await open(page, { tier: 'c' });
    expect(await read()).toBe('none');
  });
});

test.describe('定位与动画起点', () => {
  test('side / align 透传到 Radix，且缩放原点跟着落位走', async ({ page }) => {
    // Radix 把落位算好后写进 data-side / data-align 与 transform-origin 变量，
    // 组件只负责把缩放原点对上它 —— 这条测的是那条接线没断。
    for (const [side, align, origin] of [
      ['bottom', 'start', '0px 0px'],
      ['top', 'end', /100% 100%|250px 180px/],
    ] as const) {
      await open(page, { side, align });
      const content = page.locator('[data-slot="popover-content"]');
      await expect(content).toHaveAttribute('data-side', side);
      await expect(content).toHaveAttribute('data-align', align);
      const got = await styleOf(page, '[data-slot="popover-panel"]', 'transform-origin');
      if (typeof origin === 'string') expect(got).toBe(origin);
      else expect(got).toMatch(origin);
    }
  });

  test('面板落在触发器下方（side=bottom）', async ({ page }) => {
    await open(page, { side: 'bottom' });
    const trigger = (await page.getByRole('button', { name: '打开浮层' }).boundingBox())!;
    const panel = (await page.locator(PANEL).boundingBox())!;
    expect(panel.y).toBeGreaterThanOrEqual(trigger.y + trigger.height);
    // sideOffset 默认 8
    expect(Math.round(panel.y - (trigger.y + trigger.height))).toBe(8);
  });
});

test.describe('无障碍偏好降级（PROJECT_SPEC §13）', () => {
  test('reduced-transparency 下面板不再模糊、材质压到接近实色', async ({ browser }) => {
    // Playwright 没这个开关，用 CDP 塞 media feature（做 Card 时找到的办法）
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
    });
    await open(page);
    expect(await styleOf(page, PANEL, 'backdrop-filter')).toBe('none');
    const alpha = await page.evaluate((sel) => {
      const m = getComputedStyle(document.querySelector(sel)!).backgroundColor.match(/[\d.]+/g)!;
      return m.length === 4 ? Number(m[3]) : 1;
    }, PANEL);
    expect(alpha).toBeGreaterThan(0.9);
    await ctx.close();
  });

  test('reduced-motion 下入场过渡明显更短', async ({ browser }) => {
    /**
     * 判据是**两次实测相比**，不写死某个时刻该到多少 ——
     * 那等于把 springs 预设的内部参数抄进测试里，以后调预设会误报。
     */
    const at = async (reducedMotion: 'reduce' | 'no-preference') => {
      const ctx = await browser.newContext({ reducedMotion });
      const page = await ctx.newPage();
      await open(page, { open: false });
      await page.getByRole('button', { name: '打开浮层' }).click();
      await page.waitForTimeout(60);
      const o = await page.evaluate(() =>
        Number(getComputedStyle(document.querySelector('[data-slot="popover-panel"]')!).opacity),
      );
      await ctx.close();
      return o;
    };
    expect(await at('reduce')).toBeGreaterThan(await at('no-preference'));
  });
});

test.describe('a11y 与交互', () => {
  test('触发器带 aria-expanded，且跟随开关', async ({ page }) => {
    await open(page, { open: false });
    const trigger = page.getByRole('button', { name: '打开浮层' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('Esc 关闭，焦点还给触发器', async ({ page }) => {
    await open(page, { open: false });
    const trigger = page.getByRole('button', { name: '打开浮层' });
    await trigger.click();
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('点外部关闭', async ({ page }) => {
    await open(page);
    await page.mouse.click(700, 480); // 远离面板与触发器
    await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0);
  });

  test('可访问名称走 aria-label（浮层里没有可见标题）', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-slot="popover-content"]')).toHaveAttribute(
      'aria-label',
      '编辑菜单',
    );
  });
});
