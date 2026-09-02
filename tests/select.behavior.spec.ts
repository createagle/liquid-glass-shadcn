/**
 * Select —— 几何、选中态、两条路径、键盘（含 typeahead）、无障碍偏好。
 *
 * 这一份比 DropdownMenu 多三块：
 *
 *   1. **挖洞的位置**。DropdownMenu 只验过「有没有色散」，没验过「洞在不在项上」——
 *      结果它一直偏着一个内边距（16, 10）。这里把对齐钉死。
 *   2. **选中态**。`aria-selected` / 对勾 / 当前值回填触发器。
 *   3. **DropdownMenu 欠的两条债**：移动路径的 typeahead、本组件自己的
 *      三种无障碍偏好测试。
 */

import { test, expect, type Page, type Browser } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/select-demo.html')).href;

/** 必须 > 768，否则 useIsCompact() 判成紧凑视口，渲染的是 Drawer */
const DESKTOP = { width: 1000, height: 800 } as const;
/** 402×874 = 参考图那块屏 */
const COMPACT = { width: 402, height: 874 } as const;

const PANEL = '[data-slot="select-content"] .lg-surface[data-layer="elevated"]';
const ITEM = '[data-slot="select-item"]';

async function open(
  page: Page,
  q: Record<string, string> = {},
  opts: { open?: boolean } = {},
) {
  const params = new URLSearchParams({ theme: 'light', tier: 'a', tint: '0.34', ...q });
  if (opts.open !== false) params.set('open', '1');
  await page.goto(`${HARNESS}?${params}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  if (opts.open !== false) await page.waitForTimeout(600);
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

const styleOf = (page: Page, sel: string, prop: string) =>
  page.evaluate(
    ([s, p]) =>
      getComputedStyle(document.querySelector(s!)!).getPropertyValue(p!).trim(),
    [sel, prop],
  );

/* ── 几何 ─────────────────────────────────────────────────────────────── */

test.describe('几何（iOS 27 实测值）', () => {
  test.use({ viewport: DESKTOP });

  test('触发器 250×48，胶囊圆角', async ({ page }) => {
    await open(page, {}, { open: false });
    const b = (await page.locator('[data-slot="select-trigger"]').boundingBox())!;
    expect(Math.round(b.width)).toBe(250);
    expect(Math.round(b.height)).toBe(48);
    expect(await styleOf(page, '[data-slot="select-trigger"]', 'border-radius')).toBe('24px');
  });

  test('面板宽 250，内边距 10 / 16', async ({ page }) => {
    await open(page);
    const b = (await page.locator(PANEL).boundingBox())!;
    expect(Math.round(b.width)).toBe(250);
    expect(await styleOf(page, PANEL, 'padding-top')).toBe('10px');
    expect(await styleOf(page, PANEL, 'padding-left')).toBe('16px');
  });

  test('项 218×40，面板高 = 10 + 5×40 + 10', async ({ page }) => {
    await open(page);
    const items = await page.locator(ITEM).all();
    expect(items).toHaveLength(5);
    for (const it of items) {
      const b = (await it.boundingBox())!;
      expect(Math.round(b.width)).toBe(218);
      expect(Math.round(b.height)).toBe(40);
    }
    const panel = (await page.locator(PANEL).boundingBox())!;
    expect(Math.round(panel.height)).toBe(10 + 5 * 40 + 10);
  });

  test('前导图标列 28×20、间距 8、标签从项内 x=42 起', async ({ page }) => {
    /**
     * 这一组是本批新量出来的（Figma 节点 12740:24194 的 Item → Leading → Symbol）：
     *   Leading 框在 218 项内 x=6 · Symbol 28×20 · Label 块 x=36 → 间距 8
     * 所以标签在项内从 6+28+8 = 42 起。**对勾画在这一列是推定，列本身是实测。**
     */
    await open(page, { value: 'size' });
    const item = page.locator(ITEM).nth(2);
    const ib = (await item.boundingBox())!;
    const ind = (await item.locator('[data-slot="select-item-indicator"]').boundingBox())!;
    expect(Math.round(ind.width)).toBe(28);
    expect(Math.round(ind.height)).toBe(20);
    expect(Math.round(ind.x - ib.x)).toBe(6);
    const label = (await item.locator('span.truncate').first().boundingBox())!;
    expect(Math.round(label.x - ib.x)).toBe(42);
  });

  test('分隔区 21 高，线在区顶 +2、左右各内缩 8', async ({ page }) => {
    await open(page, { only: 'groups' });
    const sep = page.locator('[data-slot="select-separator"]');
    const sb = (await sep.boundingBox())!;
    expect(Math.round(sb.height)).toBe(21);
    const line = (await sep.locator('span').boundingBox())!;
    expect(Math.round(line.y - sb.y)).toBe(2);
    expect(Math.round(line.x - sb.x)).toBe(8);
    expect(Math.round(sb.x + sb.width - (line.x + line.width))).toBe(8);
  });
});

/* ── 挖洞 ─────────────────────────────────────────────────────────────── */

test.describe('Layer I 与挖洞', () => {
  test.use({ viewport: DESKTOP });

  /** 从 clip-path 里解出外框与洞（浏览器会把 path() 规范化成绝对坐标） */
  async function punchOf(page: Page) {
    return page.evaluate((sel) => {
      const surf = document.querySelector(sel)!;
      const layer = surf.querySelector('.lg-punch-layer');
      if (!layer) return null;
      const d = getComputedStyle(layer).clipPath;
      const nums = (d.match(/-?[\d.]+/g) ?? []).map(Number);
      // "M 0 0 H {w} V {h} H 0 Z M {x+r} {y} H …" —— Z 不带数字，所以洞的起笔在 5/6
      //   0 1   2     3     4      5      6
      const s = surf.getBoundingClientRect();
      const item = surf.querySelector('[data-highlighted]');
      const i = item?.getBoundingClientRect();
      return {
        frame: [nums[2], nums[3]],
        holeStart: [nums[5], nums[6]],
        surface: [s.width, s.height],
        offsetSize: [(surf as HTMLElement).offsetWidth, (surf as HTMLElement).offsetHeight],
        itemRel: i ? [i.left - s.left, i.top - s.top, i.width, i.height] : null,
      };
    }, PANEL);
  }

  test('高亮项是 Layer I —— 强玻璃，不是简单填色', async ({ page }) => {
    await open(page);
    await page.locator(ITEM).nth(1).hover();
    await page.waitForTimeout(400);
    const surface = page.locator('[data-slot="select-item-highlight"] .lg-surface').first();
    await expect(surface).toHaveAttribute('data-layer', 'indicator');
  });

  test('洞与高亮项**逐像素对齐**（相对 .lg-surface 本体）', async ({ page }) => {
    /**
     * 回归测试。DropdownMenu 原来拿「装内容的那个 div」当基准，
     * 而 div 在面板的内边距**里面** —— 洞整体偏了 (16, 10)。
     * 偏了之后洞与项仍有 ~90% 重叠，条纹清晰度照样翻倍，
     * 所以「有没有色散」的实测是对的，位置却一直没人验。
     */
    await open(page, { value: 'size' });
    const p = (await punchOf(page))!;
    expect(p.itemRel).not.toBeNull();
    const [ix, iy] = p.itemRel!;
    // 洞的左上角就是项的左上角，加上圆角 r=10 的水平偏移（path 从 x+r 起笔）
    expect(Math.abs(p.holeStart[0]! - (ix! + 10))).toBeLessThan(1);
    expect(Math.abs(p.holeStart[1]! - iy!)).toBeLessThan(1);
  });

  test('挖洞外框 = 底座的**布局**尺寸，不是入场动画那一帧的缩放尺寸', async ({ page }) => {
    /**
     * 另一半回归测试。Select 打开时 Radix 会立刻高亮当前选中项 ——
     * 正好撞在面板 scale 0.94→1 的入场动画中间。
     * 原来 GlassSurface 用 getBoundingClientRect() 量自己，量到的是变换后的盒子，
     * 而 clip-path 的坐标系是未变换的，外框于是短 5%、右下角的模糊被裁掉，
     * 且 ResizeObserver 不会因为 transform 再触发一次，错了就一直错着。
     */
    await open(page, { value: 'size' });
    const p = (await punchOf(page))!;
    expect(Math.abs(p.frame[0]! - p.offsetSize[0]!)).toBeLessThan(1);
    expect(Math.abs(p.frame[1]! - p.offsetSize[1]!)).toBeLessThan(1);
  });

  test('洞跟着高亮项走', async ({ page }) => {
    await open(page);
    await page.locator(ITEM).nth(0).hover();
    await page.waitForTimeout(300);
    const a = (await punchOf(page))!;
    await page.locator(ITEM).nth(3).hover();
    await page.waitForTimeout(300);
    const b = (await punchOf(page))!;
    expect(b.holeStart[1]!).toBeGreaterThan(a.holeStart[1]!);
    expect(Math.round(b.holeStart[1]! - a.holeStart[1]!)).toBe(3 * 40);
  });

  test('面板滚动时洞跟得上', async ({ page }) => {
    /**
     * 选项一多面板就要滚。Radix 换高亮项时**先改属性、再滚进视野**，
     * 两件事不在同一帧 —— 只听 MutationObserver 的话洞会停在滚动前的位置。
     */
    await open(page, { only: 'long', value: 'opt-0' });
    const before = (await punchOf(page))!;
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(400);
    const after = (await punchOf(page))!;
    const [, iy] = after.itemRel!;
    expect(Math.abs(after.holeStart[1]! - iy!)).toBeLessThan(1.5);
    expect(after.holeStart[1]).not.toBe(before.holeStart[1]);
  });

  test('移动路径不挖洞 —— Drawer 里的项不是 Layer I', async ({ browser }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page);
      await expect(page.locator('[data-slot="select-item-highlight"]')).toHaveCount(0);
    });
  });
});

/* ── 选中态 ───────────────────────────────────────────────────────────── */

test.describe('选中态', () => {
  test('只有选中项带 aria-selected=true 与对勾', async ({ browser }) => {
    for (const viewport of [DESKTOP, COMPACT]) {
      await withContext(browser, { viewport }, async (page) => {
        await open(page, { value: 'size' });
        const selected = page.locator(`${ITEM}[aria-selected="true"]`);
        await expect(selected).toHaveCount(1);
        await expect(selected).toContainText('Size');
        await expect(page.locator('[data-slot="select-item-indicator"][data-selected]')).toHaveCount(
          1,
        );
        await expect(page.locator('[data-slot="select-item-indicator"] svg')).toHaveCount(1);
      });
    }
  });

  test('图标列**永远占位** —— 选中与否标签不横跳', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page, { value: 'size' });
    const xs = await page.evaluate((sel) => {
      const items = [...document.querySelectorAll(sel)];
      return items.map((it) => {
        const label = it.querySelector('span.truncate')!;
        return Math.round(label.getBoundingClientRect().left - it.getBoundingClientRect().left);
      });
    }, ITEM);
    expect(new Set(xs).size).toBe(1);
    expect(xs[0]).toBe(42);
  });

  test('选中后触发器回填当前值，浮层关闭', async ({ browser }) => {
    for (const viewport of [DESKTOP, COMPACT]) {
      await withContext(browser, { viewport }, async (page) => {
        await open(page, {}, { open: false });
        const trigger = page.locator('[data-slot="select-trigger"]');
        await expect(trigger).toContainText('选择排序方式');
        await trigger.click();
        await page.waitForTimeout(500);
        await page.locator(ITEM).filter({ hasText: 'Shared By' }).click();
        await page.waitForTimeout(600);
        await expect(trigger).toContainText('Shared By');
        await expect(page.locator('[data-glass-select="content"]')).toHaveCount(0);
      });
    }
  });

  test('移动路径：Drawer 关着时触发器也能显示当前值', async ({ browser }) => {
    /**
     * Sheet 关着的时候 SelectItem 根本没渲染，触发器无从知道 `size` 该显示成
     * "Size" —— 组件为此把 children 渲染进一个游离的 DocumentFragment 让项注册。
     * 这条就是那段机关的测试。
     */
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page, { value: 'date' }, { open: false });
      await expect(page.locator('[data-slot="select-trigger"]')).toContainText('Date Modified');
      // fragment 里的东西不能出现在文档里
      await expect(page.locator(ITEM)).toHaveCount(0);
    });
  });

  test('禁用项不可选', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page, { only: 'groups' });
    const disabled = page.locator(ITEM).filter({ hasText: 'Date Created' });
    await expect(disabled).toHaveAttribute('data-disabled', '');
  });
});

/* ── 两条路径（SPEC §9） ──────────────────────────────────────────────── */

test.describe('SPEC §9 —— 紧凑视口换成底部 Drawer', () => {
  const pathOf = async (page: Page) => {
    if ((await page.locator('[data-slot="select-content"]').count()) > 0) return 'listbox';
    if ((await page.locator('[data-slot="sheet-content"]').count()) > 0) return 'sheet';
    return 'none';
  };

  test('宽视口 → 锚定 listbox', async ({ browser }) => {
    await withContext(browser, { viewport: DESKTOP }, async (page) => {
      await open(page);
      expect(await pathOf(page)).toBe('listbox');
    });
  });

  test('窄视口 → 底部 Drawer', async ({ browser }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page);
      expect(await pathOf(page)).toBe('sheet');
    });
  });

  test('宽视口但粗指针 → 仍然是 Drawer', async ({ browser }) => {
    await withContext(browser, { viewport: DESKTOP, hasTouch: true }, async (page) => {
      const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
      test.skip(!coarse, '这个 Chromium 下 hasTouch 没有让 pointer:coarse 生效');
      await open(page);
      expect(await pathOf(page)).toBe('sheet');
    });
  });

  test('responsive=0 是逃生口', async ({ browser }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page, { responsive: '0' });
      expect(await pathOf(page)).toBe('listbox');
    });
  });

  test('移动路径：Drawer 左右各 6，标题可见，正文是 role=listbox', async ({ browser }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page);
      const content = (await page.locator('[data-slot="sheet-content"]').boundingBox())!;
      expect(Math.round(content.x)).toBe(6);
      expect(Math.round(COMPACT.width - (content.x + content.width))).toBe(6);
      await expect(page.locator('[data-slot="sheet-title"]')).toHaveText('排序方式');
      await expect(page.locator('[data-slot="sheet-body"] [role="listbox"]')).toHaveCount(1);
      await expect(page.locator('[data-slot="sheet-grabber"]')).toHaveCount(1);
    });
  });
});

/* ── 键盘 ─────────────────────────────────────────────────────────────── */

test.describe('键盘（桌面路径由 Radix 接）', () => {
  test.use({ viewport: DESKTOP });

  test('↓ 移动高亮，Enter 选中', async ({ page }) => {
    await open(page, { value: 'name' });
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    await expect(page.locator(`${ITEM}[data-highlighted]`)).toContainText('Date Modified');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await expect(page.locator('[data-slot="select-trigger"]')).toContainText('Date Modified');
  });

  test('typeahead 在桌面路径可用（Radix 自带）', async ({ page }) => {
    await open(page, { value: 'name' });
    await page.keyboard.press('t');
    await page.waitForTimeout(200);
    await expect(page.locator(`${ITEM}[data-highlighted]`)).toContainText('Tags');
  });
});

test.describe('键盘（移动路径 —— 我们自己接的线）', () => {
  const focusedText = (page: Page) =>
    page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');

  test('↑ ↓ Home End', async ({ browser }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page, { value: 'name' });
      expect(await focusedText(page)).toBe('Name');
      await page.keyboard.press('ArrowDown');
      expect(await focusedText(page)).toBe('Date Modified');
      await page.keyboard.press('ArrowUp');
      expect(await focusedText(page)).toBe('Name');
      await page.keyboard.press('End');
      expect(await focusedText(page)).toBe('Tags');
      await page.keyboard.press('Home');
      expect(await focusedText(page)).toBe('Name');
      // 从头再往上要绕回末尾
      await page.keyboard.press('ArrowUp');
      expect(await focusedText(page)).toBe('Tags');
    });
  });

  test('typeahead：单字母跳转', async ({ browser }) => {
    /**
     * **DropdownMenu 欠的就是这一条，Select 还上了。**
     * 移动端接了外接键盘（或用 iPad 的键盘壳）时，没有 typeahead
     * 就只能一项一项按方向键。
     */
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page, { value: 'name' });
      await page.keyboard.press('t');
      expect(await focusedText(page)).toBe('Tags');
    });
  });

  test('typeahead：同一个字母反复按 → 在候选之间循环', async ({ browser }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page, { value: 'name' });
      await page.keyboard.press('s');
      expect(await focusedText(page)).toBe('Size');
      await page.keyboard.press('s');
      expect(await focusedText(page)).toBe('Shared By');
      await page.keyboard.press('s');
      expect(await focusedText(page)).toBe('Size');
    });
  });

  test('typeahead：多字前缀', async ({ browser }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page, { value: 'name' });
      await page.keyboard.press('s');
      await page.keyboard.press('h');
      expect(await focusedText(page)).toBe('Shared By');
    });
  });

  test('typeahead：缓冲超时后重新开始', async ({ browser }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page, { value: 'name' });
      await page.keyboard.press('s');
      expect(await focusedText(page)).toBe('Size');
      // 缓冲存活 1s，等过去之后 "h" 就是一个全新的搜索（没有 h 开头的项，焦点不动）
      await page.waitForTimeout(1300);
      await page.keyboard.press('h');
      expect(await focusedText(page)).toBe('Size');
    });
  });

  test('空格留给「选中当前项」，不被 typeahead 吞掉', async ({ browser }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page, { value: 'name' });
      await page.keyboard.press('ArrowDown');
      expect(await focusedText(page)).toBe('Date Modified');
      await page.keyboard.press(' ');
      await page.waitForTimeout(600);
      await expect(page.locator('[data-slot="select-trigger"]')).toContainText('Date Modified');
    });
  });

  test('打开时焦点落在当前选中项上', async ({ browser }) => {
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page, { value: 'tags' });
      expect(await focusedText(page)).toBe('Tags');
      expect(
        await page.evaluate(() => document.activeElement?.getAttribute('aria-selected')),
      ).toBe('true');
    });
  });
});

/* ── a11y ─────────────────────────────────────────────────────────────── */

test.describe('无障碍', () => {
  test('两条路径的触发器都是 role=combobox，aria-expanded 跟随开关', async ({ browser }) => {
    for (const viewport of [DESKTOP, COMPACT]) {
      await withContext(browser, { viewport }, async (page) => {
        await open(page, {}, { open: false });
        const trigger = page.locator('[data-slot="select-trigger"]');
        await expect(trigger).toHaveAttribute('role', 'combobox');
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await trigger.click();
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });
    }
  });

  test('两条路径的浮层可访问名称**一致** —— 与 DropdownMenu 不同', async ({ browser }) => {
    /**
     * DropdownMenu 那一批两条路径的名称是不同的（桌面由触发器命名，
     * 那是 WAI-ARIA 的 menu 模式要求的）。**Select 不一样**：
     * Radix Select 的 Content 是 listbox，不会自动由触发器命名，
     * 所以两边都落到 title 上。别把上一批的结论照搬过来。
     */
    await withContext(browser, { viewport: DESKTOP }, async (page) => {
      await open(page);
      await expect(page.getByRole('listbox')).toHaveAccessibleName('排序方式');
    });
    await withContext(browser, { viewport: COMPACT }, async (page) => {
      await open(page);
      await expect(page.getByRole('listbox')).toHaveAccessibleName('排序方式');
      await expect(page.getByRole('dialog')).toHaveAccessibleName('排序方式');
    });
  });

  test('两条路径都能 Esc 关闭，焦点还给触发器', async ({ browser }) => {
    for (const viewport of [DESKTOP, COMPACT]) {
      await withContext(browser, { viewport }, async (page) => {
        await open(page, {}, { open: false });
        const trigger = page.locator('[data-slot="select-trigger"]');
        await trigger.click();
        await page.waitForTimeout(500);
        await expect(page.locator('[data-glass-select="content"]')).toHaveCount(1);
        await page.keyboard.press('Escape');
        await expect(page.locator('[data-glass-select="content"]')).toHaveCount(0, {
          timeout: 3000,
        });
        await expect(trigger).toBeFocused();
      });
    }
  });

  test('disabled 时点不开', async ({ browser }) => {
    for (const viewport of [DESKTOP, COMPACT]) {
      await withContext(browser, { viewport }, async (page) => {
        await open(page, { disabled: '1' }, { open: false });
        const trigger = page.locator('[data-slot="select-trigger"]');
        await expect(trigger).toBeDisabled();
        await trigger.click({ force: true });
        await page.waitForTimeout(400);
        await expect(page.locator('[data-glass-select="content"]')).toHaveCount(0);
      });
    }
  });
});

/* ── 无障碍偏好（PROJECT_SPEC §13）───────────────────────────────────── */

test.describe('无障碍偏好降级', () => {
  /**
   * DropdownMenu 那一批把「本组件自己的三种偏好测试」记成欠着的，
   * 这里连本带利还上：透明度、对比度、动效各一条。
   */
  test('reduced-transparency：面板不再模糊，材质压到接近实色', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: DESKTOP });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    // Playwright 没有这个偏好的开关，用 CDP 塞 media feature（做 Card 时找到的办法）
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

  test('reduced-transparency：高亮项也不折射了', async ({ browser }) => {
    /**
     * 面板不折射不代表高亮项也不折射 —— 它是另一层（Layer I），
     * 走的是 --lg-refract-*，得单独验。
     */
    const ctx = await browser.newContext({ viewport: DESKTOP });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
    });
    await open(page, { value: 'size' });
    const filter = await styleOf(
      page,
      '[data-slot="select-item-highlight"] .lg-surface',
      'backdrop-filter',
    );
    expect(filter).not.toContain('url(');
    await ctx.close();
  });

  test('prefers-contrast: more：面板描边加强', async ({ browser }) => {
    const read = async (contrast: 'more' | 'no-preference') => {
      let shadow = '';
      await withContext(browser, { viewport: DESKTOP, contrast }, async (page) => {
        await open(page);
        shadow = await styleOf(page, PANEL, 'box-shadow');
      });
      return shadow;
    };
    const more = await read('more');
    const normal = await read('no-preference');
    expect(more).not.toBe(normal);
    expect(more.length).toBeGreaterThan(0);
  });

  test('reduced-motion：入场过渡明显更短', async ({ browser }) => {
    /**
     * 判据是**两次实测相比**，不写死某个时刻该到多少 ——
     * 那等于把 springs 预设的内部参数抄进测试里，以后调预设会误报。
     */
    const at = async (reducedMotion: 'reduce' | 'no-preference') => {
      let o = 0;
      await withContext(browser, { viewport: DESKTOP, reducedMotion }, async (page) => {
        await open(page, {}, { open: false });
        await page.locator('[data-slot="select-trigger"]').click();
        await page.waitForTimeout(60);
        o = await page.evaluate(() =>
          Number(getComputedStyle(document.querySelector('[data-slot="select-panel"]')!).opacity),
        );
      });
      return o;
    };
    expect(await at('reduce')).toBeGreaterThan(await at('no-preference'));
  });
});
