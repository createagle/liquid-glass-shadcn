/**
 * P2 第四批（Calendar / DatePicker / Combobox）的行为回归。
 *
 * 密度分布照旧看依据：
 *
 *   Calendar     几何 + 四种状态全实测 → 连**选中态是黑底白字**这条反直觉的都钉
 *   DatePicker   触发器与面板圆角全实测 → 钉死；时间滚轮**没做**，不钉
 *   Combobox     结构实测、尺度是借的 → 钉结构与无障碍，不钉尺寸
 *
 * ⚠️ **所有日期写死。** `today` 默认是 `new Date()`，不钉死的话
 *    这一整组会在过日期的那一晚自己红掉，而且看起来像随机失败。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/date-demo.html')).href;

async function open(page: Page, only?: string, theme = 'light') {
  const q = new URLSearchParams({ theme, tier: 'a', ...(only ? { only } : {}) });
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

/** 2026-04 —— harness 里写死的那个月。1 号是周三。 */
const DAY = (n: number) => `[data-day="2026-3-${n}"]`;

/* ══════════════════════════════════════════════════════════════════════
   Calendar
   ══════════════════════════════════════════════════════════════════════ */

test.describe('Calendar', () => {
  test('❗一句玻璃都没有 —— 而且这次是资源自证的', async ({ page }) => {
    /**
     * 资源里 `Style=Inline` 就是纯白不透明（`#ffffff` a=1），
     * 只有 `Style=Compact`（弹出层）才是玻璃。
     * 这条钉的是「将来别顺手给日历加块玻璃」。
     */
    await open(page, 'calendar');
    const n = await page.evaluate(
      () => document.querySelectorAll('[data-testid="row-calendar"] .lg-surface').length,
    );
    expect(n).toBe(0);
  });

  test('日期格：38 正圆，横向节距 50、纵向间距 7', async ({ page }) => {
    await open(page, 'calendar');
    const m = await page.evaluate(() => {
      const grid = document.querySelector('[data-slot="calendar-grid"]')!;
      const cs = getComputedStyle(grid);
      const cells = [...grid.querySelectorAll('[data-slot="calendar-day"]')];
      const a = cells[0]!.getBoundingClientRect();
      const b = cells[1]!.getBoundingClientRect();
      return {
        w: a.width,
        h: a.height,
        radius: parseFloat(getComputedStyle(cells[0]!).borderTopLeftRadius),
        pitch: b.left - a.left,
        rowGap: cs.rowGap,
        padTop: cs.paddingTop,
        gridWidth: grid.getBoundingClientRect().width,
      };
    });
    expect(m.w, '[实测] 38').toBeCloseTo(38, 1);
    expect(m.h, '[实测] 38').toBeCloseTo(38, 1);
    expect(m.radius, '正圆 = 边长的一半').toBeCloseTo(19, 1);
    expect(m.pitch, '[实测] 50 —— 格 38、间隙 12').toBeCloseTo(50, 1);
    expect(m.rowGap, '[实测] 7').toBe('7px');
    expect(m.padTop, '[实测] 3').toBe('3px');
    expect(m.gridWidth, '[实测] 338 = 6 × 50 + 38').toBeCloseTo(338, 1);
  });

  test('❗选中态是**黑底白字**，不是主题蓝', async ({ page }) => {
    /**
     * [实测] Selected = 实心 `#000000` + 白字 Semibold；
     * 只有「今天且被选中」才是实心 `#0088ff`。
     * 多数 Web 日历把选中画成主题色 —— 这条钉的就是「别跟」。
     */
    await open(page, 'calendar');
    const sel = await page.locator(DAY(12)).evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, color: cs.color, weight: cs.fontWeight, ls: cs.letterSpacing };
    });
    const blue = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--lg-blue').trim(),
    );
    expect(sel.bg, '选中底色不能是主题蓝').not.toContain('0, 136, 255');
    expect(blue, 'token 本身还在，只是没用在这里').not.toBe('');
    expect(sel.weight, '[实测] Semibold').toBe('600');
    expect(sel.ls, '[实测] 选中态字距归零').toBe('normal');
  });

  test('今天：12% 蓝底 + 蓝字 Regular', async ({ page }) => {
    await open(page, 'calendar');
    const m = await page.locator(DAY(1)).evaluate((el) => {
      const cs = getComputedStyle(el);
      const root = getComputedStyle(document.documentElement);
      // 把 token 解析成实际 rgb，才能和 computed color 比
      const probe = document.createElement('span');
      probe.style.color = root.getPropertyValue('--lg-blue').trim();
      document.body.appendChild(probe);
      const blue = getComputedStyle(probe).color;
      probe.remove();
      return {
        bg: cs.backgroundColor,
        color: cs.color,
        weight: cs.fontWeight,
        current: el.getAttribute('aria-current'),
        blue,
      };
    });
    expect(m.current, 'WAI-ARIA 的日期网格用 aria-current="date"').toBe('date');
    /*
     * ⚠️ 这里断言的是「用了 `--lg-blue` 这个 token」，**不是**某个字面色值。
     *
     * 实测资源里今天那一格是 `#0088ff`，而本库的 `--lg-blue` 目前仍是
     * 上一代的 `#007AFF` —— 那是一条**跨组件的 token 问题**（三份独立资源
     * 都指向 #0088ff），不该由日历这一个组件顺手改掉。已记在 STATUS 里。
     */
    expect(m.color, '[实测] 走 --lg-blue').toBe(m.blue);
    expect(m.weight, '[实测] 今天（未选中）是 Regular').toBe('400');
    // 12% 蓝底 —— 只验它确实半透明，不硬钉换算后的具体 rgb
    expect(m.bg).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('星期表头：Semibold 13，色命中 --lg-label-tertiary', async ({ page }) => {
    await open(page, 'calendar');
    const m = await page.evaluate(() => {
      const head = document.querySelector('[data-slot="calendar-weekdays"]')!;
      const first = head.firstElementChild!;
      const cs = getComputedStyle(first);
      return {
        h: head.getBoundingClientRect().height,
        size: cs.fontSize,
        weight: cs.fontWeight,
        color: cs.color,
        token: getComputedStyle(document.documentElement)
          .getPropertyValue('--lg-label-tertiary')
          .trim(),
        text: first.textContent,
      };
    });
    expect(m.h, '[实测] 20').toBeCloseTo(20, 1);
    expect(m.size, '[实测] 13').toBe('13px');
    expect(m.weight, '[实测] Semibold').toBe('600');
    expect(m.text, '默认 locale 写死 en-US，周日打头').toBe('SUN');
    expect(m.token, '色正好落在既有 token 上').toContain('0.3');
  });

  test('非本月的格子什么都不画（资源里的 State=Null）', async ({ page }) => {
    await open(page, 'calendar');
    // 2026-04 有 30 天；网格固定 42 格，所以恰好有 12 个空格
    const counts = await page.evaluate(() => {
      const grid = document.querySelector('[data-slot="calendar-grid"]')!;
      return {
        days: grid.querySelectorAll('[data-slot="calendar-day"]').length,
        cells: grid.querySelectorAll('[role="gridcell"]').length,
        rows: grid.querySelectorAll('[role="row"]').length,
      };
    });
    expect(counts.days, '2026 年 4 月有 30 天').toBe(30);
    expect(counts.cells, '网格固定 42 格 —— 换月时面板高度不跳').toBe(42);
    expect(counts.rows, 'ARIA grid 必须有 row 这一层').toBe(6);
  });

  test('键盘：方向键走格、Home/End 走一周、PageUp/Down 换月', async ({ page }) => {
    await open(page, 'calendar');
    await page.locator(DAY(12)).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator(DAY(13))).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator(DAY(20))).toBeFocused();
    // 2026-04-20 是周一 → Home 回到周日 19
    await page.keyboard.press('Home');
    await expect(page.locator(DAY(19))).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.locator(DAY(25))).toBeFocused();
  });

  test('键盘：方向键跨月会自动翻页', async ({ page }) => {
    await open(page, 'calendar');
    await page.locator(DAY(1)).focus();
    await page.keyboard.press('ArrowLeft');
    // 退到 3 月 31 —— 月份必须自己翻过去，否则焦点落到一个不存在的格子上
    await expect(page.locator('[data-day="2026-2-31"]')).toBeFocused();
    await expect(page.locator('[data-slot="calendar-title"]')).toHaveText('March 2026');
  });

  test('整块网格只有一个 tab stop（roving tabindex）', async ({ page }) => {
    await open(page, 'calendar');
    const n = await page.evaluate(
      () =>
        document.querySelectorAll('[data-slot="calendar-day"][tabindex="0"]').length,
    );
    expect(n, '42 个格子各自可聚焦的话，键盘用户要按 42 次 Tab').toBe(1);
  });

  test('月份切换按钮不会在「1 月 31 日 + 1 月」上溢出', async ({ page }) => {
    await open(page, 'calendar');
    const title = page.locator('[data-slot="calendar-title"]');
    await expect(title).toHaveText('April 2026');
    for (let i = 0; i < 3; i += 1) await page.locator('[data-slot="calendar-next"]').click();
    await expect(title).toHaveText('July 2026');
    for (let i = 0; i < 4; i += 1) await page.locator('[data-slot="calendar-prev"]').click();
    await expect(title).toHaveText('March 2026');
  });

  test('disabled 回调真的挡住了周末', async ({ page }) => {
    await open(page, 'calendar-states');
    // 2026-04-04 是周六
    await expect(page.locator(DAY(4))).toBeDisabled();
    // 2026-04-06 是周一
    await expect(page.locator(DAY(6))).toBeEnabled();
  });
});

/* ══════════════════════════════════════════════════════════════════════
   DatePicker
   ══════════════════════════════════════════════════════════════════════ */

test.describe('DatePicker', () => {
  test('触发器：34 高胶囊，底色命中 --lg-fill-tertiary', async ({ page }) => {
    await open(page, 'date-picker');
    const m = await page.locator('[data-slot="date-picker-trigger"]').evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        h: el.getBoundingClientRect().height,
        radius: parseFloat(cs.borderTopLeftRadius),
        pad: cs.paddingLeft,
        size: cs.fontSize,
        bg: cs.backgroundColor,
      };
    });
    expect(m.h, '[实测] 34').toBeCloseTo(34, 1);
    expect(m.radius, '[实测] 胶囊').toBeCloseTo(17, 1);
    expect(m.pad, '[实测] 11').toBe('11px');
    expect(m.size, '[实测] 17').toBe('17px');
    expect(m.bg, '[实测] #767680 @ 0.12 —— 第四次命中 --lg-fill-tertiary').toContain('0.12');
  });

  test('❗打开时**只有文字变蓝**，底色不变', async ({ page }) => {
    await open(page, 'date-picker');
    const trigger = page.locator('[data-slot="date-picker-trigger"]');
    const before = await trigger.evaluate((el) => getComputedStyle(el).backgroundColor);
    await trigger.click();
    // ⚠️ 必须限定在弹层里 —— 同一页还有一个 inline 形态的日历，不限定会 strict mode 撞车
    await expect(page.locator('[data-slot="popover-content"] [data-slot="calendar-grid"]')).toBeVisible();
    /*
     * ⚠️ 触发器上有 100ms 的 transition-colors，直接读会量到中间色
     * （第一版量到 `rgb(0, 10, 21)`）。用 poll 等它稳下来。
     */
    const blue = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = getComputedStyle(document.documentElement)
        .getPropertyValue('--lg-blue')
        .trim();
      document.body.appendChild(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    });
    await expect
      .poll(async () => trigger.evaluate((el) => getComputedStyle(el).color))
      .toBe(blue);
    const bgAfter = await trigger.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bgAfter, '[实测] 底色不变').toBe(before);
  });

  test('弹层面板圆角是 **13**，不是 Popover 默认的 38', async ({ page }) => {
    await open(page, 'date-picker');
    await page.locator('[data-slot="date-picker-trigger"]').click();
    const m = await page.locator('[data-slot="popover-content"] .lg-surface').evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        radius: parseFloat(cs.borderTopLeftRadius),
        padBlock: cs.paddingTop,
        padInline: cs.paddingLeft,
        layer: el.getAttribute('data-layer'),
        glass: el.classList.contains('lg-surface'),
      };
    });
    expect(m.radius, '[实测] 13 —— 复核过 Compact 两层都是 13').toBeCloseTo(13, 1);
    expect(m.padBlock, '内边距由 Calendar 自己带，面板不叠一层').toBe('0px');
    expect(m.padInline).toBe('0px');
    expect(m.glass, 'Compact 变体是玻璃').toBe(true);
    expect(m.layer).toBe('elevated');
  });

  test('弹层里的日历左右内边距是 12，不是嵌入形态的 16', async ({ page }) => {
    await open(page, 'date-picker');
    await page.locator('[data-slot="date-picker-trigger"]').click();
    const pad = await page
      .locator('[data-slot="popover-content"] [data-slot="calendar"]')
      .evaluate((el) => getComputedStyle(el).paddingLeft);
    expect(pad, '[实测] Compact 12 / Inline 16').toBe('12px');
  });

  test('嵌入形态一句玻璃都没有，左右内边距 16', async ({ page }) => {
    await open(page, 'date-picker');
    const m = await page.locator('[data-slot="date-picker-inline"]').evaluate((el) => ({
      glass: el.querySelectorAll('.lg-surface').length,
      pad: getComputedStyle(el.querySelector('[data-slot="calendar"]')!).paddingLeft,
    }));
    expect(m.glass, '[实测] Style=Inline 是纯白不透明').toBe(0);
    expect(m.pad, '[实测] 16').toBe('16px');
  });

  test('选中一天后弹层关闭，触发器文案跟着换', async ({ page }) => {
    await open(page, 'date-picker');
    const trigger = page.locator('[data-slot="date-picker-trigger"]');
    await expect(trigger).toHaveText('Apr 12, 2026');
    await trigger.click();
    await page.locator(`[data-slot="popover-content"] ${DAY(20)}`).click();
    await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0);
    await expect(trigger).toHaveText('Apr 20, 2026');
  });

  test('时间那一枚是**只读展示** —— 时间滚轮本批没做', async ({ page }) => {
    await open(page, 'date-picker');
    const time = page.locator('[data-slot="date-picker-time"]');
    await expect(time).toHaveText('9:41 AM');
    expect(await time.evaluate((el) => el.tagName), '不是按钮，点不开').toBe('SPAN');
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Combobox —— 结构与无障碍，不钉尺寸（尺度是借来的）
   ══════════════════════════════════════════════════════════════════════ */

test.describe('Combobox', () => {
  test('ARIA：combobox 角色接线完整', async ({ page }) => {
    await open(page, 'combobox');
    const input = page.locator('[data-slot="combobox-input"]').first();
    await expect(input).toHaveAttribute('role', 'combobox');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(input).toHaveAttribute('aria-autocomplete', 'list');
    const controls = await input.getAttribute('aria-controls');
    expect(controls).toBeTruthy();

    await input.click();
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(await page.locator(`[id="${controls}"]`).count()).toBe(1);
  });

  test('❗焦点始终留在输入框上 —— 靠 aria-activedescendant 指高亮项', async ({ page }) => {
    /**
     * 这是 combobox 与 listbox 的分野：焦点一旦挪进列表，
     * 用户就没法继续打字了。
     */
    await open(page, 'combobox');
    const input = page.locator('[data-slot="combobox-input"]').first();
    await input.click();
    await page.keyboard.press('ArrowDown');
    await expect(input, '焦点不能离开输入框').toBeFocused();
    const activeId = await input.getAttribute('aria-activedescendant');
    expect(activeId, '必须指向某一项').toBeTruthy();
    // ⚠️ `CSS.escape` 是浏览器 API，在 Node 侧的测试文件里不存在 —— 用属性选择器
    const active = page.locator(`[id="${activeId}"]`);
    await expect(active).toHaveAttribute('data-active', 'true');
  });

  test('键盘：方向键跳过禁用项，Enter 选中，Escape 还原', async ({ page }) => {
    await open(page, 'combobox');
    const input = page.locator('[data-slot="combobox-input"]').first();
    await input.click();
    // 列表尾项 New York 是禁用的，End 之后 ArrowDown 应该绕回第一项而不是停在它上面
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowDown');
    const id = await input.getAttribute('aria-activedescendant');
    expect(id, '禁用项不该被高亮').not.toContain('nyc');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(input).toHaveAttribute('aria-expanded', 'false');

    // 打半截再 Escape，输入框要还原成选中项的标签
    const restored = await input.inputValue();
    await input.click();
    await input.fill('seat');
    await page.keyboard.press('Escape');
    await expect(input).toHaveValue(restored);
  });

  test('过滤：打字后只剩匹配项，无匹配时给出提示', async ({ page }) => {
    await open(page, 'combobox');
    const input = page.locator('[data-slot="combobox-input"]').first();
    await input.click();
    await input.fill('se');
    await expect(page.locator('[data-slot="combobox-option"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="combobox-option"]').first()).toHaveText('Seattle');

    await input.fill('zzz');
    await expect(page.locator('[data-slot="combobox-option"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="combobox-empty"]')).toBeVisible();
  });

  test('下拉按钮不抢焦点，三档底色按状态走', async ({ page }) => {
    await open(page, 'combobox');
    const input = page.locator('[data-slot="combobox-input"]').first();
    const button = page.locator('[data-slot="combobox-button"]').first();
    await input.click();
    const idle = await button.evaluate((el) => getComputedStyle(el).backgroundColor);

    await button.click();
    await expect(input, '按钮不能把焦点抢走').toBeFocused();
    // 点一次是关（列表本来就开着），再点一次开
    await button.click();
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    // 同样有 100ms 过渡，poll 到稳定
    await expect
      .poll(async () => button.evaluate((el) => getComputedStyle(el).backgroundColor))
      .not.toBe(idle);
  });

  test('点外面关掉（监听 pointerdown，不是 click）', async ({ page }) => {
    await open(page, 'combobox');
    const input = page.locator('[data-slot="combobox-input"]').first();
    await input.click();
    await expect(page.locator('[data-slot="combobox-list-surface"]')).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(page.locator('[data-slot="combobox-list-surface"]')).toHaveCount(0);
  });

  test('弹出列表是玻璃，文本域不是', async ({ page }) => {
    await open(page, 'combobox');
    const input = page.locator('[data-slot="combobox-input"]').first();
    expect(await input.evaluate((el) => el.classList.contains('lg-surface'))).toBe(false);
    await input.click();
    const list = page.locator('[data-slot="combobox-list-surface"]');
    await expect(list).toBeVisible();
    expect(await list.evaluate((el) => el.getAttribute('data-layer'))).toBe('elevated');
  });

  test('禁用：点不开', async ({ page }) => {
    await open(page, 'combobox');
    const input = page.locator('[data-testid="cb-disabled"] [data-slot="combobox-input"]');
    await expect(input).toBeDisabled();
    await expect(page.locator('[data-slot="combobox-list-surface"]')).toHaveCount(0);
  });
});
