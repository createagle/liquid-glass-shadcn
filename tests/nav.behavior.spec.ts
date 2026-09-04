/**
 * P2 第二批（Pagination / Breadcrumb / ContextMenu / Resizable）的行为回归。
 *
 * **这一批两有两无**，断言的密度因此差别很大：
 *
 *   Pagination   iOS 27 实测（容器 24 / 内边距 12 / 点 8 / 间距 8 / 三档尺寸）→ 几何全钉
 *   ContextMenu  与 DropdownMenu 同一块面板（218×40 两处独立印证）+ 压暗层 0.23 → 全钉
 *   Breadcrumb   资源里**根本没有** → 只钉语义（aria-current、分隔符不进无障碍树）
 *   Resizable    分隔条**没有任何规格** → 只钉行为（可拖、可聚焦、键盘能调）
 *
 * ⚠️ Resizable 一律用 `data-slot` 选中：react-resizable-panels v4
 * 会用自己的内部 id 覆盖掉调用方传的 `data-testid`（见 resizable.tsx）。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/nav-demo.html')).href;

async function open(page: Page, only?: string, theme = 'light') {
  const q = new URLSearchParams({ theme, tier: 'a', ...(only ? { only } : {}) });
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Pagination —— 几何全部实测，钉死
   ══════════════════════════════════════════════════════════════════════ */

test.describe('Pagination', () => {
  test('容器：高 24、左右内边距 12、胶囊、且**是玻璃**', async ({ page }) => {
    await open(page, 'pagination');
    const m = await page.getByTestId('pg-static').evaluate((el) => {
      const t = el.querySelector('[data-slot="pagination-track"]')!;
      const cs = getComputedStyle(t);
      return {
        h: t.getBoundingClientRect().height,
        pad: cs.paddingLeft,
        radius: parseFloat(cs.borderTopLeftRadius),
        gap: cs.gap,
        glass: t.classList.contains('lg-surface'),
      };
    });
    expect(m.h, '[实测] 24').toBeCloseTo(24, 1);
    expect(m.pad, '[实测] 12').toBe('12px');
    expect(m.radius, '胶囊 = 高的一半').toBeCloseTo(12, 1);
    expect(m.gap, '[实测] 8').toBe('8px');
    expect(m.glass, '容器材质是 Ultrathin，是玻璃').toBe(true);
  });

  test('圆点：8px，两个颜色正好落在既有 token 上', async ({ page }) => {
    /**
     * [实测] 未选中 #3c3c43 @ 0.30 —— 那正是 `--lg-label-tertiary`；
     * 选中 #000000 —— `--lg-label-primary`。
     * 所以这个组件**没有新增任何颜色 token**，这条钉住这件事。
     */
    await open(page, 'pagination');
    const m = await page.getByTestId('pg-static').evaluate((el) => {
      const dots = [...el.querySelectorAll('[data-slot="pagination-dot"] > span')];
      return {
        sizes: dots.map((d) => d.getBoundingClientRect().width),
        inactive: getComputedStyle(dots[0]!).backgroundColor,
        active: getComputedStyle(dots[2]!).backgroundColor,
      };
    });
    expect(m.sizes.every((s) => Math.abs(s - 8) < 0.15), '全是 8').toBe(true);
    expect(m.inactive).toBe('rgba(60, 60, 67, 0.3)');
    expect(m.active).toBe('rgb(0, 0, 0)');
  });

  test('溢出：三档点尺寸 8 / 6 / 4 都出现', async ({ page }) => {
    await open(page, 'pagination');
    const sizes = await page
      .getByTestId('pg-overflow')
      .evaluate((el) =>
        [...el.querySelectorAll('[data-slot="pagination-dot"] > span')].map(
          (d) => Math.round(d.getBoundingClientRect().width * 10) / 10,
        ),
      );
    expect(new Set(sizes), '三档尺寸都该出现').toEqual(new Set([8, 6, 4]));
    // 当前页两侧对称：中间一段是 8，越往外越小
    const mid = sizes[Math.floor(sizes.length / 2)];
    expect(mid, '当前页附近是全尺寸').toBe(8);
    expect(sizes[0], '最外侧是最小档').toBe(4);
  });

  test('页数不多时不出现小点', async ({ page }) => {
    await open(page, 'pagination');
    const sizes = await page
      .getByTestId('pg-static')
      .evaluate((el) =>
        [...el.querySelectorAll('[data-slot="pagination-dot"] > span')].map(
          (d) => Math.round(d.getBoundingClientRect().width),
        ),
      );
    expect(new Set(sizes)).toEqual(new Set([8]));
  });

  test('默认是纯指示器（不可聚焦）；传了 onPageChange 才是按钮', async ({ page }) => {
    /**
     * UIPageControl 点不中单个圆点（8pt 点、16pt 节距，远小于 44）。
     * 所以本库默认渲染成不可聚焦的指示器 —— 见组件头部最后一条。
     */
    await open(page, 'pagination');
    const staticTag = await page
      .getByTestId('pg-static')
      .evaluate((el) => el.querySelector('[data-slot="pagination-dot"]')!.tagName);
    const liveTag = await page
      .getByTestId('pg-live')
      .evaluate((el) => el.querySelector('[data-slot="pagination-dot"]')!.tagName);
    expect(staticTag).toBe('SPAN');
    expect(liveTag).toBe('BUTTON');
  });

  test('可点时：点一个点会换页，且命中区只在竖直方向撑到 44', async ({ page }) => {
    await open(page, 'pagination');
    const live = page.getByTestId('pg-live');
    const dots = live.locator('[data-slot="pagination-dot"]');
    await expect(dots.nth(2)).toHaveAttribute('aria-current', 'true');

    await dots.nth(4).click();
    await expect(dots.nth(4)).toHaveAttribute('aria-current', 'true');
    await expect(dots.nth(2)).not.toHaveAttribute('aria-current', 'true');

    const hit = await dots.nth(0).evaluate((el) => ({
      h: getComputedStyle(el, '::before').height,
      w: getComputedStyle(el, '::before').width,
      own: el.getBoundingClientRect().width,
    }));
    expect(hit.h, '竖直方向撑到 44').toBe('44px');
    // 水平方向仍是节距，撑满会让相邻两点重叠
    expect(parseFloat(hit.w)).toBeCloseTo(hit.own, 1);
  });

  test('nav 有名字；单页时也不塌', async ({ page }) => {
    await open(page, 'pagination');
    await expect(page.getByTestId('pg-static')).toHaveAttribute(
      'aria-label',
      '第 3 页，共 5 页',
    );
    const n = await page
      .getByTestId('pg-single')
      .evaluate((el) => el.querySelectorAll('[data-slot="pagination-dot"]').length);
    expect(n).toBe(1);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Breadcrumb —— 没有几何可钉，只钉语义
   ══════════════════════════════════════════════════════════════════════ */

test.describe('Breadcrumb', () => {
  test('当前页是 span + aria-current，**不是链接**', async ({ page }) => {
    /**
     * 这是面包屑最常见的无障碍错误：把当前页也做成可点的链接。
     * 资源里没有几何可量，但这条对错分明。
     */
    await open(page, 'breadcrumb');
    const cur = page.getByTestId('bc-current');
    await expect(cur).toHaveAttribute('aria-current', 'page');
    expect(await cur.evaluate((el) => el.tagName)).toBe('SPAN');
  });

  test('分隔符与省略号不进无障碍树', async ({ page }) => {
    await open(page, 'breadcrumb');
    const seps = page.locator('[data-slot="breadcrumb-separator"]');
    expect(await seps.count()).toBeGreaterThan(0);
    for (const attr of ['aria-hidden', 'role']) {
      const vals = await seps.evaluateAll((els, a) => els.map((e) => e.getAttribute(a)), attr);
      expect(new Set(vals).size, `所有分隔符的 ${attr} 应当一致`).toBe(1);
    }
    await expect(seps.first()).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByTestId('bc-ellipsis')).toHaveAttribute('aria-hidden', 'true');
  });

  test('nav 有名字，列表是 ol', async ({ page }) => {
    await open(page, 'breadcrumb');
    await expect(page.locator('[data-slot="breadcrumb"]')).toHaveAttribute('aria-label', '面包屑');
    expect(
      await page.locator('[data-slot="breadcrumb-list"]').evaluate((el) => el.tagName),
    ).toBe('OL');
  });

  test('每一级至少 44 高 —— 点得中', async ({ page }) => {
    await open(page, 'breadcrumb');
    const hs = await page
      .locator('[data-slot="breadcrumb-item"]')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(Math.min(...hs)).toBeGreaterThanOrEqual(44);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   ContextMenu —— 与 DropdownMenu 同一块面板 + 压暗层
   ══════════════════════════════════════════════════════════════════════ */

test.describe('ContextMenu', () => {
  const openMenu = async (page: Page) => {
    await open(page, 'context-menu');
    await page.locator('[data-slot="context-menu-trigger"]').click({ button: 'right' });
    await expect(page.locator('[data-slot="context-menu-content"]')).toBeVisible();
  };

  test('右键打开；面板复用 DropdownMenu 的实测几何', async ({ page }) => {
    /**
     * 面板宽 250、圆角 34、菜单项高 40 —— 这些常量是 **import 来的**，
     * 不是抄的一份。iOS Context Menu 与 Edit Menu 两个互不相关的节点
     * 给出同一组数（apple-metrics §12.2），所以复用是有依据的。
     */
    await openMenu(page);
    const m = await page
      .locator('[data-slot="context-menu-content"]')
      .evaluate((el) => {
        const s = el.querySelector('.lg-surface')!;
        const item = el.querySelector('[data-slot="context-menu-item"]')!;
        return {
          w: s.getBoundingClientRect().width,
          radius: getComputedStyle(s).borderTopLeftRadius,
          pad: getComputedStyle(s).paddingLeft,
          itemH: item.getBoundingClientRect().height,
          sepH: el.querySelector('[data-slot="context-menu-separator"]')!.getBoundingClientRect()
            .height,
        };
      });
    expect(m.w, '[实测] 250').toBeCloseTo(250, 0);
    expect(m.radius, '[实测] 34').toBe('34px');
    expect(m.pad, '[实测] 16').toBe('16px');
    expect(m.itemH, '[实测] 40').toBeCloseTo(40, 1);
    expect(m.sepH, '[实测] 分隔区 21').toBeCloseTo(21, 1);
  });

  test('背景压暗层：#000000 @ 0.23，且**不吃指针事件**', async ({ page }) => {
    /**
     * [实测] 节点 128:76929 —— 纯色压暗，**没有模糊**（那个节点的 effects 是空的）。
     *
     * 不吃指针事件是硬要求：Radix 靠外层的 dismissable layer 处理
     * 「点外面关掉」，压暗层如果拦截指针，那套逻辑就失灵了。
     */
    await openMenu(page);
    const m = await page.locator('[data-slot="context-menu-scrim"]').evaluate((el) => ({
      bg: getComputedStyle(el).backgroundColor,
      pointer: getComputedStyle(el).pointerEvents,
      filter: getComputedStyle(el).backdropFilter,
    }));
    expect(m.bg).toBe('rgba(0, 0, 0, 0.23)');
    expect(m.pointer).toBe('none');
    expect(m.filter, '实测里没有模糊').toBe('none');
  });

  test('点外面能关掉（压暗层没挡住 dismissable layer）', async ({ page }) => {
    await openMenu(page);
    await page.mouse.click(5, 5);
    await expect(page.locator('[data-slot="context-menu-content"]')).toHaveCount(0);
  });

  test('Escape 关掉；破坏性项是红的', async ({ page }) => {
    await openMenu(page);
    const del = page.getByTestId('cm-delete');
    const color = await del.evaluate((el) => getComputedStyle(el).color);
    const normal = await page.getByTestId('cm-open').evaluate((el) => getComputedStyle(el).color);
    expect(color).not.toBe(normal);
    await expect(del).toHaveAttribute('data-destructive', 'true');

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-slot="context-menu-content"]')).toHaveCount(0);
  });

  test('键盘：方向键在项间移动', async ({ page }) => {
    await openMenu(page);
    await page.keyboard.press('ArrowDown');
    const first = page.locator('[data-slot="context-menu-item"]').first();
    await expect(first).toHaveAttribute('data-highlighted', '');
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Resizable —— 没有规格，只钉行为
   ══════════════════════════════════════════════════════════════════════ */

test.describe('Resizable', () => {
  test('分隔条：线 1px、命中区 8px', async ({ page }) => {
    /**
     * ⚠️ 两个数都是 `[推定]` —— 资源里那张 Split View 只有布局，没有分隔条。
     * 钉它们不是在固化 Apple 的值，是防止实现漂移。
     *
     * 1px 这条同时是**回归**：把手第一版留在流里，flex 项的
     * `min-width: auto` 把 3px 的把手当成最小内容宽，分隔线被撑成 3px。
     */
    await open(page, 'resizable');
    const m = await page.locator('[data-slot="resizable-handle"]').evaluate((el) => ({
      w: el.getBoundingClientRect().width,
      hit: getComputedStyle(el, '::after').width,
      grip: el.querySelector('[data-slot="resizable-grip"]')
        ? getComputedStyle(el.querySelector('[data-slot="resizable-grip"]')!).position
        : null,
    }));
    expect(m.w, '分隔线 1px，不能被把手撑宽').toBeCloseTo(1, 1);
    expect(m.hit, '命中区 8px').toBe('8px');
    expect(m.grip, '把手必须绝对定位，否则会撑宽分隔线').toBe('absolute');
  });

  test('可聚焦，且有 separator 语义与当前值', async ({ page }) => {
    await open(page, 'resizable');
    const h = page.locator('[data-slot="resizable-handle"]');
    await expect(h).toHaveAttribute('role', 'separator');
    await expect(h).toHaveAttribute('tabindex', '0');
    await expect(h).toHaveAttribute('aria-valuenow', /\d/);
  });

  test('键盘能调整分栏 —— 触屏拖不动时的唯一出路', async ({ page }) => {
    /**
     * 命中区只有 8pt，够不到 HIG 的 44（理由见组件头部）。
     * 代偿就是这条键盘路径，所以它必须真的能用。
     */
    await open(page, 'resizable');
    const h = page.locator('[data-slot="resizable-handle"]');
    const before = await h.getAttribute('aria-valuenow');
    await h.focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(120);
    const after = await h.getAttribute('aria-valuenow');
    expect(Number(after)).toBeGreaterThan(Number(before));
  });

  test('分隔条上没有玻璃', async ({ page }) => {
    // 1px 宽的东西上任何模糊都看不出来，只会白占一个折射预算
    await open(page, 'resizable');
    expect(await page.locator('[data-slot="resizable-handle"] .lg-surface').count()).toBe(0);
  });
});
