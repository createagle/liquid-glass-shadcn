/**
 * Phase 7 收尾（Checkbox / Radio Group）的行为回归。
 *
 * 与第三批（Tooltip / Toast / InputGroup）正好相反：**这一批的几何值得钉。**
 * 36 个变体逐条量自 macOS 27 设计资源（apple-metrics.md §10.2 / §10.3），
 * 方框 16、圆角 5.5、间距 3、标签 13/16、圆点 4.8 —— 全部有来源，
 * 断言它们不是在固化推定值，是在防漂移。
 *
 * 另有一条别处没有的断言：**子树里的 .lg-surface 计数必须是 0。**
 * Apple 自己的复选框没有玻璃，本库据此改了清单的分层判断
 * （component-inventory.md「修订三」）。那条结论必须有测试守着，
 * 否则下一个人「顺手加点材质」就把它悄悄推翻了。
 */

import { test, expect, type Page, type Browser } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/toggles2-demo.html')).href;

function url(opts: { only?: string; theme?: string; tier?: string; bg?: string } = {}) {
  const q = new URLSearchParams({
    theme: opts.theme ?? 'light',
    tier: opts.tier ?? 'a',
    ...(opts.only ? { only: opts.only } : {}),
    ...(opts.bg ? { bg: opts.bg } : {}),
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

/**
 * 等某个元素的底色**不再变化**。
 *
 * ⚠️ 为什么需要这个：`__ready` 是在 `queueMicrotask` 里置位的，
 * 早于 Provider 挂载后那个「把系统偏好（暗色 / 高对比 / 减弱动效）
 * 写到 `<html>`」的 effect。属性一翻，底色要沿 150ms 的
 * background-color 过渡爬过去 —— 在那之前读，读到的是半路上的值。
 *
 * 第一版的高对比断言就是这么红的：期望 0.34，量到 0.14。
 * **不是组件不对，是读早了。**
 *
 * 用「连续 5 帧同值」而不是死等一个毫秒数：不看时钟，机器慢也不抖。
 */
async function settle(page: Page, testId: string, prop: 'backgroundColor' | 'boxShadow' = 'backgroundColor') {
  await page.waitForFunction(
    ({ id, prop: p }: { id: string; prop: string }) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el) return false;
      const cur = (getComputedStyle(el) as unknown as Record<string, string>)[p];
      const w = window as unknown as { __prev?: string; __same?: number };
      if (w.__prev === cur) w.__same = (w.__same ?? 0) + 1;
      else {
        w.__prev = cur;
        w.__same = 0;
      }
      return (w.__same ?? 0) >= 5;
    },
    { id: testId, prop },
    { polling: 'raf', timeout: 5000 },
  );
}

/** 几何断言用的容差：亚像素缩放与 squircle 近似都会带来零点几 px 的偏差 */
const EPS = 0.15;

/* ══════════════════════════════════════════════════════════════════════
   Checkbox
   ══════════════════════════════════════════════════════════════════════ */

test.describe('Checkbox', () => {
  test('几何：方框 16、间距 3、标签 13/16 —— 全是实测值', async ({ page }) => {
    await open(page, { only: 'checkbox' });
    const box = page.getByTestId('cb-unchecked');
    const m = await box.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const id = el.getAttribute('aria-labelledby')!;
      const span = document.getElementById(id)!;
      const sr = span.getBoundingClientRect();
      const cs = getComputedStyle(span);
      return {
        w: r.width,
        h: r.height,
        gap: sr.left - r.right,
        fontSize: parseFloat(cs.fontSize),
        lineHeight: parseFloat(cs.lineHeight),
      };
    });
    expect(m.w, '方框宽 [实测] 16').toBeCloseTo(16, 1);
    expect(m.h, '方框高 [实测] 16').toBeCloseTo(16, 1);
    expect(Math.abs(m.gap - 3), '方框↔标签 [实测] 3').toBeLessThan(EPS);
    expect(m.fontSize, '标签字号 [实测] 13').toBeCloseTo(13, 1);
    expect(m.lineHeight, '标签行高 [实测] 16').toBeCloseTo(16, 1);
  });

  test('几何按 size 成比例缩放', async ({ page }) => {
    await open(page, { only: 'checkbox' });
    const m = await page.getByTestId('cb-large').evaluate((el) => {
      const r = el.getBoundingClientRect();
      const span = document.getElementById(el.getAttribute('aria-labelledby')!)!;
      return {
        w: r.width,
        fontSize: parseFloat(getComputedStyle(span).fontSize),
        radius: parseFloat(getComputedStyle(el).borderTopLeftRadius),
      };
    });
    // 24 / 16 = 1.5 倍
    expect(m.w).toBeCloseTo(24, 1);
    expect(m.fontSize, '13 × 1.5').toBeCloseTo(19.5, 1);
    const base = await page.getByTestId('cb-unchecked').evaluate((el) =>
      parseFloat(getComputedStyle(el).borderTopLeftRadius),
    );
    expect(m.radius / base, '圆角同样按比例').toBeCloseTo(1.5, 1);
  });

  test('三态各自的底色都走 token，且互不相同', async ({ page }) => {
    await open(page, { only: 'checkbox' });
    const bg = (id: string) =>
      page.getByTestId(id).evaluate((el) => getComputedStyle(el).backgroundColor);

    const unchecked = await bg('cb-unchecked');
    const checked = await bg('cb-checked');
    const mixed = await bg('cb-mixed');
    const disabled = await bg('cb-disabled');

    // [实测] 未选中 = #000000 @ 0.10
    expect(unchecked).toBe('rgba(0, 0, 0, 0.1)');
    // [实测] 禁用未选中 = #000000 @ 0.05（**换底色**，不是降不透明度）
    expect(disabled).toBe('rgba(0, 0, 0, 0.05)');
    // 选中与半选是同一块实心强调色
    expect(checked).toBe(mixed);
    expect(checked).not.toBe(unchecked);
  });

  test('禁用 + 未选中**不叠**不透明度 —— 叠了会压成看不见', async ({ page }) => {
    /**
     * 实测里这两件事是分开的：未选中的禁用靠换底色（0.10 → 0.05），
     * 只有**选中**的禁用才整体降到 45%。
     * 若两个一起上，0.05 再乘 0.45 就彻底没了。
     */
    await open(page, { only: 'checkbox' });
    const op = (id: string) =>
      page.getByTestId(id).evaluate((el) => getComputedStyle(el).opacity);
    expect(await op('cb-disabled'), '禁用未选中不该降不透明度').toBe('1');
    expect(Number(await op('cb-disabled-checked')), '禁用已选降到 0.45').toBeCloseTo(0.45, 2);
  });

  test('三态的 aria-checked 正确', async ({ page }) => {
    await open(page, { only: 'checkbox' });
    await expect(page.getByTestId('cb-unchecked')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('cb-checked')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('cb-mixed')).toHaveAttribute('aria-checked', 'mixed');
  });

  test('有标签时自动补 aria-labelledby —— <button> 不从 <label> 取名字', async ({ page }) => {
    /**
     * 这是本组件最容易错的一处。Radix 的根节点是
     * `<button role="checkbox">`，里面只有一个 aria-hidden 的 svg。
     * 而 HTML 的「label 关联」只对 input / select / textarea 生效，
     * **button 从内容取名** —— 不显式关联的话无障碍名是空的。
     */
    await open(page, { only: 'checkbox' });
    const el = page.getByTestId('cb-unchecked');
    const labelledby = await el.getAttribute('aria-labelledby');
    expect(labelledby, '应当自动补上关联').toBeTruthy();
    const text = await page.locator(`#${labelledby}`).textContent();
    expect(text).toBe('未选');
  });

  test('调用方自己给了 aria-label 时不覆盖', async ({ page }) => {
    await open(page, { only: 'checkbox' });
    const bare = page.getByTestId('cb-bare');
    await expect(bare).toHaveAttribute('aria-label', '没有可见标签的复选框');
    expect(await bare.getAttribute('aria-labelledby'), '不该再补一个').toBeNull();
  });

  test('点标签能切换，而且**只切换一次**', async ({ page }) => {
    /**
     * `<label>` 包着 `<button>` 时，浏览器会把点击转发给被标注的控件。
     * 直接点方框本身则不该再转发一次 —— 否则一次点击变成两次切换，
     * 状态看起来「没反应」。这条同时钉住两个方向。
     */
    await open(page, { only: 'checkbox' });
    const box = page.getByTestId('cb-unchecked');
    const label = page.locator('[data-slot="checkbox-label"]').first();

    await label.getByText('未选').click();
    await expect(box, '点标签 → 选中').toHaveAttribute('aria-checked', 'true');

    await label.getByText('未选').click();
    await expect(box, '再点一次 → 回到未选（不是原地不动）').toHaveAttribute(
      'aria-checked',
      'false',
    );

    await box.click();
    await expect(box, '直接点方框也只切换一次').toHaveAttribute('aria-checked', 'true');
  });

  test('键盘：Space 切换，禁用项拿不到焦点', async ({ page }) => {
    await open(page, { only: 'checkbox' });
    const box = page.getByTestId('cb-unchecked');
    await box.focus();
    await page.keyboard.press('Space');
    await expect(box).toHaveAttribute('aria-checked', 'true');

    const disabled = page.getByTestId('cb-disabled');
    await expect(disabled).toBeDisabled();
  });

  test('焦点环是「形状内 1px + 形状外 3.5px」，两条都是硬边', async ({ page }) => {
    /**
     * [实测] macOS 27 的焦点环（apple-metrics.md §10.4）：
     * INNER_SHADOW spread 1 + DROP_SHADOW spread 3.5，两条 blur 都是 0。
     * 环色用 --lg-ring 而不是实测的 #0088ff —— 与本库其它组件保持一致。
     */
    await open(page, { only: 'checkbox' });
    const box = page.getByTestId('cb-unchecked');
    await box.focus();
    /*
     * ⚠️ 与高对比那条同一个坑：`box-shadow` 也在 150ms 的过渡列表里，
     * focus 之后立刻读会读到还在从 `none` 爬过来的中间值。
     *
     * 第一版的等待条件写成「不再是全透明的零阴影」—— 也不对：
     * 过渡一起步就满足了，量到的是 `0.0325px` 这种途中值。
     * 必须等它**不再变化**。
     */
    await settle(page, 'cb-unchecked', 'boxShadow');
    const shadow = await box.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow, '应当有 inset 的那一条').toContain('inset');
    // 「0px 0px 0px 3.5px」= blur 0 / spread 3.5
    expect(shadow).toMatch(/0px 0px 0px 3\.5px/);
    expect(shadow).toMatch(/0px 0px 0px 1px/);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Radio Group
   ══════════════════════════════════════════════════════════════════════ */

test.describe('RadioGroup', () => {
  test('几何：控件 16、圆点 4.8（= 边长的 30%）且居中', async ({ page }) => {
    await open(page, { only: 'radio' });
    const m = await page.getByTestId('rg-b').evaluate((el) => {
      const r = el.getBoundingClientRect();
      const dot = el.querySelector('[data-slot="radio-group-indicator"]')!;
      const dr = dot.getBoundingClientRect();
      return {
        w: r.width,
        dot: dr.width,
        dx: dr.left + dr.width / 2 - (r.left + r.width / 2),
        dy: dr.top + dr.height / 2 - (r.top + r.height / 2),
        radius: getComputedStyle(el).borderTopLeftRadius,
      };
    });
    expect(m.w).toBeCloseTo(16, 1);
    expect(m.dot, '圆点 [实测] 4.8').toBeCloseTo(4.8, 1);
    expect(Math.abs(m.dx), '水平居中').toBeLessThan(EPS);
    expect(Math.abs(m.dy), '竖直居中').toBeLessThan(EPS);
    // 圆：半径至少是边长的一半
    expect(parseFloat(m.radius)).toBeGreaterThanOrEqual(8 - EPS);
  });

  test('组内行距 [实测] 14', async ({ page }) => {
    await open(page, { only: 'radio' });
    const gap = await page
      .getByTestId('rg')
      .evaluate((el) => parseFloat(getComputedStyle(el).rowGap));
    expect(gap).toBeCloseTo(14, 1);
  });

  test('单选语义：选中一个会把另一个取消', async ({ page }) => {
    await open(page, { only: 'radio' });
    await expect(page.getByTestId('rg-b')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('rg-a').click();
    await expect(page.getByTestId('rg-a')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('rg-b')).toHaveAttribute('aria-checked', 'false');
  });

  test('键盘：方向键移动即选中（本库补的，Radix 这版不生效）', async ({ page }) => {
    /**
     * ARIA APG 要求 radiogroup 的选中状态随焦点移动。
     * @radix-ui/react-radio-group 1.4.7 + React 19 下**只移焦点、不选中** ——
     * 实测排查过程写在 radio-group.tsx 的 RadioGroup 注释里
     * （不是事件顺序的锅，也不是本库 <label> 的锅，无标签对照组一样）。
     * 本库在 Root 上补了这件事，这条钉住它。
     */
    await open(page, { only: 'radio' });
    await page.getByTestId('rg-b').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('rg-c'), '方向键移动即选中').toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByTestId('rg-b'), '原来那个要让出来').toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  test('键盘：禁用项会被跳过，不会被选中', async ({ page }) => {
    await open(page, { only: 'radio' });
    await page.getByTestId('rg-c').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('rg-d'), '禁用项不该被选中').toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  test('无标签的一组也照样工作 —— 走的是不包 <label> 的分支', async ({ page }) => {
    await open(page, { only: 'radio' });
    const p = page.getByTestId('rg-bare-p');
    const q = page.getByTestId('rg-bare-q');
    await expect(p).toHaveAttribute('aria-label', '第一项');
    expect(await p.getAttribute('aria-labelledby'), '有 aria-label 就不该再补').toBeNull();
    await p.focus();
    await page.keyboard.press('ArrowDown');
    await expect(q).toHaveAttribute('aria-checked', 'true');
  });

  test('**不实现 mixed** —— 资源里画了，但单选按钮不存在部分选中', async ({ page }) => {
    /**
     * macOS 27 资源的 Radio 也有 Selection=Mixed 变体（画的是和 Checkbox
     * 一样的横杠）。那是 kit 复用同一套变体矩阵的产物，不是真实状态。
     * 这条钉住「本库没有把它照抄进来」。
     */
    await open(page, { only: 'radio' });
    const states = await page
      .locator('[data-slot="radio-group-item"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-checked')));
    expect(states.some((s) => s === 'mixed'), 'radio 不该出现 mixed').toBe(false);
  });

  test('组有名字 —— 没有名字时屏幕阅读器只会读出「单选组」', async ({ page }) => {
    await open(page, { only: 'radio' });
    await expect(page.getByTestId('rg')).toHaveAttribute('aria-label', '尺码');
    await expect(page.getByTestId('rg')).toHaveRole('radiogroup');
  });
});

/* ══════════════════════════════════════════════════════════════════════
   分层：这两个组件里**不该有玻璃**
   ══════════════════════════════════════════════════════════════════════ */

test.describe('分层（Apple 自己就没给它们玻璃）', () => {
  for (const row of ['row-checkbox', 'row-radio', 'row-in-card']) {
    test(`${row}：.lg-surface 计数为 0`, async ({ page }) => {
      /**
       * 清单原本把这两个标成 `B + I(瞬时)`，那是在没有 macOS 参考时推的。
       * 36 个变体全部导出后发现一个玻璃都没有，据此改成内容层
       * （component-inventory.md「修订三」）。
       *
       * `row-in-card` 连卡片一起数：Card 默认的 grouped 变体是
       * **不透明**区块底（实测 alpha=255），同样不该有玻璃。
       */
      await open(page, { only: row.replace('row-', '') });
      const n = await page.getByTestId(row).locator('.lg-surface').count();
      expect(n, `${row} 里不该出现玻璃`).toBe(0);
    });
  }

  test('没有折射滤镜被申请', async ({ page }) => {
    // 没有玻璃就不该消耗 PROJECT_SPEC §5.2 的 8 个折射预算
    await open(page);
    const n = await page.locator('[data-refraction]').count();
    expect(n, '不该有任何元素参与折射预算').toBe(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   无障碍偏好
   ══════════════════════════════════════════════════════════════════════ */

test.describe('无障碍偏好', () => {
  test('prefers-contrast: more —— 未选中底色显著加深', async ({ browser }: { browser: Browser }) => {
    /**
     * [实测] 的 0.10 压在白底上只有约 1.1:1，远不到「非文字对比 3:1」。
     * 高对比下必须能与背景分开 —— token 在 semantic.css 里有专门的重写。
     */
    const read = async (contrast: 'more' | 'no-preference') => {
      const ctx = await browser.newContext({ contrast });
      const page = await ctx.newPage();
      await page.goto(url({ only: 'checkbox' }));
      await ready(page);
      await settle(page, 'cb-unchecked');
      const v = await page
        .getByTestId('cb-unchecked')
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      await ctx.close();
      return v;
    };
    const normal = await read('no-preference');
    const more = await read('more');
    expect(more).not.toBe(normal);

    const alpha = (c: string) => Number(c.match(/rgba?\(([^)]+)\)/)?.[1].split(',')[3] ?? 1);
    expect(alpha(more), '高对比下不透明度应当明显更高').toBeGreaterThan(alpha(normal) * 2);
  });

  test('prefers-reduced-motion：不该有任何过渡残留', async ({ page }) => {
    /*
     * 这两个组件只有 opacity / background-color 的过渡，都很短。
     * 但 §13 要求「减弱动效」下不能有可感知的运动 ——
     * 这里断言的是**根本没用到 transform**，那才是运动的来源。
     */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, { only: 'checkbox' });
    const transforms = await page
      .locator('[data-slot="checkbox"], [data-slot="checkbox-indicator"]')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).transform));
    expect(transforms.every((t) => t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)')).toBe(true);
  });
});
