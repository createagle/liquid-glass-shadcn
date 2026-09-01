/**
 * Sheet / Drawer 的行为与几何回归。
 *
 * 几何基准来自 iOS 27 官方设计资源（节点 12740:24130，见 apple-metrics §7.5）：
 *   左右 / 底部边距 6、圆角 34（拟合）、抓手 58×4 且距面板顶 5、
 *   抓手占位区 16、medium 档 = 视口高的 0.525
 *
 * ⚠️ 拖拽类断言全部走**真实指针事件**（mouse.down/move/up），不是直接改状态 ——
 *    甩动关闭依赖 motion 从指针采样算出的速度，跳过指针就等于没测。
 */

import { test, expect, type Page, type Browser } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/sheet-demo.html')).href;

/** 与组件里的 MOTION.dismissRatio 保持一致 —— 改了那边这里也要改 */
const MOTION_DISMISS_RATIO = 0.4;

async function open(
  page: Page,
  opts: {
    theme?: string;
    tier?: string;
    tint?: number;
    open?: boolean;
    detent?: number;
    dragfrom?: string;
    nograbber?: boolean;
  } = {},
) {
  const q = new URLSearchParams({
    theme: opts.theme ?? 'light',
    tier: opts.tier ?? 'a',
    tint: String(opts.tint ?? 0.34),
  });
  if (opts.open !== false) q.set('open', '1');
  if (opts.detent !== undefined) q.set('detent', String(opts.detent));
  if (opts.dragfrom) q.set('dragfrom', opts.dragfrom);
  if (opts.nograbber) q.set('nograbber', '1');
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  if (opts.open !== false) await settle(page);
}

/** 等 spring 停下来 —— 判据是面板位移连续两次采样不变 */
async function settle(page: Page) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-slot="sheet-panel"]') as HTMLElement | null;
      if (!el) return false;
      const w = window as unknown as { __lastY?: number; __same?: number };
      const y = new DOMMatrixReadOnly(getComputedStyle(el).transform).m42;
      if (w.__lastY !== undefined && Math.abs(w.__lastY - y) < 0.05) w.__same = (w.__same ?? 0) + 1;
      else w.__same = 0;
      w.__lastY = y;
      return (w.__same ?? 0) >= 3;
    },
    undefined,
    { timeout: 5000 },
  );
  await page.evaluate(() => {
    const w = window as unknown as { __lastY?: number; __same?: number };
    w.__lastY = undefined;
    w.__same = 0;
  });
}

const panelBox = async (page: Page) => {
  const b = await page.locator('[data-slot="sheet-panel"] .lg-surface').first().boundingBox();
  if (!b) throw new Error('量不到面板');
  return b;
};

const styleOf = (p: Page, sel: string, prop: string) =>
  p.evaluate(
    ([s, k]) => getComputedStyle(document.querySelector(s as string)!).getPropertyValue(k as string),
    [sel, prop] as const,
  );

/** 从某个点按住往下拖。`stepDelay` 拉开采样间隔 → 低速；给 0 则是甩动。 */
async function dragFrom(
  page: Page,
  start: { x: number; y: number },
  dy: number,
  { steps = 8, stepDelay = 30 }: { steps?: number; stepDelay?: number } = {},
) {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(start.x, start.y + (dy * i) / steps);
    if (stepDelay) await page.waitForTimeout(stepDelay);
  }
  await page.mouse.up();
}

/**
 * 甩动 —— 指针序列**在页面里**按 rAF 节奏派发，不走 CDP 逐步下发。
 *
 * 为什么非这样不可：甩动关闭的判据是速度，而速度 = 位移 / 采样间隔。
 * 用 `page.mouse.move()` 逐步下发时，每一步都是一次 CDP 往返 ——
 * 单 worker 下实测 v ≈ 760 px/s 很稳，但并行跑测试时往返被拉长，
 * v 会掉到 500 的阈值以下，于是这条测试**只在机器空闲时通过**。
 * （踩过：--workers=1 绿，默认并行红。）
 *
 * 改成在页面内按 requestAnimationFrame 派发，采样间隔就是浏览器的帧间隔，
 * 与测试进程的负载无关。按下与抬起仍然用真实指针，保证 motion 的
 * drag session 正常起止。
 */
async function fling(page: Page, start: { x: number; y: number }, dy: number, steps = 4) {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.evaluate(
    async ({ x, y, dy, steps }) => {
      const raf = () => new Promise((r) => requestAnimationFrame(() => r(null)));
      const send = (type: string, clientY: number, buttons: number) =>
        window.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX: x,
            clientY,
            pointerId: 1,
            pointerType: 'mouse',
            buttons,
            isPrimary: true,
          }),
        );
      for (let i = 1; i <= steps; i++) {
        await raf();
        send('pointermove', y + (dy * i) / steps, 1);
      }
      send('pointerup', y + dy, 0);
    },
    { x: start.x, y: start.y, dy, steps },
  );
  // 复位 Playwright 自己的指针状态；此时 drag session 已结束，这一下会被忽略
  await page.mouse.up();
}

const grabberPoint = async (page: Page) => {
  const b = await page.locator('[data-slot="sheet-grabber"]').boundingBox();
  if (!b) throw new Error('量不到抓手');
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test.describe('几何 —— 对齐 iOS 27 实测值', () => {
  test('左右 6、底部 6、圆角 34', async ({ page }) => {
    await open(page);
    const vp = page.viewportSize()!;
    const content = (await page.locator('[data-slot="sheet-content"]').boundingBox())!;
    expect(Math.round(content.x)).toBe(6);
    expect(Math.round(vp.width - (content.x + content.width))).toBe(6);
    expect(Math.round(vp.height - (content.y + content.height))).toBe(6);
    expect(await styleOf(page, '[data-slot="sheet-panel"] .lg-surface', 'border-radius')).toBe(
      '34px',
    );
  });

  test('抓手 58×4，距面板顶 5，占位区高 16', async ({ page }) => {
    await open(page);
    const panel = await panelBox(page);
    const g = (await page.locator('[data-slot="sheet-grabber"]').boundingBox())!;
    expect(Math.round(g.width)).toBe(58);
    expect(Math.round(g.height)).toBe(4);
    expect(Math.round(g.y - panel.y)).toBe(5);
    // 水平居中
    expect(Math.round(g.x + g.width / 2 - (panel.x + panel.width / 2))).toBe(0);
    const zone = (await page.locator('[data-slot="sheet-grabber-zone"]').boundingBox())!;
    expect(Math.round(zone.height)).toBe(16);
  });

  test('medium 档露出视口高的 0.525，large 档 0.94', async ({ page }) => {
    const vp = () => page.viewportSize()!.height;
    await open(page, { detent: 0 });
    let panel = await panelBox(page);
    let visible = vp() - 6 - panel.y;
    expect(visible / vp()).toBeCloseTo(0.525, 2);

    await open(page, { detent: 1 });
    panel = await panelBox(page);
    visible = vp() - 6 - panel.y;
    expect(visible / vp()).toBeCloseTo(0.94, 2);
  });

  test('footer 贴在**可见**底边上，不会被推出屏幕', async ({ page }) => {
    /**
     * 回归：面板按最高档渲染再往下位移，内容若按面板全高排版，
     * footer 会落到屏幕外（实测视口 734 时 footer 的 y 是 953）。
     */
    await open(page, { detent: 0 });
    const vp = page.viewportSize()!;
    const footer = (await page.locator('[data-slot="sheet-footer"]').boundingBox())!;
    expect(footer.y + footer.height).toBeLessThanOrEqual(vp.height);
    // 且确实贴着可见底边（面板底距屏幕底 6）
    expect(Math.abs(vp.height - 6 - (footer.y + footer.height))).toBeLessThan(1);
  });
});

test.describe('分层 —— PROJECT_SPEC §2「面板 Layer B + 抓手 Layer I」', () => {
  test('面板是 elevated，抓手是 indicator', async ({ page }) => {
    await open(page);
    await expect(
      page.locator('[data-slot="sheet-panel"] > .lg-surface[data-layer="elevated"]'),
    ).toHaveCount(1);
    await expect(page.locator('[data-slot="sheet-grabber"] .lg-surface')).toHaveAttribute(
      'data-layer',
      'indicator',
    );
  });

  test('抓手必须有补偿底色 —— α=0 的 4px 横条等于没画', async ({ page }) => {
    await open(page);
    const alpha = await page.evaluate(() => {
      const el = document.querySelector('[data-slot="sheet-grabber-fill"]') as HTMLElement;
      const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)!;
      return m.length === 4 ? Number(m[3]) : 1;
    });
    expect(alpha).toBeGreaterThan(0.1);
  });

  test('只有 Tier A 的抓手走 SVG 折射', async ({ page }) => {
    const read = () =>
      page.evaluate(
        () =>
          getComputedStyle(
            document.querySelector('[data-slot="sheet-grabber"] .lg-surface') as HTMLElement,
          ).backdropFilter,
      );
    await open(page, { tier: 'a' });
    expect(await read()).toContain('url(');
    await open(page, { tier: 'b' });
    expect(await read()).not.toContain('url(');
    await open(page, { tier: 'c' });
    expect(await read()).not.toContain('url(');
  });
});

test.describe('档位与手势', () => {
  test('点按抓手在档位间循环（HIG 明确要求）', async ({ page }) => {
    await open(page, { detent: 0 });
    const content = page.locator('[data-slot="sheet-content"]');
    await expect(content).toHaveAttribute('data-detent', '0');

    await page.locator('[data-slot="sheet-grabber"]').click();
    await expect(content).toHaveAttribute('data-detent', '1');
    await settle(page);
    const vp = page.viewportSize()!.height;
    const panel = await panelBox(page);
    expect((vp - 6 - panel.y) / vp).toBeCloseTo(0.94, 2);

    // 两档循环回 0
    await page.locator('[data-slot="sheet-grabber"]').click();
    await expect(content).toHaveAttribute('data-detent', '0');
  });

  test('小幅慢拖后松手 —— 回弹到原档，不关闭', async ({ page }) => {
    await open(page, { detent: 0 });
    const before = (await panelBox(page)).y;
    await dragFrom(page, await grabberPoint(page), 40, { steps: 8, stepDelay: 40 });
    await settle(page);
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(1);
    expect(Math.abs((await panelBox(page)).y - before)).toBeLessThan(2);
  });

  test('慢拖越过阈值 —— 关闭', async ({ page }) => {
    await open(page, { detent: 0 });
    const vp = page.viewportSize()!.height;
    // 阈值是最矮档高度的 40%，这里拖 70% 稳过
    await dragFrom(page, await grabberPoint(page), vp * 0.525 * 0.7, { steps: 12, stepDelay: 40 });
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0, { timeout: 3000 });
  });

  test('小位移 + 高速度 —— 甩动关闭', async ({ browser }) => {
    /**
     * 与上一条**位移在同一量级**、只是快得多 —— 唯一的差别是速度，
     * 所以这条真的在测「速度感应」，不是在测「拖得够远」。
     *
     * ⚠️ 这条**刻意用加高的视口（1400）+ Tier C**，两者都是为了余量：
     *
     *  - 视口：判据「速度 > 500 px/s」与「位移必须小于阈值」是一对矛盾约束，
     *    视口越矮位移上限越小，能塞进去的速度余量就越小。720 下上限只有
     *    151px，两段各 83px，帧间隔被负载拉到 ~170ms 就会误判；
     *    1400 下上限 294px，两段各 118px，帧间隔要超过 260ms 才会误判。
     *  - Tier C：速度是**按帧间隔**算出来的，而并行跑测试时最贵的东西正是
     *    Tier A 的 backdrop-filter + SVG 折射 —— 帧一慢，速度就假性偏低。
     *    甩动判定与渲染路径无关，用最便宜的那条路测它是干净的。
     *
     * （踩过：只加高视口、留在 Tier A，单跑 5×5 全绿，跟在视觉套件后面跑就红。）
     * 手势为什么要在页面内派发，见 fling() 的注释。
     */
    const ctx = await browser.newContext({ viewport: { width: 900, height: 1400 } });
    const page = await ctx.newPage();
    await open(page, { detent: 0, tier: 'c' });
    const threshold = 1400 * 0.525 * MOTION_DISMISS_RATIO;
    await fling(page, await grabberPoint(page), threshold * 0.8, 2);
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0, { timeout: 3000 });
    await ctx.close();
  });

  test('从正文区拖不动面板（默认 dragFrom=handle）', async ({ page }) => {
    await open(page, { detent: 0 });
    const before = (await panelBox(page)).y;
    const body = (await page.locator('[data-slot="sheet-body"]').boundingBox())!;
    await dragFrom(
      page,
      { x: body.x + body.width / 2, y: body.y + 10 },
      200,
      { steps: 6, stepDelay: 20 },
    );
    await settle(page);
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(1);
    expect(Math.abs((await panelBox(page)).y - before)).toBeLessThan(2);
  });

  test('dragFrom="sheet" 时正文区也能拖', async ({ page }) => {
    await open(page, { detent: 0, dragfrom: 'sheet' });
    const vp = page.viewportSize()!.height;
    const body = (await page.locator('[data-slot="sheet-body"]').boundingBox())!;
    await dragFrom(
      page,
      { x: body.x + body.width / 2, y: body.y + 10 },
      vp * 0.525 * 0.7,
      { steps: 12, stepDelay: 40 },
    );
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0, { timeout: 3000 });
  });

  test('不显示抓手时其余部分照常工作', async ({ page }) => {
    await open(page, { nograbber: true });
    await expect(page.locator('[data-slot="sheet-grabber"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(1);
    // 标题栏仍然可以起手拖拽
    const header = (await page.locator('[data-slot="sheet-header"]').boundingBox())!;
    const vp = page.viewportSize()!.height;
    await dragFrom(
      page,
      { x: header.x + 30, y: header.y + header.height / 2 },
      vp * 0.525 * 0.7,
      { steps: 12, stepDelay: 40 },
    );
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0, { timeout: 3000 });
  });
});

test.describe('a11y —— 换了渲染方式也不许退化（PROJECT_SPEC §9）', () => {
  test('role=dialog，标题接进无障碍名称', async ({ page }) => {
    await open(page);
    const dlg = page.getByRole('dialog');
    await expect(dlg).toHaveCount(1);
    await expect(dlg).toHaveAccessibleName('Title');
  });

  test('抓手是真正的 button 且有无障碍名', async ({ page }) => {
    await open(page);
    const g = page.locator('[data-slot="sheet-grabber"]');
    expect(await g.evaluate((el) => el.tagName)).toBe('BUTTON');
    await expect(g).toHaveAttribute('aria-label', /.+/);
  });

  test('Esc 关闭；焦点还给触发器', async ({ page }) => {
    await open(page, { open: false });
    const trigger = page.getByRole('button', { name: '打开面板' });
    await trigger.click();
    await settle(page);
    const inside = await page.evaluate(
      () => !!document.activeElement?.closest('[data-slot="sheet-content"]'),
    );
    expect(inside).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0, { timeout: 3000 });
    await expect(trigger).toBeFocused();
  });

  test('点遮罩关闭', async ({ page }) => {
    await open(page);
    await page.mouse.click(20, 20); // 面板在下半屏，左上角必是遮罩
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0, { timeout: 3000 });
  });

  test('SheetClose 点击即关闭', async ({ page }) => {
    await open(page);
    await page.locator('[data-sheet-close]').click();
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0, { timeout: 3000 });
  });
});

test.describe('层叠后退与降级', () => {
  test('打开时把缩放变量写到 <html>，卸载后收干净', async ({ page }) => {
    await open(page);
    const read = () =>
      page.evaluate(() => ({
        scale: document.documentElement.style.getPropertyValue('--lg-sheet-wrapper-scale'),
        radius: document.documentElement.style.getPropertyValue('--lg-sheet-wrapper-radius'),
      }));
    const opened = await read();
    expect(Number(opened.scale)).toBeLessThan(1);
    expect(opened.radius).toBe('34px');

    // 外壳真的缩了 —— 只查变量会漏掉「变量写了但没有人用」
    const scaled = await page.evaluate(
      () => getComputedStyle(document.querySelector('[data-glass-sheet-wrapper]')!).transform,
    );
    expect(scaled).not.toBe('none');
  });

  test('reduced-motion 下不做层叠后退', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await open(page);
    const scale = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--lg-sheet-wrapper-scale'),
    );
    expect(scale).toBe('');
    await ctx.close();
  });

  test('reduced-transparency 下面板不再模糊、材质压到接近实色', async ({ browser }) => {
    /**
     * Playwright 没有这个偏好的开关，用 CDP 的 Emulation.setEmulatedMedia 塞进去 ——
     * 模拟的是**真的偏好**，Provider 自己读 matchMedia 的那条链路也一起测到了
     * （做 Card 时找到的办法，见 STATUS §0.47）。
     */
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
    });
    await open(page);
    expect(
      await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches),
    ).toBe(true);
    const surf = '[data-slot="sheet-panel"] > .lg-surface';
    expect(await styleOf(page, surf, 'backdrop-filter')).toBe('none');
    const alpha = await page.evaluate((sel) => {
      const m = getComputedStyle(document.querySelector(sel)!).backgroundColor.match(/[\d.]+/g)!;
      return m.length === 4 ? Number(m[3]) : 1;
    }, surf);
    expect(alpha).toBeGreaterThan(0.9);
    await ctx.close();
  });

  test('移动 viewport 下几何照常成立', async ({ browser }) => {
    // Phase 4 的核心场景就是移动端，几何必须在小视口上也对
    const ctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
    const page = await ctx.newPage();
    await open(page, { detent: 0 });
    const content = (await page.locator('[data-slot="sheet-content"]').boundingBox())!;
    expect(Math.round(content.x)).toBe(6);
    expect(Math.round(402 - (content.x + content.width))).toBe(6);
    const panel = (await page
      .locator('[data-slot="sheet-panel"] .lg-surface')
      .first()
      .boundingBox())!;
    // 参考图正是 402×874：medium 档应当露出 459 pt
    expect(Math.round(874 - 6 - panel.y)).toBe(459);
    await ctx.close();
  });
});
