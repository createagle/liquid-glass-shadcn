/**
 * P2 第一批（Accordion / Collapsible / ScrollArea / Table）的行为回归。
 *
 * 四个都有 macOS 27 的实测依据（apple-metrics.md §11），所以几何值得钉。
 * 但要分清楚**哪一部分是实测的**：
 *
 *   Collapsible  触发器的尺寸与配色实测；**人字形的形状是自己画的**，不断言
 *   Accordion    两个零件实测；**怎么拼是本库定的**，只断言拼出来的行为
 *   ScrollArea   滚动条几何实测；**边缘效果的强度曲线全是推定**，只断言它动了
 *   Table        行高 / 内缩 / 缩进 / 三档行色全部实测，全断言
 *
 * 另有一条与 toggles2 同样的：**这四个子树里 .lg-surface 计数为 0** ——
 * 唯一的例外是 ScrollArea 打开边缘效果时，那一层属于 @createagle/glass-core。
 */

import { test, expect, type Page, type Browser } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/structure-demo.html')).href;

function url(opts: { only?: string; theme?: string; tier?: string } = {}) {
  const q = new URLSearchParams({
    theme: opts.theme ?? 'light',
    tier: opts.tier ?? 'a',
    ...(opts.only ? { only: opts.only } : {}),
  });
  return `${HARNESS}?${q}`;
}

async function ready(page: Page) {
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

async function open(page: Page, opts: Parameters<typeof url>[0] = {}) {
  await page.goto(url(opts));
  await ready(page);
}

/* ══════════════════════════════════════════════════════════════════════
   Collapsible / Disclosure Button
   ══════════════════════════════════════════════════════════════════════ */

test.describe('Collapsible', () => {
  test('五档尺寸的圆角是**查表**，不是比例', async ({ page }) => {
    /**
     * [实测] 16→4 / 20→5 / 24→6（恰好是边长 ÷ 4），**28 与 36 是正圆**。
     * 这条专门钉住那个跳变 —— 用一个比例硬套过去，28 会得到 7 而不是圆。
     */
    await open(page, { only: 'collapsible' });
    const read = (s: number) =>
      page.getByTestId(`ind-${s}`).evaluate((el) => ({
        w: el.getBoundingClientRect().width,
        r: parseFloat(getComputedStyle(el).borderTopLeftRadius),
      }));

    for (const [size, radius] of [
      [16, 4],
      [20, 5],
      [24, 6],
    ] as const) {
      const m = await read(size);
      expect(m.w, `${size} 档的边长`).toBeCloseTo(size, 1);
      expect(m.r, `${size} 档的圆角 [实测] ${radius}`).toBeCloseTo(radius, 1);
    }

    for (const size of [28, 36] as const) {
      const m = await read(size);
      expect(m.w).toBeCloseTo(size, 1);
      // 正圆：半径至少是边长的一半（Tailwind 的 rounded-full 会给一个极大值）
      expect(m.r, `${size} 档必须是正圆`).toBeGreaterThanOrEqual(size / 2);
    }
  });

  test('字号在 24 那一档跳变：16/20 用 10，24 起用 13', async ({ page }) => {
    await open(page, { only: 'collapsible' });
    const glyph = (s: number) =>
      page.getByTestId(`ind-${s}`).evaluate((el) => Number(el.querySelector('svg')?.getAttribute('width')));
    expect(await glyph(16)).toBe(10);
    expect(await glyph(20)).toBe(10);
    expect(await glyph(24)).toBe(13);
    expect(await glyph(36)).toBe(13);
  });

  test('底色是 disclosure 那一套，**不是** checkbox 那一套', async ({ page }) => {
    /**
     * [实测] disclosure idle = #000000 @ 0.08；
     * checkbox idle = #000000 @ 0.10。两组数很接近但确实不同，
     * 这条钉住「没有被合并成同一个 token」。
     */
    await open(page, { only: 'collapsible' });
    const bg = await page
      .getByTestId('ind-28')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgba(0, 0, 0, 0.08)');
  });

  test('展开 / 收起：只有一个指示器可见，方向跟着状态走', async ({ page }) => {
    await open(page, { only: 'collapsible' });
    const trigger = page.getByTestId('cl-closed-trigger');
    const visible = () =>
      trigger.evaluate((el) =>
        [...el.querySelectorAll('[data-slot="disclosure-indicator"]')]
          .filter((e) => getComputedStyle(e).display !== 'none')
          .map((e) => e.getAttribute('data-state')),
      );

    await expect(trigger).toHaveAttribute('data-state', 'closed');
    expect(await visible(), '收起时只该有一个、且是 closed').toEqual(['closed']);

    await trigger.click();
    await expect(trigger).toHaveAttribute('data-state', 'open');
    expect(await visible(), '展开时只该有一个、且是 open').toEqual(['open']);
  });

  test('触发器命中区补到 44 高，视觉尺寸仍是 28', async ({ page }) => {
    await open(page, { only: 'collapsible' });
    const m = await page.getByTestId('cl-open-trigger').evaluate((el) => ({
      hit: getComputedStyle(el, '::before').height,
      /*
       * ⚠️ 要取**可见**的那一个。触发器里常驻两个指示器（open / closed），
       * 靠 CSS 切换显隐；`querySelector` 拿到的是第一个，
       * 而展开态下第一个正是被 `display:none` 藏起来的那个 —— 高度 0。
       */
      indicator: [...el.querySelectorAll('[data-slot="disclosure-indicator"]')]
        .filter((e) => getComputedStyle(e).display !== 'none')[0]!
        .getBoundingClientRect().height,
    }));
    expect(m.hit).toBe('44px');
    expect(m.indicator).toBeCloseTo(28, 1);
  });

  test('禁用：不可点，且变灰', async ({ page }) => {
    await open(page, { only: 'collapsible' });
    const d = page.getByTestId('cl-disabled');
    await expect(d).toBeDisabled();
    expect(Number(await d.evaluate((el) => getComputedStyle(el).opacity))).toBeCloseTo(0.45, 2);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Accordion
   ══════════════════════════════════════════════════════════════════════ */

test.describe('Accordion', () => {
  test('single + collapsible：开一个会关掉另一个，再点自己能全关', async ({ page }) => {
    await open(page, { only: 'accordion' });
    const a = page.getByTestId('ac-a');
    const b = page.getByTestId('ac-b');
    await expect(a).toHaveAttribute('data-state', 'open');

    await b.click();
    await expect(b).toHaveAttribute('data-state', 'open');
    await expect(a, '单开模式下前一个要关掉').toHaveAttribute('data-state', 'closed');

    await b.click();
    await expect(b, 'collapsible 允许全部收起').toHaveAttribute('data-state', 'closed');
  });

  test('Radix 要求的 <h3> 结构在（无障碍结构的一部分）', async ({ page }) => {
    /**
     * `AccordionPrimitive.Header` 渲染成 h3，触发器必须裹在里面 ——
     * 本库把这一层封进了 AccordionTrigger，调用方不用记。这条钉住它没被漏掉。
     */
    await open(page, { only: 'accordion' });
    const tag = await page
      .getByTestId('ac-a')
      .evaluate((el) => el.parentElement?.tagName);
    expect(tag).toBe('H3');
  });

  test('区块底是 Group Box 的实测值，圆角 12', async ({ page }) => {
    await open(page, { only: 'accordion' });
    const m = await page.getByTestId('ac').evaluate((el) => ({
      bg: getComputedStyle(el).backgroundColor,
      radius: getComputedStyle(el).borderTopLeftRadius,
      boxed: el.getAttribute('data-boxed'),
    }));
    expect(m.boxed).toBe('true');
    expect(m.radius).toBe('12px');
    /*
     * [实测] #000000@0.03 × 整层 0.50 → 等效 0.015。
     * ⚠️ 别逐字比字符串：Chromium 把 alpha 舍到三位有效数字，量出来是 0.016。
     */
    const alpha = Number(m.bg.match(/rgba?\(([^)]+)\)/)?.[1].split(',')[3] ?? 1);
    expect(alpha).toBeCloseTo(0.015, 2);
  });

  test('禁用项点不开', async ({ page }) => {
    await open(page, { only: 'accordion' });
    const c = page.getByTestId('ac-c');
    await expect(c).toBeDisabled();
    await expect(c).toHaveAttribute('data-state', 'closed');
  });
});

/* ══════════════════════════════════════════════════════════════════════
   ScrollArea
   ══════════════════════════════════════════════════════════════════════ */

test.describe('ScrollArea', () => {
  test('滚动条几何：槽 12、内缩 3、滑块 6、全圆角', async ({ page }) => {
    await open(page, { only: 'scroll' });
    const m = await page.getByTestId('sa-always').evaluate((el) => {
      const bar = el.querySelector('[data-slot="scroll-area-scrollbar"]')!;
      const thumb = el.querySelector('[data-slot="scroll-area-thumb"]')!;
      return {
        barW: bar.getBoundingClientRect().width,
        pad: getComputedStyle(bar).paddingLeft,
        thumbW: thumb.getBoundingClientRect().width,
        color: getComputedStyle(thumb).backgroundColor,
        minH: getComputedStyle(thumb).minHeight,
      };
    });
    expect(m.barW, '槽宽 [实测] 12').toBeCloseTo(12, 1);
    expect(m.pad, '两侧内缩 [实测] 3').toBe('3px');
    expect(m.thumbW, '滑块厚 [实测] 6').toBeCloseTo(6, 1);
    expect(m.color, '滑块色 [实测] #000000 @ 0.50').toBe('rgba(0, 0, 0, 0.5)');
    expect(m.minH, '最短 [实测] 约 8').toBe('8px');
  });

  test('滑块长度随内容比例缩短 —— 不是撑满整条轨道', async ({ page }) => {
    /**
     * ⚠️ 这条是**回归**，不是理论断言。
     *
     * 第一版给竖向滚动条也写了 `flex-col`，主轴方向反了：
     * 滑块的 `flex: 1 1 0%` 把 Radix 内联的 height 覆盖掉，
     * 量出来滑块高 154 —— 正好是整条轨道，看上去就像「滚动条不会动」。
     */
    await open(page, { only: 'scroll' });
    const m = await page.getByTestId('sa-always').evaluate((el) => {
      const bar = el.querySelector('[data-slot="scroll-area-scrollbar"]')!;
      const thumb = el.querySelector('[data-slot="scroll-area-thumb"]')!;
      const vp = el.querySelector('[data-slot="scroll-area-viewport"]')!;
      const track = bar.getBoundingClientRect().height - 6; // 减掉上下各 3 的内缩
      return {
        thumbH: thumb.getBoundingClientRect().height,
        expected: track / (vp.scrollHeight / vp.clientHeight),
        track,
      };
    });
    expect(m.thumbH).toBeCloseTo(m.expected, 0);
    expect(m.thumbH, '绝不能等于整条轨道').toBeLessThan(m.track * 0.9);
  });

  test('边缘效果默认关着；打开后随滚动位置变化', async ({ page }) => {
    await open(page, { only: 'scroll' });

    const bands = (id: string) =>
      page
        .getByTestId(id)
        .evaluate((el) =>
          [...el.children]
            .filter((c) => c.tagName === 'DIV' && !c.hasAttribute('data-slot'))
            .map((c) => (c as HTMLElement).style.getPropertyValue('--lg-edge-progress')),
        );

    expect(await bands('sa-plain'), '没开就不该有带子').toEqual([]);

    const before = await bands('sa-edges');
    expect(before.length, '开了应当有上下两条').toBe(2);
    // 起始位置：顶部 0（没滚过），底部 > 0（下面还有内容）
    expect(Number(before[0])).toBe(0);
    expect(Number(before[1])).toBeGreaterThan(0);

    await page.getByTestId('sa-edges').evaluate((el) => {
      const vp = el.querySelector('[data-slot="scroll-area-viewport"]')! as HTMLElement;
      vp.scrollTop = vp.scrollHeight;
      vp.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await page.waitForTimeout(120);

    const after = await bands('sa-edges');
    expect(Number(after[0]), '滚到底：顶部那条该满').toBeGreaterThan(0);
    expect(Number(after[1]), '滚到底：底部那条该退场').toBe(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Table
   ══════════════════════════════════════════════════════════════════════ */

test.describe('Table', () => {
  test('两档密度：compact 是实测的 20，默认是推定的 32', async ({ page }) => {
    await open(page, { only: 'table' });
    const h = (id: string) =>
      page.getByTestId(id).evaluate((el) => el.querySelector('td')!.getBoundingClientRect().height);
    expect(await h('tbl-compact'), '[实测] 20').toBeCloseTo(20, 1);
    expect(await h('tbl-default'), '`[推定]` 32').toBeCloseTo(32, 1);
  });

  test('行背景：左右内缩 10、圆角 8', async ({ page }) => {
    await open(page, { only: 'table' });
    const m = await page.getByTestId('tbl-default').evaluate((el) => ({
      pad: getComputedStyle(el).paddingLeft,
      radius: getComputedStyle(el.querySelector('td')!).borderTopLeftRadius,
    }));
    expect(m.pad, '[实测] 10').toBe('10px');
    expect(m.radius, '[实测] 8').toBe('8px');
  });

  test('层级缩进每级 15', async ({ page }) => {
    await open(page, { only: 'table' });
    // ⚠️ 验证台里有两张表（default / compact），tr 的 testid 会撞，必须先限定到一张
    const pad = (i: number) =>
      page
        .getByTestId('tbl-default')
        .getByTestId(`tr-${i}`)
        .evaluate((el) => parseFloat(getComputedStyle(el.querySelector('td')!).paddingLeft));
    // 第 0 行 level=0 → 16；第 1 行 level=1 → 16 + 15
    expect(await pad(0)).toBeCloseTo(16, 1);
    expect(await pad(1)).toBeCloseTo(31, 1);
  });

  test('三档行色：交替行 / 选中失焦 / 选中有焦点', async ({ page }) => {
    await open(page, { only: 'table' });
    const table = page.getByTestId('tbl-default');
    const cellBg = (i: number) =>
      table
        .getByTestId(`tr-${i}`)
        .evaluate((el) => getComputedStyle(el.querySelector('td')!).backgroundColor);

    // 第 3 行是偶数位（nth-child(4)）且未选中 → 交替行色
    expect(await cellBg(3), '交替行 [实测] #000000 @ 0.05').toBe('rgba(0, 0, 0, 0.05)');

    // 初始 sel=1，但表格没有焦点 → 较淡的那一档
    expect(await cellBg(1), '选中 · 失焦 [实测] #000000 @ 0.14').toBe('rgba(0, 0, 0, 0.14)');

    await table.getByTestId('tr-1').focus();
    expect(await cellBg(1), '选中 · 有焦点 [实测] #0165e2').toBe('rgb(1, 101, 226)');
    const color = await table
      .getByTestId('tr-1')
      .evaluate((el) => getComputedStyle(el.querySelector('td')!).color);
    expect(color, '实心蓝上文字压白').toBe('rgb(255, 255, 255)');
  });

  test('选中行不会被交替行色盖掉', async ({ page }) => {
    /**
     * 交替行那条规则的选择器是 `.tbody > tr:nth-child(even)`（0,1,2），
     * 比选中行自己那条工具类（0,1,0）优先级更高。
     * 所以它必须显式 `:not([data-selected])` —— 这条钉住那个排除。
     */
    await open(page, { only: 'table' });
    const table = page.getByTestId('tbl-default');
    await table.getByTestId('tr-1').focus(); // 第 2 行 = nth-child(2)，偶数位
    const bg = await table
      .getByTestId('tr-1')
      .evaluate((el) => getComputedStyle(el.querySelector('td')!).backgroundColor);
    expect(bg).toBe('rgb(1, 101, 226)');
  });

  test('排序列：加粗，且带 aria-sort', async ({ page }) => {
    await open(page, { only: 'table' });
    const head = page.getByTestId('tbl-default').locator('[data-slot="table-head"]').first();
    await expect(head).toHaveAttribute('aria-sort', 'ascending');
    const m = await head.evaluate((el) => ({
      weight: getComputedStyle(el).fontWeight,
      size: getComputedStyle(el).fontSize,
    }));
    expect(m.weight, '[实测] 排序列是 Bold').toBe('700');
    expect(m.size, '[实测] 表头 11').toBe('11px');
  });

  test('caption 在表格**下面**', async ({ page }) => {
    await open(page, { only: 'table' });
    const side = await page
      .getByTestId('tbl-default')
      .evaluate((el) => getComputedStyle(el.querySelector('caption')!).captionSide);
    expect(side).toBe('bottom');
  });
});

/* ══════════════════════════════════════════════════════════════════════
   分层：四个都是内容层
   ══════════════════════════════════════════════════════════════════════ */

test.describe('分层', () => {
  for (const row of ['row-collapsible', 'row-accordion', 'row-table']) {
    test(`${row}：.lg-surface 计数为 0`, async ({ page }) => {
      await open(page, { only: row.replace('row-', '') });
      expect(await page.getByTestId(row).locator('.lg-surface').count()).toBe(0);
    });
  }

  test('Table 上一句玻璃都没有（SPEC §2 明令）', async ({ page }) => {
    await open(page, { only: 'table' });
    expect(await page.locator('[data-slot="table"] .lg-surface').count()).toBe(0);
    expect(await page.locator('[data-refraction]').count(), '也不该消耗折射预算').toBe(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   无障碍偏好
   ══════════════════════════════════════════════════════════════════════ */

test.describe('无障碍偏好', () => {
  /**
   * ⚠️ **必须盯「闭合」的那一项，不能用 `.first()`。**
   *
   * 第一版两条都取了第一项，而验证台里第一项是**初始就展开**的。
   * Radix 对这种项会内联一句 `animation-name: none`
   * （避免挂载时就播一遍展开动画）—— 于是：
   *
   *   · reduced-motion 那条量到 none，**假阳性通过**；
   *   · 正常动效那条也量到 none，红了，反而是它把上面那条的假阳性暴露出来的。
   *
   * 换成闭合项，两条才真的有区分力。
   */
  const closedContent = (page: Page) =>
    page.locator('[data-slot="accordion-content"][data-state="closed"]').first();

  test('reduced-motion：高度动画整个去掉', async ({ page }) => {
    /*
     * 展开 / 收起是**位移**，§13 要求砍掉。
     * 这里可以直接 animation: none —— Collapsible 与 Toast 不同，
     * Radix 不靠 animationend 摘节点。
     */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, { only: 'accordion' });
    const name = await closedContent(page).evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe('none');
  });

  test('正常动效下高度动画是在的（证明上一条有区分力）', async ({ page }) => {
    await open(page, { only: 'accordion' });
    const name = await closedContent(page).evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe('lg-collapsible-up');
  });

  test('prefers-contrast: more —— 滚动条滑块与交替行都要加深', async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    const read = async (contrast: 'more' | 'no-preference') => {
      const ctx = await browser.newContext({ contrast });
      const page = await ctx.newPage();
      await page.goto(url({ only: 'scroll' }));
      await ready(page);
      // 与 toggles2 同一个坑：属性翻转之后颜色要沿过渡爬，等它稳定
      await page.waitForTimeout(400);
      const v = await page
        .getByTestId('sa-always')
        .evaluate((el) =>
          getComputedStyle(el.querySelector('[data-slot="scroll-area-thumb"]')!).backgroundColor,
        );
      await ctx.close();
      return v;
    };
    const normal = await read('no-preference');
    const more = await read('more');
    expect(more).not.toBe(normal);
    const alpha = (c: string) => Number(c.match(/rgba?\(([^)]+)\)/)?.[1].split(',')[3] ?? 1);
    expect(alpha(more)).toBeGreaterThan(alpha(normal));
  });
});
