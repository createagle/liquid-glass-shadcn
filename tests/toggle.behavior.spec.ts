/**
 * Toggle 的行为与几何回归。
 *
 * ⚠️ Toggle **没有自己的 Apple 参考图**（见组件顶部注释）。它的几何全部继承自
 * Button，所以这里最重要的一组断言是「与 Button 逐项相同」—— 一旦哪天 Button
 * 的实测值改了而 Toggle 没跟上，这里就会红。
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

const tog = (p: Page, nth = 0) => p.locator('[data-slot="toggle"]').nth(nth);

const boxOf = async (p: Page, sel: string, nth: number) => {
  const b = await p.locator(sel).nth(nth).boundingBox();
  if (!b) throw new Error(`量不到：${sel}#${nth}`);
  return b;
};

const styleOf = (p: Page, sel: string, nth: number, prop: string) =>
  p.evaluate(
    ([s, n, k]) =>
      getComputedStyle(document.querySelectorAll(s as string)[n as number]!).getPropertyValue(
        k as string,
      ),
    [sel, nth, prop] as const,
  );

test.describe('几何 —— 继承自 Button，必须逐项相同', () => {
  test('三档高度与内边距与 Button 一致', async ({ page }) => {
    // 不传 only：Button 的四行 + Toggle 一行同时在页面上
    await open(page);
    for (const [i, h, pad] of [
      [0, 44, '11px'],
      [1, 48, '12px'],
      [2, 56, '14px'],
    ] as const) {
      const t = await boxOf(page, '[data-slot="toggle"]', i);
      const b = await boxOf(page, '[data-slot="button"]', i);
      expect(Math.round(t.height), `第 ${i} 档高度`).toBe(h);
      expect(Math.round(t.height), `第 ${i} 档与 Button 同高`).toBe(Math.round(b.height));
      expect(await styleOf(page, '[data-slot="toggle"]', i, 'padding-left')).toBe(pad);
      expect(await styleOf(page, '[data-slot="toggle"]', i, 'padding-left')).toBe(
        await styleOf(page, '[data-slot="button"]', i, 'padding-left'),
      );
    }
  });

  test('胶囊圆角与字号也与 Button 一致', async ({ page }) => {
    await open(page);
    for (const i of [0, 1, 2]) {
      expect(await styleOf(page, '[data-slot="toggle"]', i, 'border-radius')).toBe(
        await styleOf(page, '[data-slot="button"]', i, 'border-radius'),
      );
    }
    expect(await styleOf(page, '[data-slot="toggle"]', 1, 'font-size')).toBe('17px');
  });

  test('icon 是正方形，且不小于 HIG 的 44pt', async ({ page }) => {
    await open(page, { only: 'toggle' });
    const b = await boxOf(page, '[data-slot="toggle"]', 3);
    expect(Math.round(b.width)).toBe(48);
    expect(Math.round(b.height)).toBe(48);
  });
});

test.describe('选中态 —— Layer I，且必须补回材质', () => {
  test('未选中没有材质层，选中后出现 Layer I', async ({ page }) => {
    await open(page, { only: 'toggle' });
    const t = tog(page, 1);
    await expect(t).toHaveAttribute('data-state', 'off');
    await expect(t.locator('.lg-surface')).toHaveCount(0);
    await expect(t.locator('[data-slot="toggle-highlight"]')).toHaveCount(1);

    await t.click();
    await expect(t).toHaveAttribute('data-state', 'on');
    await expect(t.locator('.lg-surface[data-layer="indicator"]')).toHaveCount(1);
  });

  test('选中态必须有可读性补偿层，且 α 不为零', async ({ page }) => {
    await open(page, { only: 'toggle' });
    const t = tog(page, 1);
    await t.click();
    const fill = t.locator('[data-slot="toggle-legibility-fill"]');
    await expect(fill).toHaveCount(1);
    // α=0 等于没有地板 —— Button 上实测过条纹背景下会掉到 1.92:1
    const alpha = await page.evaluate(() => {
      const el = document.querySelector('[data-slot="toggle-legibility-fill"]') as HTMLElement;
      const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)!;
      return m.length === 4 ? Number(m[3]) : 1;
    });
    expect(alpha).toBeGreaterThan(0.2);
  });

  test('只有 Tier A 的选中态走 SVG 折射', async ({ page }) => {
    const read = async () => {
      await tog(page, 1).click();
      await page.waitForTimeout(120);
      return page.evaluate(() => {
        const el = document
          .querySelectorAll('[data-slot="toggle"]')[1]!
          .querySelector('.lg-surface') as HTMLElement;
        return getComputedStyle(el).backdropFilter;
      });
    };
    await open(page, { only: 'toggle', tier: 'a' });
    expect(await read()).toContain('url(');
    await open(page, { only: 'toggle', tier: 'b' });
    expect(await read()).not.toContain('url(');
    await open(page, { only: 'toggle', tier: 'c' });
    expect(await read()).not.toContain('url(');
  });

  test('装饰层不进无障碍树', async ({ page }) => {
    await open(page, { only: 'toggle' });
    await expect(page.locator('[data-slot="toggle-highlight"]').first()).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await expect(page.locator('[data-slot="toggle-legibility-fill"]').first()).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});

test.describe('a11y 与状态', () => {
  test('aria-pressed 跟随状态', async ({ page }) => {
    await open(page, { only: 'toggle' });
    const t = tog(page, 1);
    await expect(t).toHaveAttribute('aria-pressed', 'false');
    await t.click();
    await expect(t).toHaveAttribute('aria-pressed', 'true');
    await t.click();
    await expect(t).toHaveAttribute('aria-pressed', 'false');
  });

  test('defaultPressed 首帧就是选中态，不播入场动画', async ({ page }) => {
    await open(page, { only: 'toggle' });
    // 第 4 个是 defaultPressed 的图标开关，第 5 个是 defaultPressed 的文字开关
    await expect(tog(page, 3)).toHaveAttribute('aria-pressed', 'true');
    await expect(tog(page, 4)).toHaveAttribute('aria-pressed', 'true');
    await expect(tog(page, 4).locator('.lg-surface[data-layer="indicator"]')).toHaveCount(1);
  });

  test('键盘可切换', async ({ page }) => {
    await open(page, { only: 'toggle' });
    const t = tog(page, 1);
    await t.focus();
    await page.keyboard.press('Enter');
    await expect(t).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Space');
    await expect(t).toHaveAttribute('aria-pressed', 'false');
  });

  test('disabled 不可切换', async ({ page }) => {
    await open(page, { only: 'toggle' });
    const d = tog(page, 5);
    await expect(d).toBeDisabled();
    await d.click({ force: true });
    await expect(d).toHaveAttribute('aria-pressed', 'false');
  });

  test('指针移出后按下态不会卡住', async ({ page }) => {
    await open(page, { only: 'toggle' });
    const b = await boxOf(page, '[data-slot="toggle"]', 1);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + 500, b.y + 300);
    await page.mouse.up();
    // 没卡住的判据：材质层的 pressed 标记已经撤掉
    await expect(page.locator('.lg-surface[data-pressed="true"]')).toHaveCount(0);
  });
});
