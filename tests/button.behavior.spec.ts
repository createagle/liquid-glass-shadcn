/**
 * Button 的行为与几何回归。
 *
 * 与其他 *.behavior.spec.ts 同样的原则：只断言**确定性事实**
 * （尺寸、DOM 结构、a11y 语义、降级分支），不含截图。
 *
 * 几何基准来自 iOS 27 官方设计资源：
 *   按钮高 48pt（工具栏 12740:24071 与 Alert §7.6 两处独立印证）
 *   水平内边距 12pt、标签 17pt、胶囊
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/button-demo.html')).href;

async function open(
  page: Page,
  opts: { theme?: string; tier?: string; tint?: number; only?: string } = {},
) {
  const q = new URLSearchParams({
    theme: opts.theme ?? 'light',
    tier: opts.tier ?? 'a',
    tint: String(opts.tint ?? 0.34),
  });
  if (opts.only) q.set('only', opts.only);
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

const btn = (p: Page, nth = 0) => p.locator('[data-slot="button"]').nth(nth);

const styleOf = (p: Page, nth: number, prop: string) =>
  p.evaluate(
    ([n, k]) => {
      const el = document.querySelectorAll('[data-slot="button"]')[n as number] as HTMLElement;
      return getComputedStyle(el).getPropertyValue(k as string);
    },
    [nth, prop] as const,
  );

test.describe('几何 —— 对齐 iOS 27 实测值', () => {
  test('三档高度 44 / 48 / 56，内边距按比例', async ({ page }) => {
    await open(page, { only: 'glass' });
    // 顺序：sm / default / lg / icon / disabled
    for (const [i, h, pad] of [
      [0, 44, '11px'],
      [1, 48, '12px'],
      [2, 56, '14px'],
    ] as const) {
      const b = (await btn(page, i).boundingBox())!;
      expect(Math.round(b.height), `第 ${i} 个`).toBe(h);
      expect(await styleOf(page, i, 'padding-left')).toBe(pad);
    }
  });

  test('胶囊：圆角恒为高的一半', async ({ page }) => {
    await open(page, { only: 'glass' });
    for (const [i, r] of [
      [0, '22px'],
      [1, '24px'],
      [2, '28px'],
    ] as const) {
      expect(await styleOf(page, i, 'border-radius')).toBe(r);
    }
  });

  test('标签 17px —— iOS body', async ({ page }) => {
    await open(page, { only: 'glass' });
    expect(await styleOf(page, 1, 'font-size')).toBe('17px');
  });

  test('icon 是正方形，且不小于 HIG 的 44pt', async ({ page }) => {
    await open(page, { only: 'glass' });
    const b = (await btn(page, 3).boundingBox())!;
    expect(Math.round(b.width)).toBe(48);
    expect(Math.round(b.height)).toBe(48);
    expect(b.height).toBeGreaterThanOrEqual(44);
  });

  test('最小的一档也满足 44pt 触控目标', async ({ page }) => {
    await open(page, { only: 'glass' });
    const b = (await btn(page, 0).boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('分层 —— PROJECT_SPEC §2「静止底座，按下升级为 Layer I」', () => {
  test('glass：静止是 base，按下变 indicator，松手回落', async ({ page }) => {
    await open(page, { only: 'glass' });
    const surface = btn(page, 1).locator('.lg-surface');
    await expect(surface).toHaveAttribute('data-layer', 'base');

    const b = (await btn(page, 1).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect(surface).toHaveAttribute('data-layer', 'indicator');
    await expect(surface).toHaveAttribute('data-pressed', 'true');
    await page.mouse.up();
    await expect(surface).toHaveAttribute('data-layer', 'base');
  });

  test('升级到 Layer I 时必须补回材质 —— 否则可读性地板消失', async ({ page }) => {
    await open(page, { only: 'glass' });
    const fill = btn(page, 1).locator('[data-slot="button-legibility-fill"]');
    await expect(fill).toHaveCount(0);

    const b = (await btn(page, 1).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect(fill).toHaveCount(1);
    // 必须是**不为零**的材质不透明度，α=0 等于没有地板
    const alpha = await page.evaluate(() => {
      const el = document.querySelector('[data-slot="button-legibility-fill"]') as HTMLElement;
      const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)!;
      return m.length === 4 ? Number(m[3]) : 1;
    });
    expect(alpha).toBeGreaterThan(0.2);
    await page.mouse.up();
  });

  test('实心变体按下时不升级 —— 底色不透明，折射看不见且会伤对比度', async ({ page }) => {
    await open(page, { only: 'prominent' });
    const surface = btn(page, 1).locator('.lg-surface');
    const b = (await btn(page, 1).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect(surface).toHaveAttribute('data-layer', 'base');
    await page.mouse.up();
  });

  test('只有 Tier A 的按下态走 SVG 折射', async ({ page }) => {
    const pressAndRead = async () => {
      const b = (await btn(page, 1).boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(120);
      const f = await page.evaluate(() => {
        const el = document.querySelectorAll('[data-slot="button"]')[1]!.querySelector(
          '.lg-surface',
        ) as HTMLElement;
        return getComputedStyle(el).backdropFilter;
      });
      await page.mouse.up();
      return f;
    };
    await open(page, { only: 'glass', tier: 'a' });
    expect(await pressAndRead()).toContain('url(');
    await open(page, { only: 'glass', tier: 'b' });
    expect(await pressAndRead()).not.toContain('url(');
    await open(page, { only: 'glass', tier: 'c' });
    expect(await pressAndRead()).not.toContain('url(');
  });
});

test.describe('变体', () => {
  test('实心变体用的是 AA 安全的填充色，不是真实系统色', async ({ page }) => {
    await open(page, { only: 'prominent' });
    const bg = await page.evaluate(() => {
      const el = document.querySelector('[data-slot="button-fill"]') as HTMLElement;
      return getComputedStyle(el).backgroundColor;
    });
    // 真实 systemBlue 是 rgb(0, 122, 255)，白字压上去只有 4.02:1
    expect(bg).not.toBe('rgb(0, 122, 255)');
    expect(bg).toBe('rgb(0, 113, 235)');
  });

  test('plain 没有材质层', async ({ page }) => {
    await open(page, { only: 'plain' });
    await expect(btn(page, 1).locator('.lg-surface')).toHaveCount(0);
    await expect(btn(page, 1).locator('[data-slot="button-highlight"]')).toHaveCount(1);
  });

  test('装饰层不进无障碍树', async ({ page }) => {
    await open(page, { only: 'prominent' });
    for (const slot of ['button-fill', 'button-dim']) {
      await expect(page.locator(`[data-slot="${slot}"]`).first()).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    }
  });
});

test.describe('交互与 a11y', () => {
  test('role=button，键盘可触发', async ({ page }) => {
    await open(page, { only: 'glass' });
    await expect(page.getByRole('button').first()).toBeVisible();
    // 计数放在页面里，不用 exposeFunction —— 那条桥是异步的，
    // 断言会和第二次点击竞争（本来写成 exposeFunction，量到 1 而不是 2）。
    await page.evaluate(() => {
      const w = window as unknown as { __clicks: number };
      w.__clicks = 0;
      const el = document.querySelectorAll('[data-slot="button"]')[1] as HTMLElement;
      el.addEventListener('click', () => (w.__clicks += 1));
    });
    const clicks = () =>
      page.evaluate(() => (window as unknown as { __clicks: number }).__clicks);

    await btn(page, 1).focus();
    await page.keyboard.press('Enter');
    await expect.poll(clicks).toBe(1);
    await page.keyboard.press('Space');
    await expect.poll(clicks).toBe(2);
  });

  test('disabled 不可点且不进入按下态', async ({ page }) => {
    await open(page, { only: 'glass' });
    const d = btn(page, 4);
    await expect(d).toBeDisabled();
    const b = (await d.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect(d).not.toHaveAttribute('data-pressed', 'true');
    await page.mouse.up();
  });

  test('指针移出后按下态不会卡住', async ({ page }) => {
    await open(page, { only: 'glass' });
    const b = (await btn(page, 1).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect(btn(page, 1)).toHaveAttribute('data-pressed', 'true');
    await page.mouse.move(b.x + 500, b.y + 200);
    await page.mouse.up();
    await expect(btn(page, 1)).not.toHaveAttribute('data-pressed', 'true');
  });

  test('type 默认是 button —— 放进表单里不该误提交', async ({ page }) => {
    await open(page, { only: 'glass' });
    await expect(btn(page, 1)).toHaveAttribute('type', 'button');
  });
});
