/**
 * Dialog 的行为与几何回归。
 *
 * 几何基准来自 iOS 27 官方设计资源（节点 12740:24495，见 apple-metrics §7.6）：
 *   面板 300 宽、圆角 34（拟合）、内边距 14、正文块再内缩 8、
 *   按钮 132×48 间距 8、标题与正文均 17/22
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/dialog-demo.html')).href;

async function open(
  page: Page,
  opts: { theme?: string; tier?: string; tint?: number; open?: boolean } = {},
) {
  const q = new URLSearchParams({
    theme: opts.theme ?? 'light',
    tier: opts.tier ?? 'a',
    tint: String(opts.tint ?? 0.34),
  });
  if (opts.open !== false) q.set('open', '1');
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  if (opts.open !== false) await page.waitForTimeout(600); // 等入场 spring 静止
}

// 按钮里也有 .lg-surface，必须锁到 elevated 那一层
const PANEL = '[data-slot="dialog-content"] .lg-surface[data-layer="elevated"]';
const panel = (p: Page) => p.locator(PANEL);

const styleOf = (p: Page, sel: string, prop: string) =>
  p.evaluate(
    ([s, k]) => getComputedStyle(document.querySelector(s as string)!).getPropertyValue(k as string),
    [sel, prop] as const,
  );

test.describe('几何 —— 对齐 iOS 27 实测值', () => {
  test('面板 300 宽、圆角 34、内边距 14', async ({ page }) => {
    await open(page);
    const b = (await panel(page).boundingBox())!;
    expect(Math.round(b.width)).toBe(300);
    expect(await styleOf(page, PANEL, 'border-radius')).toBe('34px');
    expect(await styleOf(page, PANEL, 'padding-left')).toBe('14px');
  });

  test('正文块相对面板再内缩 8，底部留 24', async ({ page }) => {
    await open(page);
    expect(await styleOf(page, '[data-slot="dialog-header"]', 'padding-left')).toBe('8px');
    expect(await styleOf(page, '[data-slot="dialog-header"]', 'padding-bottom')).toBe('24px');
  });

  test('两个按钮等分 272，间距 8 → 各 132', async ({ page }) => {
    await open(page);
    const btns = page.locator('[data-slot="dialog-footer"] [data-slot="button"]');
    await expect(btns).toHaveCount(2);
    const a = (await btns.nth(0).boundingBox())!;
    const c = (await btns.nth(1).boundingBox())!;
    expect(Math.round(a.width)).toBe(132);
    expect(Math.round(c.width)).toBe(132);
    expect(Math.round(a.height)).toBe(48);
    expect(Math.round(c.x - (a.x + a.width))).toBe(8);
  });

  test('标题与正文同为 17/22，标题更重', async ({ page }) => {
    await open(page);
    for (const slot of ['dialog-title', 'dialog-description']) {
      expect(await styleOf(page, `[data-slot="${slot}"]`, 'font-size')).toBe('17px');
      expect(await styleOf(page, `[data-slot="${slot}"]`, 'line-height')).toBe('22px');
    }
    expect(await styleOf(page, '[data-slot="dialog-title"]', 'font-weight')).toBe('600');
  });

  test('文字左对齐 —— iOS 26+ 不再居中', async ({ page }) => {
    await open(page);
    for (const slot of ['dialog-title', 'dialog-description']) {
      expect(await styleOf(page, `[data-slot="${slot}"]`, 'text-align')).toBe('left');
    }
  });
});

test.describe('分层 —— PROJECT_SPEC §2「Dialog = 面板，没有 Layer I」', () => {
  test('面板是 elevated，且整个弹窗里不存在 indicator 层', async ({ page }) => {
    await open(page);
    await expect(panel(page)).toHaveAttribute('data-layer', 'elevated');
    // 按钮自己的 base 层不算；indicator 只在按下时才出现
    await expect(page.locator('.lg-surface[data-layer="indicator"]')).toHaveCount(0);
  });

  test('面板不挖洞', async ({ page }) => {
    await open(page);
    await expect(panel(page)).not.toHaveAttribute('data-punched', 'true');
  });

  test('遮罩用的是 scrim token', async ({ page }) => {
    await open(page);
    const bg = await page.evaluate(() => {
      const el = document.querySelector('[data-slot="dialog-overlay"] > div') as HTMLElement;
      return getComputedStyle(el).backgroundColor;
    });
    expect(bg).toBe('rgba(0, 0, 0, 0.35)');
  });
});

test.describe('a11y 与交互', () => {
  test('role=dialog，标题接进无障碍名称', async ({ page }) => {
    await open(page);
    const dlg = page.getByRole('dialog');
    await expect(dlg).toHaveCount(1);
    await expect(dlg).toHaveAccessibleName('A Short Title Is Best');
  });

  test('Esc 关闭', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('点遮罩关闭', async ({ page }) => {
    await open(page);
    await page.mouse.click(20, 20); // 面板在正中，左上角必是遮罩
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('DialogClose 点击即关闭', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('触发器能打开', async ({ page }) => {
    await open(page, { open: false });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: '打开弹窗' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('焦点被收进弹窗，关闭后还给触发器', async ({ page }) => {
    await open(page, { open: false });
    const trigger = page.getByRole('button', { name: '打开弹窗' });
    await trigger.click();
    await page.waitForTimeout(400);
    const inside = await page.evaluate(
      () => !!document.activeElement?.closest('[data-slot="dialog-content"]'),
    );
    expect(inside).toBe(true);
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  });
});

test.describe('退场动画（AnimatePresence）', () => {
  /**
   * Radix 关闭时会立刻卸载 Content，退场动画根本来不及播 ——
   * 组件为此自己接管了开关态并用 forceMount + AnimatePresence。
   * 这条测的就是那套接管有没有生效：关闭指令发出后，元素应当**还在**一会儿。
   */
  test('关闭后元素不立即消失', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Cancel' }).click();
    // 关闭指令刚发出，退场动画应当还在跑
    const stillThere = await page
      .locator('[data-slot="dialog-content"]')
      .count()
      .catch(() => 0);
    expect(stillThere).toBe(1);
    // 动画跑完后才真正消失
    await expect(page.locator('[data-slot="dialog-content"]')).toHaveCount(0, { timeout: 3000 });
  });

  test('reduced-motion 下 150ms 内已消失', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await open(page);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(150);
    expect(await page.locator('[data-slot="dialog-content"]').count()).toBe(0);
    await ctx.close();
  });
});
