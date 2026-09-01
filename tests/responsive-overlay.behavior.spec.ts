/**
 * `<ResponsiveOverlay>` —— PROJECT_SPEC §9 的核心原语。
 *
 *   「所有『从触发点弹出浮层』的组件，在移动端**必须**改为从底部滑出的 Drawer。
 *     外部调用方式完全一致，切换对使用者透明。
 *     无障碍不能因为换了渲染方式而退化。」
 *
 * 这份测试要证明三件事：
 *   1. 判定规则真的是 `(max-width: 768px) || (pointer: coarse)` —— **两条都要**；
 *   2. 两条路径的**无障碍行为等价**（可访问名称、Esc、焦点还原、aria-expanded）；
 *   3. `responsive={false}` 的逃生口有效。
 */

import { test, expect, type Page, type Browser } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/overlay-demo.html')).href;

async function open(page: Page, opts: { open?: boolean; responsive?: boolean } = {}) {
  const q = new URLSearchParams({
    theme: 'light',
    tier: 'a',
    tint: '0.34',
    only: 'responsive',
  });
  if (opts.open !== false) q.set('open', '1');
  if (opts.responsive === false) q.set('responsive', '0');
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  if (opts.open !== false) await page.waitForTimeout(600); // 两条路径的入场 spring 都等得起
}

/** 当前实际走的是哪条路径 —— 按渲染出来的东西判断，不看内部状态 */
async function pathOf(page: Page): Promise<'popover' | 'sheet' | 'none'> {
  if ((await page.locator('[data-slot="popover-content"]').count()) > 0) return 'popover';
  if ((await page.locator('[data-slot="sheet-content"]').count()) > 0) return 'sheet';
  return 'none';
}

const DESKTOP = { width: 1280, height: 800 } as const;
/** 768 是 SPEC 写死的分界；402×874 是参考图那块屏 */
const COMPACT = { width: 402, height: 874 } as const;

async function withContext(
  browser: Browser,
  options: Parameters<Browser['newContext']>[0],
  fn: (page: Page) => Promise<void>,
) {
  const ctx = await browser.newContext(options);
  const page = await ctx.newPage();
  try {
    await fn(page);
  } finally {
    await ctx.close();
  }
}

test.describe('判定 —— SPEC §9 的两条规则都要生效', () => {
  test('宽视口 + 细指针 → 桌面浮层', async ({ browser }) => {
    await withContext(browser, { viewport: DESKTOP }, async (page) => {
      await open(page);
      expect(await pathOf(page)).toBe('popover');
    });
  });

  test('窄视口 → 底部 Drawer', async ({ browser }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page);
      expect(await pathOf(page)).toBe('sheet');
    });
  });

  test('宽视口但**粗指针** → 仍然是 Drawer', async ({ browser }) => {
    /**
     * 这条是 `||` 里的第二个条件。只看宽度的话，触屏笔记本 / 平板横屏
     * 会拿到一个需要精确点击的小浮层 —— SPEC 特意把两条都写上了。
     */
    await withContext(browser, { viewport: DESKTOP, hasTouch: true }, async (page) => {
      const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
      test.skip(!coarse, '这个 Chromium 下 hasTouch 没有让 pointer:coarse 生效');
      await open(page);
      expect(await pathOf(page)).toBe('sheet');
    });
  });

  test('responsive={false} 是逃生口 —— 窄视口下也留在桌面路径', async ({ browser }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page, { responsive: false });
      expect(await pathOf(page)).toBe('popover');
    });
  });
});

test.describe('无障碍 —— 换了渲染方式也不许退化', () => {
  test('两条路径的可访问名称一致', async ({ browser }) => {
    const names: string[] = [];
    for (const viewport of [DESKTOP, COMPACT]) {
      await withContext(browser, { viewport }, async (page) => {
        await open(page);
        const el = page.locator('[data-responsive-overlay="content"]');
        await expect(el).toHaveCount(1);
        names.push(await el.evaluate((n) => n.getAttribute('aria-label') ?? ''));
      });
    }
    // 桌面走 aria-label；移动走 SheetTitle，名称由 Radix 的 aria-labelledby 接
    expect(names[0]).toBe('编辑菜单');
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page);
      await expect(page.getByRole('dialog')).toHaveAccessibleName('编辑菜单');
    });
  });

  test('两条路径都能 Esc 关闭，且焦点还给触发器', async ({ browser }) => {
    for (const viewport of [DESKTOP, COMPACT]) {
      await withContext(browser, { viewport }, async (page) => {
        await open(page, { open: false });
        const trigger = page.getByRole('button', { name: '打开自适应浮层' });
        await trigger.click();
        await page.waitForTimeout(500);
        expect(await pathOf(page)).not.toBe('none');
        await page.keyboard.press('Escape');
        await expect(page.locator('[data-responsive-overlay="content"]')).toHaveCount(0, {
          timeout: 3000,
        });
        await expect(trigger).toBeFocused();
      });
    }
  });

  test('两条路径的触发器都带 aria-expanded 且跟随开关', async ({ browser }) => {
    for (const viewport of [DESKTOP, COMPACT]) {
      await withContext(browser, { viewport }, async (page) => {
        await open(page, { open: false });
        const trigger = page.getByRole('button', { name: '打开自适应浮层' });
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await trigger.click();
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });
    }
  });

  test('触发器带 data-slot，两条路径下都在', async ({ browser }) => {
    for (const viewport of [DESKTOP, COMPACT]) {
      await withContext(browser, { viewport }, async (page) => {
        await open(page, { open: false });
        await expect(page.locator('[data-slot="responsive-overlay-trigger"]')).toHaveCount(1);
      });
    }
  });
});

test.describe('两条路径各自的形态', () => {
  test('桌面：锚在触发器下方，宽 250', async ({ browser }) => {
    await withContext(browser, { viewport: DESKTOP }, async (page) => {
      await open(page);
      const trigger = (await page.getByRole('button', { name: '打开自适应浮层' }).boundingBox())!;
      const panel = (await page
        .locator('[data-slot="popover-content"] .lg-surface')
        .boundingBox())!;
      expect(Math.round(panel.width)).toBe(250);
      expect(panel.y).toBeGreaterThan(trigger.y);
    });
  });

  test('移动：底部 Drawer，左右各 6，标题可见，内容在正文区里', async ({ browser }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page);
      const content = (await page.locator('[data-slot="sheet-content"]').boundingBox())!;
      expect(Math.round(content.x)).toBe(6);
      expect(Math.round(COMPACT.width - (content.x + content.width))).toBe(6);
      await expect(page.locator('[data-slot="sheet-title"]')).toHaveText('编辑菜单');
      await expect(page.locator('[data-slot="sheet-body"] [data-testid="overlay-items"]')).toHaveCount(
        1,
      );
      // 抓手在 —— Drawer 的下滑关闭提示不能因为是「浮层的移动端形态」就省掉
      await expect(page.locator('[data-slot="sheet-grabber"]')).toHaveCount(1);
    });
  });

  test('同一段 children 在两条路径下都渲染出来了', async ({ browser }) => {
    for (const viewport of [DESKTOP, COMPACT]) {
      await withContext(browser, { viewport }, async (page) => {
        await open(page);
        await expect(page.getByRole('button', { name: 'Paste' })).toHaveCount(1);
      });
    }
  });
});
