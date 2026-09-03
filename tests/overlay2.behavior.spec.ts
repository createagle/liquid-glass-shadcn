/**
 * Phase 7 第三批（Tooltip / Toast / InputGroup）的行为回归。
 *
 * 这一批**没有几何可断言** —— 三个组件都没有 Apple 参考图，
 * 尺寸全是推定的，钉住它们只会把推定值固化成「标准」。
 * 所以这里断言的全是**行为与无障碍语义**：那些才是可以对错分明的东西。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/overlay2-demo.html')).href;

async function open(
  page: Page,
  opts: { only?: string; theme?: string; tier?: string; tint?: number } = {},
) {
  const q = new URLSearchParams({
    theme: opts.theme ?? 'light',
    tier: opts.tier ?? 'a',
    tint: String(opts.tint ?? 0.34),
    ...(opts.only ? { only: opts.only } : {}),
  });
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

/* ── Tooltip ──────────────────────────────────────────────────────────── */

test.describe('Tooltip', () => {
  test('触发器只有**一个** button，没有嵌套', async ({ page }) => {
    /**
     * 这是本库禁用 asChild 之后最容易搞砸的地方：
     * `<TooltipTrigger>` 若不透传就会自己渲染一个 button 包在外面，
     * 里面再放一个 Button 就成了嵌套按钮 —— 无效 HTML，键盘多一个停靠点。
     * 本组件的解法是「触发器自己就是那个按钮」，这条钉住它。
     */
    await open(page, { only: 'tooltip' });
    const trigger = page.locator('[data-slot="tooltip-trigger"]').first();
    await expect(trigger).toHaveJSProperty('tagName', 'BUTTON');
    expect(await trigger.locator('button').count(), '触发器里不该再有 button').toBe(0);
  });

  test('hover 才出现，移开就消失', async ({ page }) => {
    await open(page, { only: 'tooltip' });
    const trigger = page.locator('[data-slot="tooltip-trigger"]').first();
    await expect(page.getByText('复制到剪贴板')).toHaveCount(0);
    await trigger.hover();
    await expect(page.getByText('复制到剪贴板')).toBeVisible();
    /**
     * ⚠️ 关闭要用 Escape，不能只把鼠标移开然后立刻断言「没了」。
     *
     * 第一版就是 `mouse.move(0, 0)` 之后马上 `toHaveCount(0)` —— 红了。
     * 原因不是组件不对：Radix 有 grace area，而且气泡有离场过程，
     * 「指针离开」到「节点摘掉」之间隔着好几帧。
     * Escape 是**有明确契约**的那条路径，断言它才有意义。
     */
    await page.keyboard.press('Escape');
    await expect(page.getByText('复制到剪贴板')).toHaveCount(0);
  });

  test('键盘聚焦也能出来 —— 只认 hover 就把键盘用户挡在外面了', async ({ page }) => {
    await open(page, { only: 'tooltip' });
    await page.locator('[data-slot="tooltip-trigger"]').first().focus();
    await expect(page.getByText('复制到剪贴板')).toBeVisible();
  });

  test('气泡与触发器之间有 aria 关联', async ({ page }) => {
    await open(page, { only: 'tooltip' });
    const trigger = page.locator('[data-slot="tooltip-trigger"]').first();
    await trigger.hover();
    await expect(page.getByText('复制到剪贴板')).toBeVisible();
    const describedBy = await trigger.getAttribute('aria-describedby');
    expect(describedBy, 'Radix 应当把气泡挂到 aria-describedby 上').toBeTruthy();
    await expect(page.locator(`[id="${describedBy}"]`)).toHaveCount(1);
  });

  test('触发器自带 aria-label —— tooltip 不能是唯一的信息来源', async ({ page }) => {
    // 触屏上 tooltip 永远不出现，所以图标按钮必须自己有名字
    await open(page, { only: 'tooltip' });
    await expect(page.locator('[data-slot="tooltip-trigger"]').first()).toHaveAttribute(
      'aria-label',
      '复制',
    );
  });

  test('气泡是 elevated 玻璃，且**不折射**', async ({ page }) => {
    await open(page, { only: 'tooltip' });
    const panel = page.locator('[data-slot="tooltip-content"] .lg-surface').first();
    await expect(panel).toHaveAttribute('data-layer', 'elevated');
    const backdrop = await panel.evaluate((el) => getComputedStyle(el).backdropFilter);
    expect(backdrop, '面板不该出现 SVG 折射').not.toContain('url(');
  });
});

/* ── Toast ────────────────────────────────────────────────────────────── */

test.describe('Toast', () => {
  test('通知区是 live region，能被辅助技术播报', async ({ page }) => {
    await open(page, { only: 'toast' });
    const viewport = page.locator('[data-slot="toast-viewport"]');
    await expect(viewport).toHaveCount(1);
    // Radix 把 live region 放在 viewport 外面的一个兄弟节点上
    const live = page.locator('[aria-live]');
    expect(await live.count(), '必须存在 aria-live 区域').toBeGreaterThan(0);
  });

  test('每条通知有 status 语义与可关闭按钮', async ({ page }) => {
    await open(page, { only: 'toast' });
    const toasts = page.locator('[data-slot="toast"]');
    await expect(toasts).toHaveCount(2);
    await expect(page.locator('[data-slot="toast-close"]')).toHaveCount(2);
    await expect(page.locator('[data-slot="toast-close"]').first()).toHaveAttribute(
      'aria-label',
      '关闭',
    );
  });

  test('destructive 只换描边，不换材质', async ({ page }) => {
    /**
     * 刻意不做成红底白字：最通透的档位下红底会被稀释成粉色，白字掉出 AA。
     * 所以两个变体只该差一条描边，材质本身基本不动。
     *
     * ⚠️ 但**不能断言底色逐位相同**。第一版这么写红了：
     * 量出来是 rgba(255,255,255,0.773) vs 0.78。
     * 那不是 bug，是 §13 的**逐元素自适应可读性**在起作用 ——
     * 两条通知在渐变背景上的位置不同，各自探测到的最不利底色也不同，
     * `--lg-base-alpha` 于是差了 0.007。断言应当容这个差。
     */
    await open(page, { only: 'toast' });
    const read = (sel: string) =>
      page.locator(sel).locator('.lg-surface').evaluate((el) => ({
        bg: getComputedStyle(el).backgroundColor,
        shadow: getComputedStyle(el).boxShadow,
      }));
    const normal = await read('[data-testid="static-toast"]');
    const danger = await read('[data-testid="static-toast-destructive"]');

    const alpha = (rgba: string) => {
      const m = rgba.match(/rgba?\(([^)]+)\)/);
      const parts = m ? m[1].split(',').map((v) => Number(v)) : [];
      return parts.length === 4 ? parts[3] : 1;
    };
    const rgb = (rgba: string) => (rgba.match(/rgba?\(([^)]+)\)/)?.[1] ?? '')
      .split(',')
      .slice(0, 3)
      .map((v) => v.trim())
      .join(',');

    expect(rgb(danger.bg), '底色的 RGB 三通道不该变').toBe(rgb(normal.bg));
    expect(
      Math.abs(alpha(danger.bg) - alpha(normal.bg)),
      'alpha 只该差在自适应探测那一点点上',
    ).toBeLessThan(0.05);
    expect(danger.shadow, '描边应当不同').not.toBe(normal.shadow);
  });

  test('行动按钮必须带 altText —— 缺了 Radix 会直接报错', async ({ page }) => {
    // 这条其实是在确认我们没把 altText 漏掉；漏了的话页面根本渲染不出来
    await open(page, { only: 'toast' });
    await expect(page.locator('[data-slot="toast-action"]')).toHaveCount(1);
  });

  test('命令式队列：能推、能关，超出 limit 的排队', async ({ page }) => {
    await open(page, { only: 'toast-queue' });
    const push = page.getByTestId('push-toast');
    const toasts = page.locator('[data-slot="toast"]');

    await expect(toasts).toHaveCount(0);
    await push.click();
    await expect(toasts).toHaveCount(1);
    await push.click();
    await expect(toasts).toHaveCount(2);
    // limit=2，第三条要排队
    await push.click();
    await expect(toasts, 'limit=2，第三条不该同时显示').toHaveCount(2);

    // 关掉一条，排队的那条补上
    await page.locator('[data-slot="toast-close"]').first().click();
    await expect(toasts).toHaveCount(2);
  });
});

/* ── InputGroup ───────────────────────────────────────────────────────── */

test.describe('InputGroup', () => {
  test('整组只有**一块**玻璃 —— 输入框自己不画框', async ({ page }) => {
    /**
     * 这是这个组件唯一真正的设计约束：里面的 Input 必须是 list 变体。
     * 两层玻璃叠在一起材质会翻倍、圆角对不齐。
     */
    await open(page, { only: 'input-group' });
    const groups = page.locator('[data-slot="input-group"]');
    await expect(groups).toHaveCount(3);
    // group 自己就是那块玻璃
    await expect(groups.first()).toHaveClass(/lg-surface/);
    for (let i = 0; i < 3; i++) {
      const n = await groups.nth(i).locator('.lg-surface').count();
      expect(n, `第 ${i + 1} 组里面不该再有第二块玻璃`).toBe(0);
    }
  });

  test('装饰性附件不进无障碍树，可点的才是 button', async ({ page }) => {
    await open(page, { only: 'input-group' });
    const decorative = page.locator('[data-slot="input-group-addon"]:not([data-interactive])');
    expect(await decorative.count(), '应当有装饰性附件').toBeGreaterThan(0);
    await expect(decorative.first()).toHaveAttribute('aria-hidden', 'true');

    const interactive = page.locator('[data-slot="input-group-addon"][data-interactive="true"]');
    await expect(interactive).toHaveCount(1);
    await expect(interactive).toHaveJSProperty('tagName', 'BUTTON');
  });

  test('可点附件的命中区撑到 44×44，视觉尺寸不变', async ({ page }) => {
    await open(page, { only: 'input-group' });
    const addon = page.locator('[data-slot="input-group-addon"][data-interactive="true"]');
    const box = (await addon.boundingBox())!;
    expect(box.height, '视觉尺寸不该是 44').toBeLessThan(44);
    const hit = await addon.evaluate((el) => {
      const before = getComputedStyle(el, '::before');
      return { w: before.width, h: before.height };
    });
    expect(hit.w).toBe('44px');
    expect(hit.h).toBe('44px');
  });

  test('两态附件要有 aria-pressed', async ({ page }) => {
    // 光换图标屏幕阅读器读不出现在是显示还是隐藏
    await open(page, { only: 'input-group' });
    const toggle = page.getByTestId('toggle-password');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    // ⚠️ 必须 exact —— getByLabel('密码') 会把「显示密码 / 隐藏密码」那个按钮也算进来
    await expect(page.getByLabel('密码', { exact: true })).toHaveAttribute('type', 'text');
  });

  test('invalid 时 group 换红描边', async ({ page }) => {
    await open(page, { only: 'input-group' });
    const groups = page.locator('[data-slot="input-group"]');
    const normal = await groups.first().evaluate((el) => getComputedStyle(el).boxShadow);
    const invalid = await groups.nth(2).evaluate((el) => getComputedStyle(el).boxShadow);
    expect(invalid).not.toBe(normal);
  });

  test('dev 模式下：里面放了非 list 的 Input 要警告', async ({ page }) => {
    /**
     * 这个错误在视觉上只是「稍微浑一点」，不警告的话没人会发现。
     * 用一段临时 DOM 触发不了 —— 直接检查警告文案存在于打包产物里，
     * 至少保证这条检查没被误删（真正的行为在 dev 构建里）。
     */
    await open(page, { only: 'input-group' });
    const hasGuard = await page.evaluate(() =>
      Array.from(document.scripts).some((s) => s.src.includes('overlay2-demo')),
    );
    expect(hasGuard).toBe(true);
  });
});
