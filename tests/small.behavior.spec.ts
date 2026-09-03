/**
 * Phase 7 第二批（Progress / Badge / Separator / Skeleton / Avatar）的行为回归。
 *
 * 这一批的主线是 PROJECT_SPEC §2「材质属于控件层」：五个组件里**只有 Progress
 * 该有玻璃**，其余四个哪怕看起来「可以加一点」都不加。
 * 所以下面第一组断言就是逐个确认「谁是玻璃、谁不是」——
 * 这是最容易在后续维护中被悄悄破坏的一条。
 *
 * 断言全是确定性事实（DOM、尺寸、a11y 语义、降级分支），不含截图，可进 CI。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/small-demo.html')).href;

async function open(
  page: Page,
  opts: { only?: string; theme?: string; tier?: string; tint?: number; bg?: string } = {},
) {
  const q = new URLSearchParams({
    theme: opts.theme ?? 'light',
    tier: opts.tier ?? 'a',
    tint: String(opts.tint ?? 0.34),
    ...(opts.only ? { only: opts.only } : {}),
    ...(opts.bg ? { bg: opts.bg } : {}),
  });
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

/* ── 分层纪律：谁是玻璃、谁不是 ─────────────────────────────────────── */

test.describe('§2 材质属于控件层', () => {
  test('五个里只有 Progress 的轨道是玻璃', async ({ page }) => {
    await open(page);
    // 只有 progress 那一行里应当出现 .lg-surface
    const inProgress = await page
      .locator('[data-testid="row-progress"] .lg-surface')
      .count();
    expect(inProgress, 'Progress 的轨道必须是 Layer B').toBeGreaterThan(0);

    for (const row of ['badge', 'separator', 'skeleton', 'avatar']) {
      const n = await page.locator(`[data-testid="row-${row}"] .lg-surface`).count();
      expect(n, `${row} 是内容层，不该出现任何一块玻璃`).toBe(0);
    }
  });

  test('Progress 的轨道是 Layer B，**不折射**', async ({ page }) => {
    await open(page, { only: 'progress' });
    const surface = page.locator('.lg-surface[data-layer="base"]').first();
    const backdrop = await surface.evaluate((el) => getComputedStyle(el).backdropFilter);
    // PROJECT_SPEC §15.2：底座绝不折射
    expect(backdrop).not.toContain('url(');
  });
});

/* ── Progress ─────────────────────────────────────────────────────────── */

test.describe('Progress', () => {
  test('确定态：role、valuenow、填充宽度三者一致', async ({ page }) => {
    await open(page, { only: 'progress' });
    const bar = page.getByRole('progressbar', { name: 'p38' });
    await expect(bar).toHaveAttribute('aria-valuenow', '38');
    await expect(bar).toHaveAttribute('aria-valuemax', '100');
    await expect(bar).toHaveAttribute('data-state', 'determinate');

    const track = (await page.locator('.lg-surface').nth(1).boundingBox())!;
    const fill = (await bar.locator('[data-slot="progress-fill"]').boundingBox())!;
    expect(Math.abs(fill.width / track.width - 0.38), '填充宽度要对得上 38%').toBeLessThan(0.02);
  });

  test('不定态：有 role 但**没有 valuenow**', async ({ page }) => {
    /**
     * 这是不定态唯一的无障碍表达方式。填一个假的 0 会让屏幕阅读器念「0%」，
     * 比不说更糟 —— 所以这条断言钉的是「属性不存在」，不是「属性等于某值」。
     */
    await open(page, { only: 'progress' });
    const bar = page.getByRole('progressbar', { name: 'indeterminate' });
    await expect(bar).toHaveAttribute('data-state', 'indeterminate');
    expect(await bar.getAttribute('aria-valuenow')).toBeNull();
    await expect(bar.locator('[data-slot="progress-indeterminate"]')).toHaveCount(1);
  });

  test('越界的 value 被夹住，不会画出轨道', async ({ page }) => {
    await open(page, { only: 'progress' });
    const bar = page.getByRole('progressbar', { name: 'overflow' });
    await expect(bar).toHaveAttribute('aria-valuenow', '100');
    const track = (await bar.boundingBox())!;
    const fill = (await bar.locator('[data-slot="progress-fill"]').boundingBox())!;
    expect(fill.width).toBeLessThanOrEqual(track.width + 1);
  });

  test('轨道高度 6 —— 借自 Slider 的实测值', async ({ page }) => {
    await open(page, { only: 'progress' });
    const box = (await page.locator('.lg-surface').first().boundingBox())!;
    expect(Math.round(box.height)).toBe(6);
  });
});

/* ── Badge ────────────────────────────────────────────────────────────── */

test.describe('Badge', () => {
  test('四个变体的底色互不相同，且都不是透明', async ({ page }) => {
    await open(page, { only: 'badge' });
    const bgs: string[] = [];
    for (const v of ['count', 'neutral', 'accent']) {
      const bg = await page
        .locator(`[data-slot="badge"][data-variant="${v}"]`)
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg, `${v} 应当有底色`).not.toBe('rgba(0, 0, 0, 0)');
      bgs.push(bg);
    }
    expect(new Set(bgs).size, '三个填充变体不能撞色').toBe(3);
    // outline 是唯一一个没有底色的
    const outline = await page
      .locator('[data-slot="badge"][data-variant="outline"]')
      .evaluate((el) => ({
        bg: getComputedStyle(el).backgroundColor,
        shadow: getComputedStyle(el).boxShadow,
      }));
    expect(outline.bg).toBe('rgba(0, 0, 0, 0)');
    expect(outline.shadow, 'outline 靠内描边而不是底色').not.toBe('none');
  });

  test('没有 glass 变体 —— 这是刻意的', async ({ page }) => {
    // 实测：徽章尺寸的玻璃压在平滑底色上 meanΔ 只有 2.8/255（scripts/small-glass.mjs）
    await open(page, { only: 'badge' });
    await expect(page.locator('[data-slot="badge"][data-variant="glass"]')).toHaveCount(0);
  });
});

/* ── Separator ────────────────────────────────────────────────────────── */

test.describe('Separator', () => {
  test('默认是装饰性的 —— role=none，不进无障碍树', async ({ page }) => {
    /**
     * 默认值是刻意选的：绝大多数分隔线只是视觉分组。
     * 给每条都报 role="separator" 会让屏幕阅读器一路念「分隔符」。
     */
    await open(page, { only: 'separator' });
    const first = page.locator('[data-slot="separator"]').first();
    await expect(first).toHaveAttribute('role', 'none');
    expect(await first.getAttribute('aria-orientation')).toBeNull();
  });

  test('decorative={false} 时才有 separator 语义', async ({ page }) => {
    await open(page, { only: 'separator' });
    const semantic = page.getByTestId('semantic-sep');
    await expect(semantic).toHaveAttribute('role', 'separator');
    await expect(semantic).toHaveAttribute('aria-orientation', 'horizontal');
  });

  test('厚度 1px，竖向时换到宽度上', async ({ page }) => {
    await open(page, { only: 'separator' });
    const h = (await page.locator('[data-slot="separator"]').first().boundingBox())!;
    expect(Math.round(h.height)).toBe(1);
    const v = (await page.getByTestId('vertical-sep').boundingBox())!;
    expect(Math.round(v.width)).toBe(1);
    expect(v.height, '竖向分隔线要撑满容器高度').toBeGreaterThan(1);
  });

  test('用的是通用分隔线色，不是分组列表那条', async ({ page }) => {
    // 两个颜色刻意不合并，见组件头部；这条钉住别把它们改成同一个
    await open(page, { only: 'separator' });
    const bg = await page
      .locator('[data-slot="separator"]')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    const tokens = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        general: cs.getPropertyValue('--lg-separator').trim(),
        list: cs.getPropertyValue('--lg-list-separator').trim(),
      };
    });
    expect(tokens.general).not.toBe(tokens.list);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  });
});

/* ── Skeleton ─────────────────────────────────────────────────────────── */

test.describe('Skeleton', () => {
  test('骨架块自己对辅助技术隐藏', async ({ page }) => {
    // 一堆没有内容的方块对屏幕阅读器是噪音；「正在加载」由容器的 aria-busy 承担
    await open(page, { only: 'skeleton' });
    const blocks = page.locator('[data-slot="skeleton"]');
    await expect(blocks).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(blocks.nth(i)).toHaveAttribute('aria-hidden', 'true');
    }
    await expect(page.getByTestId('row-skeleton')).toHaveAttribute('aria-busy', 'true');
  });

  test('默认有微光层', async ({ page }) => {
    await open(page, { only: 'skeleton' });
    await expect(page.locator('[data-slot="skeleton-shimmer"]').first()).toHaveCount(1);
    await expect(page.locator('[data-slot="skeleton"]').first()).toHaveAttribute(
      'data-animated',
      'true',
    );
  });

  test('reduced-motion 下**根本不渲染**微光层', async ({ page }) => {
    /**
     * 不是「把动画时长调短」，是整层不渲染 —— 闪烁的骨架屏是前庭不适的经典诱因，
     * 而它传达的信息完全可以由静止的灰块 + aria-busy 承担。
     */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, { only: 'skeleton' });
    await expect(page.locator('[data-slot="skeleton-shimmer"]')).toHaveCount(0);
    expect(
      await page.locator('[data-slot="skeleton"]').first().getAttribute('data-animated'),
    ).toBeNull();
  });
});

/* ── Avatar ───────────────────────────────────────────────────────────── */

test.describe('Avatar', () => {
  test('图能加载时显示图', async ({ page }) => {
    await open(page, { only: 'avatar' });
    const img = page.locator('[data-slot="avatar-image"]');
    await expect(img.first()).toBeVisible();
    await expect(img.first()).toHaveAttribute('alt', '有图');
  });

  test('图挂了要回退到首字母，不留破图标', async ({ page }) => {
    await open(page, { only: 'avatar' });
    const fallbacks = page.locator('[data-slot="avatar-fallback"]');
    // 「会挂的图」与「没有图」与「匿名」三个都走 fallback
    await expect(fallbacks).toHaveCount(3);
    await expect(page.getByRole('img', { name: '会挂的图' })).toBeVisible();
  });

  test('换 src 之后「加载失败」要被清掉', async ({ page }) => {
    /**
     * 只加不清是这类实现最常见的漏洞：第一张图失败之后，
     * 后面换成好图也显示不出来 —— 而且不会报错，只是一直显示首字母。
     */
    await open(page, { only: 'avatar' });
    await expect(page.locator('[data-slot="avatar-image"]')).toHaveCount(1);
    await page.getByTestId('fix-src').click();
    await expect(page.locator('[data-slot="avatar-image"]')).toHaveCount(2);
    // 再换回坏图，要能重新回退
    await page.getByTestId('break-src').click();
    await expect(page.locator('[data-slot="avatar-image"]')).toHaveCount(1);
  });

  test('既没 alt 也没 fallback 的头像整个对辅助技术隐藏', async ({ page }) => {
    await open(page, { only: 'avatar' });
    const anon = page.getByTestId('anonymous-avatar').locator('[data-slot="avatar-fallback"]');
    await expect(anon).toHaveAttribute('aria-hidden', 'true');
    expect(await anon.getAttribute('role')).toBeNull();
  });

  test('尺寸变化时首字母字号跟着缩放', async ({ page }) => {
    await open(page, { only: 'avatar' });
    const size = await page
      .getByRole('img', { name: '没有图' })
      .evaluate((el) => getComputedStyle(el).fontSize);
    // 40 × 0.4 = 16
    expect(size).toBe('16px');
  });
});
