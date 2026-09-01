/**
 * Slider / Switch 的行为与几何回归。
 *
 * 与 tabs.behavior.spec.ts 同样的原则：这里只断言**确定性事实**
 * （尺寸、DOM 结构、a11y 语义、降级分支），不含截图，任何平台跑结果都一样。
 *
 * 几何基准来自 iOS 27 官方设计资源（docs/research/apple-metrics.md §7.3 / §7.4）：
 *   Slider  轨道 250×6、knob 38×24
 *   Switch  轨道 64×28、knob 38×24、内缩 2、行程 22
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/controls-demo.html')).href;

async function open(
  page: Page,
  opts: {
    theme?: string;
    tier?: string;
    tint?: number;
    only?: string;
    knob?: number;
    size?: number;
  } = {},
) {
  const q = new URLSearchParams({
    theme: opts.theme ?? 'light',
    tier: opts.tier ?? 'a',
    tint: String(opts.tint ?? 0.34),
  });
  if (opts.only) q.set('only', opts.only);
  if (opts.knob) q.set('knob', String(opts.knob));
  if (opts.size) q.set('size', String(opts.size));
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  // 等合成完成，避免量到中间态
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

const box = async (page: Page, selector: string, nth = 0) => {
  const b = await page.locator(selector).nth(nth).boundingBox();
  if (!b) throw new Error(`元素没有布局盒：${selector}`);
  return b;
};

const backdropOf = (page: Page, selector: string, nth = 0) =>
  page.evaluate(
    ([s, i]) => {
      const el = document.querySelectorAll(s as string)[i as number] as HTMLElement;
      return getComputedStyle(el).backdropFilter;
    },
    [selector, nth] as const,
  );

/* ══════════════════════════════════════════════════════════════════════
   Slider
   ══════════════════════════════════════════════════════════════════════ */

test.describe('Slider · 几何 —— 对齐 iOS 27 实测值', () => {
  test('轨道 250×6、knob 38×24', async ({ page }) => {
    await open(page, { only: 'slider' });
    const track = await box(page, '[data-slot="slider-track"]');
    const thumb = await box(page, '[data-slot="slider-thumb"]');
    // 验证台把容器锁成 250，正好对上 iOS 的轨道宽度
    expect(Math.round(track.width)).toBe(250);
    expect(Math.round(track.height)).toBe(6);
    expect(Math.round(thumb.width)).toBe(38);
    expect(Math.round(thumb.height)).toBe(24);
  });

  test('触控高度撑到 44 —— 轨道 6pt 够不到 HIG 的 44pt', async ({ page }) => {
    await open(page, { only: 'slider' });
    const root = await box(page, '[data-slot="slider"]');
    expect(root.height).toBeGreaterThanOrEqual(44);
  });

  test('几何按 knobSize 成比例缩放', async ({ page }) => {
    // knob 高 12 = 默认的一半 → 轨道高 3、knob 宽 19
    await open(page, { only: 'slider', knob: 12 });
    const track = await box(page, '[data-slot="slider-track"]');
    const thumb = await box(page, '[data-slot="slider-thumb"]');
    expect(Math.round(track.height)).toBe(3);
    expect(Math.round(thumb.height)).toBe(12);
    expect(Math.round(thumb.width)).toBe(19);
  });

  test('已填充段的宽度等于当前值的占比', async ({ page }) => {
    await open(page, { only: 'slider' });
    const track = await box(page, '[data-slot="slider-track"]');
    const range = await box(page, '[data-slot="slider-range"]');
    // 验证台的默认值是 40（min 0 / max 100）
    expect(Math.round(range.width)).toBe(Math.round(track.width * 0.4));
    // 已填充段必须真的有高度 —— 这里踩过坑：底座若没定位好，
    // Range 的 inset-y-0 会撑在 0 高的容器上，量出来是 250×0。
    expect(Math.round(range.height)).toBe(Math.round(track.height));
  });
});

test.describe('Slider · 分层（PROJECT_SPEC §2 / §15.2）', () => {
  test('轨道是 Layer B 且绝不折射，knob 是 Layer I', async ({ page }) => {
    await open(page, { only: 'slider' });
    const track = page.locator('[data-slot="slider-track"] .lg-surface');
    await expect(track).toHaveAttribute('data-layer', 'base');
    const knob = page.locator('[data-slot="slider-thumb"] .lg-surface');
    await expect(knob).toHaveAttribute('data-layer', 'indicator');
    // 底座禁用 feDisplacementMap —— backdrop-filter 里不能出现 url()
    expect(await backdropOf(page, '[data-slot="slider-track"] .lg-surface')).not.toContain('url(');
  });

  test('只有 Tier A 的 knob 走 SVG 折射', async ({ page }) => {
    const sel = '[data-slot="slider-thumb"] .lg-surface';
    await open(page, { only: 'slider', tier: 'a' });
    expect(await backdropOf(page, sel)).toContain('url(');
    await open(page, { only: 'slider', tier: 'b' });
    expect(await backdropOf(page, sel)).not.toContain('url(');
    await open(page, { only: 'slider', tier: 'c' });
    expect(await backdropOf(page, sel)).not.toContain('url(');
  });
});

test.describe('Slider · 交互态（PROJECT_SPEC §14）', () => {
  test('按下时 knob 进入 pressed，松手回落', async ({ page }) => {
    await open(page, { only: 'slider' });
    const knob = page.locator('[data-slot="slider-thumb"] .lg-surface');
    await expect(knob).not.toHaveAttribute('data-pressed', 'true');

    const b = await box(page, '[data-slot="slider-thumb"]');
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect(knob).toHaveAttribute('data-pressed', 'true');
    await page.mouse.up();
    await expect(knob).not.toHaveAttribute('data-pressed', 'true');
  });

  test('从轨道任意处按下也算拖动 —— Radix 会让 knob 跟过来', async ({ page }) => {
    await open(page, { only: 'slider' });
    const knob = page.locator('[data-slot="slider-thumb"] .lg-surface');
    const track = await box(page, '[data-slot="slider-track"]');
    await page.mouse.move(track.x + track.width * 0.8, track.y + track.height / 2);
    await page.mouse.down();
    await expect(knob).toHaveAttribute('data-pressed', 'true');
    await page.mouse.up();
  });

  test('键盘可达：方向键改值', async ({ page }) => {
    await open(page, { only: 'slider' });
    const thumb = page.locator('[data-slot="slider-thumb"]');
    await thumb.focus();
    await expect(thumb).toHaveAttribute('aria-valuenow', '40');
    await page.keyboard.press('ArrowRight');
    await expect(thumb).toHaveAttribute('aria-valuenow', '41');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(thumb).toHaveAttribute('aria-valuenow', '39');
  });

  test('a11y：slider 语义与取值范围齐全', async ({ page }) => {
    await open(page, { only: 'slider' });
    const s = page.getByRole('slider');
    await expect(s).toHaveCount(1);
    await expect(s).toHaveAttribute('aria-valuemin', '0');
    await expect(s).toHaveAttribute('aria-valuemax', '100');
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Switch
   ══════════════════════════════════════════════════════════════════════ */

test.describe('Switch · 几何 —— 对齐 iOS 27 实测值', () => {
  test('轨道 64×28、knob 38×24、内缩 2', async ({ page }) => {
    await open(page, { only: 'switch' });
    const root = await box(page, '[data-slot="switch"]');
    const knob = await box(page, '[data-slot="switch"] .lg-surface[data-layer="indicator"]');
    expect(Math.round(root.width)).toBe(64);
    expect(Math.round(root.height)).toBe(28);
    expect(Math.round(knob.width)).toBe(38);
    expect(Math.round(knob.height)).toBe(24);
    expect(Math.round(knob.x - root.x)).toBe(2);
    expect(Math.round(knob.y - root.y)).toBe(2);
  });

  test('行程 22 —— 开启态 knob 的 x 偏移', async ({ page }) => {
    await open(page, { only: 'switch' });
    const off = await box(page, '[data-slot="switch"]', 0);
    const offKnob = await box(page, '[data-slot="switch"] .lg-surface[data-layer="indicator"]', 0);
    // 第二个开关是 defaultChecked
    const on = await box(page, '[data-slot="switch"]', 1);
    const onKnob = await box(page, '[data-slot="switch"] .lg-surface[data-layer="indicator"]', 1);
    expect(Math.round(offKnob.x - off.x)).toBe(2);
    expect(Math.round(onKnob.x - on.x)).toBe(24); // 内缩 2 + 行程 22
  });

  test('几何按 size 成比例缩放', async ({ page }) => {
    // 轨道高 14 = 默认的一半 → 轨道宽 32、knob 19×12、内缩 1
    await open(page, { only: 'switch', size: 14 });
    const root = await box(page, '[data-slot="switch"]', 0);
    const knob = await box(page, '[data-slot="switch"] .lg-surface[data-layer="indicator"]', 0);
    expect(Math.round(root.width)).toBe(32);
    expect(Math.round(root.height)).toBe(14);
    expect(Math.round(knob.width)).toBe(19);
    expect(Math.round(knob.height)).toBe(12);
  });

  test('触控目标撑到 44 —— 轨道 28pt 够不到 HIG 的 44pt', async ({ page }) => {
    await open(page, { only: 'switch' });
    const hit = await box(page, '[data-slot="switch-hit-area"]', 0);
    expect(Math.round(hit.height)).toBe(44);
  });
});

test.describe('Switch · 挖洞 —— knob 必须看到未被轨道模糊的背景', () => {
  test('Tier A/B 挖洞，Tier C 不需要', async ({ page }) => {
    for (const tier of ['a', 'b']) {
      await open(page, { only: 'switch', tier });
      await expect(
        page.locator('[data-slot="switch"] .lg-surface[data-layer="base"]').first(),
      ).toHaveAttribute('data-punched', 'true');
      await expect(page.locator('.lg-punch-layer').first()).toBeVisible();
    }
    await open(page, { only: 'switch', tier: 'c' });
    await expect(page.locator('.lg-punch-layer').first()).toBeHidden();
  });

  test('洞跟着 knob 走', async ({ page }) => {
    await open(page, { only: 'switch' });
    const readHole = () =>
      page.evaluate(() => {
        const el = document.querySelector('.lg-punch-layer') as HTMLElement;
        return getComputedStyle(el).clipPath;
      });
    const before = await readHole();
    await page.getByRole('switch').first().click();
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

test.describe('Switch · a11y 与交互态', () => {
  test('role=switch，aria-checked 跟随状态', async ({ page }) => {
    await open(page, { only: 'switch' });
    const s = page.getByRole('switch').first();
    await expect(s).toHaveAttribute('aria-checked', 'false');
    await s.click();
    await expect(s).toHaveAttribute('aria-checked', 'true');
  });

  test('键盘可切换（空格）', async ({ page }) => {
    await open(page, { only: 'switch' });
    const s = page.getByRole('switch').first();
    await s.focus();
    await page.keyboard.press('Space');
    await expect(s).toHaveAttribute('aria-checked', 'true');
  });

  test('disabled 不可切换', async ({ page }) => {
    await open(page, { only: 'switch' });
    const s = page.getByRole('switch').nth(2);
    await expect(s).toBeDisabled();
    await s.click({ force: true });
    await expect(s).toHaveAttribute('aria-checked', 'false');
  });

  test('按下时 knob 进入 pressed', async ({ page }) => {
    await open(page, { only: 'switch' });
    const knob = page
      .locator('[data-slot="switch"] .lg-surface[data-layer="indicator"]')
      .first();
    const b = await box(page, '[data-slot="switch"]', 0);
    await page.mouse.move(b.x + 10, b.y + b.height / 2);
    await page.mouse.down();
    await expect(knob).toHaveAttribute('data-pressed', 'true');
    await page.mouse.up();
    await expect(knob).not.toHaveAttribute('data-pressed', 'true');
  });

  test('装饰层不进无障碍树', async ({ page }) => {
    await open(page, { only: 'switch' });
    // 着色层与命中区都是纯装饰，必须 aria-hidden
    for (const slot of ['switch-fill', 'switch-hit-area']) {
      await expect(page.locator(`[data-slot="${slot}"]`).first()).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    }
  });
});

test.describe('无障碍偏好降级（PROJECT_SPEC §13）', () => {
  /**
   * 与 Tabs 那组同一套判据：测的是「切换后多久静止」，不是「有没有位移」。
   * knob 总会移动，差别在于**用多久**。SPEC §13 给的上限是 120ms。
   */
  async function travelAfter(page: Page, ms: number) {
    await page.getByRole('switch').first().click();
    await page.waitForTimeout(ms);
    const mid = (await box(page, '[data-slot="switch"] .lg-surface[data-layer="indicator"]', 0)).x;
    await page.waitForTimeout(700); // 足够任何 spring 静止
    const settled = (await box(page, '[data-slot="switch"] .lg-surface[data-layer="indicator"]', 0))
      .x;
    return Math.abs(settled - mid);
  }

  test('reduced-motion 下 150ms 内已静止', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await open(page, { only: 'switch' });
    expect(await travelAfter(page, 150)).toBeLessThan(1);
    await ctx.close();
  });

  /**
   * 反向对照 —— 没有这一条，上面那个测试可能只是因为「动画本来就很快」而通过。
   */
  test('正常动效下 150ms 时仍在移动（证明上条有区分力）', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    await open(page, { only: 'switch' });
    expect(await travelAfter(page, 150)).toBeGreaterThan(1);
    await ctx.close();
  });
});
