/**
 * DropdownMenu 的行为与几何回归。
 *
 * 几何基准来自 iOS 27 官方设计资源的 Edit Menu（节点 12740:24185，
 * 见 apple-metrics §7.7）：面板 250、内边距 10/16、项高 40、
 * 分隔区 21（1pt 线在区顶 +2、左右各再内缩 8）。
 *
 * ⚠️ 面板圆角 22 是**推定值**（拟合不收敛，见 popover.tsx 文件头）；
 *    这里断言它是为了钉住实现不漂。
 *
 * 这份测试最要紧的两组：
 *   1. **Layer I 终于有地方落了** —— 高亮项是 indicator，且面板要为它挖洞；
 *   2. **两条路径的实现不对称**（桌面 Radix / 移动自接线），所以两边都要测，
 *      而且要把「移动端少了 typeahead」这件事**测出来**，不假装等价。
 */

import { test, expect, type Page, type Browser } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/overlay-demo.html')).href;

const DESKTOP = { width: 1280, height: 800 } as const;
const COMPACT = { width: 402, height: 874 } as const;

async function open(
  page: Page,
  opts: { only?: string; open?: boolean; responsive?: boolean; tier?: string; theme?: string } = {},
) {
  const q = new URLSearchParams({
    theme: opts.theme ?? 'light',
    tier: opts.tier ?? 'a',
    tint: '0.34',
    only: opts.only ?? 'dropdown',
  });
  if (opts.open !== false) q.set('open', '1');
  if (opts.responsive === false) q.set('responsive', '0');
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  if (opts.open !== false) await page.waitForTimeout(500);
}

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

const PANEL = '[data-slot="dropdown-menu-content"] .lg-surface[data-layer="elevated"]';

const styleOf = (p: Page, sel: string, prop: string) =>
  p.evaluate(
    ([s, k]) => getComputedStyle(document.querySelector(s as string)!).getPropertyValue(k as string),
    [sel, prop] as const,
  );

test.describe('几何 —— 对齐 iOS 27 Edit Menu 的实测值', () => {
  test('面板 250 宽、内边距 10 / 16、圆角 34', async ({ browser }) => {
    await withContext(browser, { viewport: DESKTOP }, async (page) => {
      await open(page);
      const b = (await page.locator(PANEL).boundingBox())!;
      expect(Math.round(b.width)).toBe(250);
      expect(await styleOf(page, PANEL, 'padding-top')).toBe('10px');
      expect(await styleOf(page, PANEL, 'padding-left')).toBe('16px');
      /*
       * ⚠️ 2026-09-04：22 → **34**。原值是推定的（当年渲染图圆弧拟合不收敛，
       * 退而取 --lg-radius-lg）。这次直接读节点属性 —— 还是当年那个节点
       * 12740:24185，它内部两层材质都写着 cornerRadius: 34。
       * iOS Context Menu 的面板同样是 34，两处独立印证。
       */
      expect(await styleOf(page, PANEL, 'border-radius')).toBe('34px');
    });
  });

  test('菜单项 218 宽、最小高 40', async ({ browser }) => {
    await withContext(browser, { viewport: DESKTOP }, async (page) => {
      await open(page);
      const item = (await page.locator('[data-slot="dropdown-menu-item"]').first().boundingBox())!;
      expect(Math.round(item.width)).toBe(218); // 250 − 2×16
      expect(Math.round(item.height)).toBe(40);
    });
  });

  test('分隔区 21 高，线在区顶 +2、面板内共内缩 24', async ({ browser }) => {
    await withContext(browser, { viewport: DESKTOP }, async (page) => {
      await open(page);
      const sep = page.locator('[data-slot="dropdown-menu-separator"]');
      await expect(sep).toHaveCount(1);
      const geo = await page.evaluate(
        ([panelSel]) => {
          const panel = document.querySelector(panelSel as string)!.getBoundingClientRect();
          const zone = document
            .querySelector('[data-slot="dropdown-menu-separator"]')!
            .getBoundingClientRect();
          const line = document
            .querySelector('[data-slot="dropdown-menu-separator"] > span')!
            .getBoundingClientRect();
          return {
            zoneHeight: Math.round(zone.height),
            offset: Math.round(line.top - zone.top),
            left: Math.round(line.left - panel.left),
            right: Math.round(panel.right - line.right),
            thickness: Math.round(line.height),
          };
        },
        [PANEL],
      );
      expect(geo).toEqual({ zoneHeight: 21, offset: 2, left: 24, right: 24, thickness: 1 });
    });
  });
});

test.describe('分层 —— Layer I 终于有地方落了', () => {
  test('面板是 elevated；高亮项是 indicator', async ({ browser }) => {
    await withContext(browser, { viewport: DESKTOP }, async (page) => {
      await open(page);
      await expect(page.locator(PANEL)).toHaveCount(1);
      // 每个项都带着自己的 Layer I 面（靠 opacity 显隐，避免高亮切换时重建滤镜）
      const indicators = page.locator(
        '[data-slot="dropdown-menu-item-highlight"] .lg-surface[data-layer="indicator"]',
      );
      expect(await indicators.count()).toBeGreaterThan(0);
    });
  });

  test('高亮项的 Layer I 只在高亮时可见', async ({ browser }) => {
    await withContext(browser, { viewport: DESKTOP }, async (page) => {
      await open(page);
      const opacityOf = (nth: number) =>
        page.evaluate(
          (n) =>
            Number(
              getComputedStyle(
                document.querySelectorAll('[data-slot="dropdown-menu-item-highlight"]')[n]!,
              ).opacity,
            ),
          nth,
        );
      expect(await opacityOf(0)).toBe(0);
      await page.locator('[data-slot="dropdown-menu-item"]').first().hover();
      await page.waitForFunction(() => {
        const el = document.querySelector(
          '[data-slot="dropdown-menu-item-highlight"]',
        ) as HTMLElement;
        return Number(getComputedStyle(el).opacity) > 0.9;
      });
    });
  });

  test('面板为高亮项挖洞 —— 不挖的话折射看到的是被面板模糊过的背景', async ({ browser }) => {
    await withContext(browser, { viewport: DESKTOP }, async (page) => {
      await open(page);
      // 静止时没有高亮项 → 不挖
      await expect(page.locator(PANEL)).not.toHaveAttribute('data-punched', 'true');
      await page.locator('[data-slot="dropdown-menu-item"]').first().hover();
      await expect(page.locator(PANEL)).toHaveAttribute('data-punched', 'true');
      await expect(page.locator('.lg-punch-layer')).toHaveCount(1);

      // 洞要跟着高亮项走：换一项之后洞的位置必须变
      //
      // ⚠️ 读取要能容忍「洞暂时不在」：换项的一瞬间 Radix 先摘旧项、再挂新项，
      // 中间有一帧谁都没高亮。组件那边已经把清洞推迟了一帧，但读的时候仍然
      // 不该假设元素一定在（CI 上就是在这里 getComputedStyle(null) 炸的）。
      const clipOf = () =>
        page.evaluate(() => {
          const el = document.querySelector('.lg-punch-layer');
          return el ? getComputedStyle(el).clipPath : null;
        });
      const first = await clipOf();
      await page.locator('[data-slot="dropdown-menu-item"]').nth(1).hover();
      await expect.poll(clipOf).not.toBe(first);
    });
  });

  test('只有 Tier A 的高亮项走 SVG 折射', async ({ browser }) => {
    for (const [tier, expected] of [
      ['a', true],
      ['b', false],
      ['c', false],
    ] as const) {
      await withContext(browser, { viewport: DESKTOP }, async (page) => {
        await open(page, { tier });
        const f = await page.evaluate(
          () =>
            getComputedStyle(
              document.querySelector(
                '[data-slot="dropdown-menu-item-highlight"] .lg-surface',
              ) as HTMLElement,
            ).backdropFilter,
        );
        expect(f.includes('url('), `tier ${tier}`).toBe(expected);
      });
    }
  });
});

test.describe('桌面路径 —— a11y 由 Radix 负责', () => {
  test('role=menu / menuitem，菜单由**触发器**命名（WAI-ARIA 的 menu 模式）', async ({
    browser,
  }) => {
    /**
     * ⚠️ 这里与移动路径**不一样**，而且是对的：
     * Radix 把 `aria-labelledby` 指向触发器 —— WAI-ARIA 的 menu 模式就是
     * 「菜单由打开它的按钮命名」。移动路径走的是 Radix Dialog，它要求必须有
     * 可见 Title，于是名称是 Drawer 的标题。
     * 两条路径各自正确，但名称不同 —— 与「模态性差异」是同一类事。
     */
    await withContext(browser, { viewport: DESKTOP }, async (page) => {
      await open(page);
      await expect(page.getByRole('menu')).toHaveCount(1);
      await expect(page.getByRole('menu')).toHaveAccessibleName('打开菜单');
      expect(await page.getByRole('menuitem').count()).toBeGreaterThan(2);
    });
  });

  test('方向键在项之间移动，且跳过 disabled 项', async ({ browser }) => {
    await withContext(browser, { viewport: DESKTOP }, async (page) => {
      await open(page);
      await page.keyboard.press('ArrowDown');
      await expect(page.getByRole('menuitem', { name: 'Cut' })).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(page.getByRole('menuitem', { name: 'Copy' })).toBeFocused();
      // Paste 是 disabled，应当被跳过
      await page.keyboard.press('ArrowDown');
      await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
    });
  });

  test('选中后菜单关闭；Esc 关闭并把焦点还给触发器', async ({ browser }) => {
    await withContext(browser, { viewport: DESKTOP }, async (page) => {
      await open(page);
      await page.getByRole('menuitem', { name: 'Cut' }).click();
      await expect(page.locator('[data-dropdown-menu="content"]')).toHaveCount(0);

      await open(page, { open: false });
      const trigger = page.getByRole('button', { name: '打开菜单' });
      await trigger.click();
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-dropdown-menu="content"]')).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  });

  test('破坏性项用 AA 安全的红，不是裸的 systemRed', async ({ browser }) => {
    await withContext(browser, { viewport: DESKTOP }, async (page) => {
      await open(page);
      const color = await page.evaluate(
        () =>
          getComputedStyle(
            [...document.querySelectorAll('[data-slot="dropdown-menu-item"]')].at(-1)!,
          ).color,
      );
      // --lg-on-glass-red = #771c16（deriveOnGlassLabel 解出来的），不是 #ff3b30
      expect(color).toBe('rgb(119, 28, 22)');
    });
  });
});

test.describe('移动路径 —— 底部 Drawer，线是我们自己接的', () => {
  test('窄视口 → Drawer，role=menu 落在正文区里', async ({ browser }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page);
      await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(1);
      await expect(page.locator('[data-slot="dropdown-menu-content"]')).toHaveCount(0);
      await expect(page.locator('[data-slot="sheet-body"] [role="menu"]')).toHaveCount(1);
      await expect(page.locator('[data-slot="sheet-title"]')).toHaveText('编辑菜单');
    });
  });

  test('移动路径的菜单由 Drawer 标题命名（与桌面**不同**，两边各自正确）', async ({
    browser,
  }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page);
      await expect(page.getByRole('menu')).toHaveAccessibleName('编辑菜单');
      // 而桌面那条是「打开菜单」（触发器的文字）—— 见桌面组里的同名断言
    });
  });

  test('方向键导航（我们自己写的）—— ↓ ↑ Home End，跳过 disabled', async ({ browser }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page);
      const menu = page.locator('[role="menu"]');
      await menu.locator('[role="menuitem"]').first().focus();
      await page.keyboard.press('ArrowDown');
      await expect(page.getByRole('menuitem', { name: 'Copy' })).toBeFocused();
      // Paste 是 disabled，跳过
      await page.keyboard.press('ArrowDown');
      await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
      await page.keyboard.press('Home');
      await expect(page.getByRole('menuitem', { name: 'Cut' })).toBeFocused();
      await page.keyboard.press('End');
      await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
      // ↑ 从头部绕回尾部
      await page.keyboard.press('Home');
      await page.keyboard.press('ArrowUp');
      await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
    });
  });

  test('点项关闭 Drawer', async ({ browser }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page);
      await page.getByRole('menuitem', { name: 'Cut' }).click();
      await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0, { timeout: 3000 });
    });
  });

  test('移动路径的项**不是** Layer I —— Drawer 里没有悬停这一说', async ({ browser }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page);
      await expect(
        page.locator('[data-slot="sheet-body"] .lg-surface[data-layer="indicator"]'),
      ).toHaveCount(0);
    });
  });

  test('⚠️ 移动路径**没有 typeahead** —— 这条钉的是已知缺口，不是期望行为', async ({
    browser,
  }) => {
    /**
     * 桌面路径 Radix 自带首字母跳转；移动路径是我们自己接的线，没写。
     * 移动端没有物理键盘时用不上，接了外接键盘就会缺。
     *
     * 把它测出来而不是当作不存在 —— 哪天补上了，这条会红，
     * 那正是**提醒去改文档与 STATUS** 的时机。
     */
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page);
      await page.locator('[role="menuitem"]').first().focus();
      await page.keyboard.press('d'); // Delete 的首字母
      await expect(page.getByRole('menuitem', { name: 'Cut' })).toBeFocused();
    });
  });

  test('responsive={false} 是逃生口 —— 窄视口下也留在桌面路径', async ({ browser }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page, { responsive: false });
      await expect(page.locator('[data-slot="dropdown-menu-content"]')).toHaveCount(1);
      await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0);
    });
  });
});
