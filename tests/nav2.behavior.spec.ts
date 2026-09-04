/**
 * P2 第三批（Sidebar / Menubar / Navigation Menu）的行为回归。
 *
 * 这一批的密度分布和上一批一样，取决于有没有依据：
 *
 *   Sidebar          材质 + 几何全部实测 → 连**不透明度**都钉（这是本批的核心）
 *   Menubar          几何实测 + 「条本身没有材质」这条**反向事实**也要钉
 *   NavigationMenu   Apple 没有这个控件 → 只钉行为与那块「会被 Radix 吃掉」的玻璃
 *
 * ⚠️ 有两条是**防回归而不是防偏差**：
 *   1. `Menubar` 默认无材质 —— 将来有人「顺手给条加块玻璃」时立刻红。
 *   2. `NavigationMenu` 的玻璃底 —— Radix 的 Viewport 会把 children 解构掉扔了，
 *      一旦有人把 GlassSurface 挪回 Viewport 里面，它会**一声不响地消失**。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/nav2-demo.html')).href;

async function open(page: Page, only?: string, theme = 'light', tier = 'a') {
  const q = new URLSearchParams({ theme, tier, ...(only ? { only } : {}) });
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

/**
 * 等一个 CSS 属性连续 5 帧不变再读。
 *
 * `__ready` 只保证挂载完成 —— Provider 的偏好副作用在其后一帧才写下材质，
 * 而 `.lg-surface` 上还有一条 150ms 的 background-color 过渡。
 * 上一批就是在过渡中间读到的中间色，测试忽红忽绿。
 */
async function settle(page: Page, selector: string, prop: string): Promise<string> {
  return page.evaluate(
    ([sel, p]) =>
      new Promise<string>((done) => {
        const el = document.querySelector(sel as string)!;
        let last = '';
        let stable = 0;
        const tick = () => {
          const now = getComputedStyle(el).getPropertyValue(p as string);
          stable = now === last ? stable + 1 : 0;
          last = now;
          if (stable >= 5) done(now);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    [selector, prop] as const,
  );
}

/** `rgba(r, g, b, a)` / `rgb(r, g, b)` → alpha */
function alphaOf(color: string): number {
  const m = /rgba?\(([^)]+)\)/.exec(color);
  if (!m) throw new Error(`不是颜色：${color}`);
  const parts = m[1]!.split(',').map((s) => parseFloat(s.trim()));
  return parts.length >= 4 ? parts[3]! : 1;
}

/* ══════════════════════════════════════════════════════════════════════
   Sidebar —— 本批的核心：HIG 那条「更不透明」
   ══════════════════════════════════════════════════════════════════════ */

test.describe('Sidebar', () => {
  test('材质：默认档下侧栏玻璃正好是实测的 0.92，且比控件层更不透明', async ({ page }) => {
    /**
     * 这一条是整批的理由所在。
     *
     * [实测] iOS 27 节点 10472:45236 —— 侧栏覆盖层 **0.92**；
     * 同一份文件里控件层的 Page Control（§12.1）只有 ≈0.10。
     *
     * 本库落成 `--lg-base-alpha-raw + --lg-large-boost` = 0.62 + 0.30 = **0.92**，
     * 外面再对可读性地板取 max。默认档正好命中实测值，所以这里硬钉。
     *
     * ⚠️ 加数必须是 `-raw`（美学值）。第一版加在了**加过地板**的
     * `--lg-base-alpha` 上（默认档实测是 0.7341），0.7341 + 0.3 = 1.034
     * 被 min(1) 夹成纯不透明 —— 量出来是 `rgb(255,255,255)`，侧栏一点玻璃都不剩。
     */
    await open(page, 'scale');
    const control = await settle(page, '[data-testid="scale-control"]', 'background-color');
    const large = await settle(page, '[data-testid="scale-large"]', 'background-color');

    expect(alphaOf(large), '侧栏必须更不透明').toBeGreaterThan(alphaOf(control));
    expect(alphaOf(large), '[实测] 0.92 —— 0.62 + 0.30').toBeCloseTo(0.92, 2);
    expect(alphaOf(large), '不能被夹成纯不透明，那就不是玻璃了').toBeLessThan(1);
  });

  test('材质：侧栏**没有**加大模糊 —— 实测 80 < Page Control 的 100', async ({ page }) => {
    /**
     * 反向断言。「面积越大糊得越狠」是想当然，被资源否掉了（§13.1）。
     * 将来有人顺手把 blur 一起调大，这条会红。
     */
    await open(page, 'scale');
    const [control, large] = await page.evaluate(() => {
      const read = (sel: string) => getComputedStyle(document.querySelector(sel)!).backdropFilter;
      return [read('[data-testid="scale-control"]'), read('[data-testid="scale-large"]')];
    });
    expect(large, '两块玻璃的 backdrop-filter 必须完全一致').toBe(control);
  });

  test('容器：一块玻璃、带 data-scale="large"', async ({ page }) => {
    await open(page, 'sidebar');
    const m = await page.evaluate(() => {
      const el = document.querySelector('[data-slot="sidebar"]')!;
      return {
        glass: el.classList.contains('lg-surface'),
        scale: el.getAttribute('data-scale'),
        layer: el.getAttribute('data-layer'),
        pad: getComputedStyle(el).paddingTop,
        width: el.getBoundingClientRect().width,
      };
    });
    expect(m.glass).toBe(true);
    expect(m.scale, '这是「更不透明」规则的落点').toBe('large');
    expect(m.layer, '侧栏是 Layer B，不折射').toBe('base');
    expect(m.pad, '[实测] 内边距 10').toBe('10px');
    expect(m.width, '示例里显式传了 260').toBeCloseTo(260, 1);
  });

  test('整条侧栏里**一个折射实例都没有** —— §5.2 的预算不能被行数吃掉', async ({ page }) => {
    await open(page, 'sidebar');
    const n = await page.evaluate(
      () => document.querySelectorAll('[data-slot="sidebar"] [data-layer="indicator"]').length,
    );
    expect(n, '选中态是减色填充，不是 Layer I').toBe(0);
  });

  test('行：高 44、胶囊、右内边距 8', async ({ page }) => {
    await open(page, 'sidebar');
    const m = await page.getByTestId('sb-inbox').evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        h: el.getBoundingClientRect().height,
        radius: parseFloat(cs.borderTopLeftRadius),
        right: cs.paddingRight,
        font: cs.fontSize,
        gap: cs.gap,
      };
    });
    expect(m.h, '[实测] 44 —— 也正好是 HIG 的最小触控目标').toBeCloseTo(44, 1);
    expect(m.radius, '[实测] 胶囊 = 高的一半').toBeCloseTo(22, 1);
    expect(m.right, '[实测] 8').toBe('8px');
    expect(m.font, '[实测] 17').toBe('17px');
    expect(m.gap, '[实测] 8').toBe('8px');
  });

  test('缩进：每级 20px（10 / 30 / 50）', async ({ page }) => {
    await open(page, 'sidebar');
    const pads = await page.evaluate(() =>
      ['sb-inbox', 'sb-l1', 'sb-l2'].map(
        (id) =>
          getComputedStyle(document.querySelector(`[data-testid="${id}"]`)!).paddingLeft,
      ),
    );
    expect(pads, '[实测] Level 0→10、1→30、2→50').toEqual(['10px', '30px', '50px']);
  });

  test('区块标题：整块 54、上下 21/11、左右 12', async ({ page }) => {
    await open(page, 'sidebar');
    const m = await page.getByTestId('sb-group-label').evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        h: el.getBoundingClientRect().height,
        top: cs.paddingTop,
        bottom: cs.paddingBottom,
        left: cs.paddingLeft,
      };
    });
    expect(m.h, '[实测] 54').toBeCloseTo(54, 1);
    expect(m.top, '[实测] 21').toBe('21px');
    expect(m.bottom, '[实测] 11').toBe('11px');
    expect(m.left, '[实测] 12').toBe('12px');
  });

  test('禁用态整行不透明度 0.5', async ({ page }) => {
    await open(page, 'sidebar');
    const op = await page
      .getByTestId('sb-disabled')
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(op, '[实测] 0.5').toBe('0.5');
  });

  test('语义：选中行是 aria-current="page"，不是 aria-selected', async ({ page }) => {
    await open(page, 'sidebar');
    const inbox = page.getByTestId('sb-inbox');
    await expect(inbox, '侧栏行是导航目标，不是 listbox 选项').toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByTestId('sb-sent')).not.toHaveAttribute('aria-current', 'page');

    await page.getByTestId('sb-sent').click();
    await expect(page.getByTestId('sb-sent')).toHaveAttribute('aria-current', 'page');
    await expect(inbox).not.toHaveAttribute('aria-current', 'page');
  });

  test('区块是 role=group，且由它的标题命名', async ({ page }) => {
    await open(page, 'sidebar');
    const ok = await page.evaluate(() => {
      const g = document.querySelector('[data-slot="sidebar-group"]')!;
      const id = g.getAttribute('aria-labelledby');
      const label = id ? document.getElementById(id) : null;
      return { role: g.getAttribute('role'), text: label?.textContent ?? null };
    });
    expect(ok.role).toBe('group');
    expect(ok.text).toBe('本机');
  });

  test('折叠：宽度归零，且整块 inert（焦点不能跑进看不见的区域）', async ({ page }) => {
    await open(page, 'sidebar');
    const region = page.locator('[data-slot="sidebar-region"]');
    await expect(region).toHaveAttribute('data-state', 'open');

    await page.getByTestId('sb-trigger').click();
    await expect(region).toHaveAttribute('data-state', 'closed');
    // 弹簧动画要跑完
    await expect
      .poll(async () => Math.round(await region.evaluate((el) => el.getBoundingClientRect().width)))
      .toBe(0);
    expect(
      await region.evaluate((el) => el.hasAttribute('inert')),
      '折叠后必须 inert —— 否则里面的按钮仍然可以 Tab 到',
    ).toBe(true);
  });

  test('触发器：aria-expanded 跟着开合走，aria-controls 指向侧栏', async ({ page }) => {
    await open(page, 'sidebar');
    const trigger = page.getByTestId('sb-trigger');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const controls = await trigger.getAttribute('aria-controls');
    expect(await page.locator(`#${controls}`).count(), 'aria-controls 必须真的指到东西').toBe(1);
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Menubar —— 「条本身没有材质」这条反向事实要钉住
   ══════════════════════════════════════════════════════════════════════ */

test.describe('Menubar', () => {
  test('❗条本身**不是玻璃** —— 实测推翻了清单的「B + I」', async ({ page }) => {
    /**
     * [实测] iPadOS 菜单栏四个变体的 fills / effects / strokes 全是空的。
     * 这条防的是「顺手给条加块玻璃」。
     */
    await open(page, 'menubar');
    const m = await page.getByTestId('mb-plain').evaluate((el) => ({
      glass: el.classList.contains('lg-surface'),
      bg: getComputedStyle(el).backgroundColor,
      surfaceParent: el.parentElement?.getAttribute('data-slot') ?? null,
    }));
    expect(m.glass, '菜单栏直接压在背景上，自己没有底').toBe(false);
    expect(alphaOf(m.bg), '完全透明').toBe(0);
    expect(m.surfaceParent, '默认不套 GlassSurface').not.toBe('menubar-surface');
  });

  test('surface 是本库的扩展 —— 传了才有玻璃', async ({ page }) => {
    await open(page, 'menubar');
    const wrapped = await page
      .getByTestId('mb-surface')
      .evaluate((el) => el.parentElement?.classList.contains('lg-surface') ?? false);
    expect(wrapped, '传 surface 才包一块玻璃；这不是 iPadOS 的做法').toBe(true);
  });

  test('触发器：高 32、胶囊、14px；应用名 Bold/10，其余 Medium/10.5', async ({ page }) => {
    await open(page, 'menubar');
    const read = (id: string) =>
      page.getByTestId(id).evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          h: el.getBoundingClientRect().height,
          radius: parseFloat(cs.borderTopLeftRadius),
          font: cs.fontSize,
          weight: cs.fontWeight,
          pad: cs.paddingLeft,
        };
      });
    const app = await read('mb-app');
    const file = await read('mb-file');

    expect(app.h, '[实测] 32').toBeCloseTo(32, 1);
    expect(app.radius, '[实测] 胶囊').toBeCloseTo(16, 1);
    expect(app.font, '[实测] 14').toBe('14px');
    expect(app.weight, '[实测] 应用名是 Bold').toBe('700');
    expect(app.pad, '[实测] 应用名 10').toBe('10px');

    expect(file.weight, '[实测] 其余项是 Medium').toBe('500');
    expect(file.pad, '[实测] 其余项 10.5').toBe('10.5px');
  });

  test('展开态：填充命中 --lg-fill-tertiary，且有投影', async ({ page }) => {
    /**
     * [实测] `#767680 @ 0.12`，与 `--lg-fill-tertiary`（`#787880 / 0.12`）
     * 只差 R/G 各 2 —— 本组件因此没有新增任何颜色 token。
     */
    await open(page, 'menubar');
    await page.getByTestId('mb-app').click();
    await expect(page.getByTestId('mb-about')).toBeVisible();
    // 触发器上有一条 100ms 的 transition-colors，读早了会量到中间色
    await settle(page, '[data-testid="mb-app"]', 'background-color');

    const m = await page.getByTestId('mb-app').evaluate((el) => {
      const cs = getComputedStyle(el);
      const token = getComputedStyle(document.documentElement)
        .getPropertyValue('--lg-fill-tertiary')
        .trim();
      return { bg: cs.backgroundColor, shadow: cs.boxShadow, token };
    });
    expect(alphaOf(m.bg), '[实测] 0.12').toBeCloseTo(0.12, 2);
    expect(m.token, 'token 本身还在').toContain('0.12');
    expect(m.shadow, '[实测] 投影 0 2px 16px / 8% 黑').not.toBe('none');
  });

  test('面板：直接复用 DropdownMenu 的实测几何（250 / 34 / 项 40）', async ({ page }) => {
    await open(page, 'menubar');
    await page.getByTestId('mb-app').click();
    const panel = page.locator('[data-slot="menubar-content"] .lg-surface').first();
    await expect(panel).toBeVisible();
    const m = await panel.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        w: el.getBoundingClientRect().width,
        radius: parseFloat(cs.borderTopLeftRadius),
        padInline: cs.paddingLeft,
        padBlock: cs.paddingTop,
        layer: el.getAttribute('data-layer'),
      };
    });
    expect(m.w, '[实测] 250').toBeCloseTo(250, 1);
    expect(m.radius, '[实测] 34 —— 与 DropdownMenu / ContextMenu 同一块面板').toBeCloseTo(34, 1);
    expect(m.padInline, '[实测] 16').toBe('16px');
    expect(m.padBlock, '[实测] 10').toBe('10px');
    expect(m.layer, '面板是 Layer B（elevated），不折射').toBe('elevated');

    const itemH = await page
      .getByTestId('mb-about')
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(itemH, '[实测] 40').toBeCloseTo(40, 1);
  });

  test('键盘：Escape 关闭，方向键在项之间移动', async ({ page }) => {
    await open(page, 'menubar');
    await page.getByTestId('mb-app').click();
    await expect(page.getByTestId('mb-about')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('mb-about')).toHaveAttribute('data-highlighted', '');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('mb-about')).toHaveCount(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Navigation Menu —— 没有依据，只钉行为与那块会被吃掉的玻璃
   ══════════════════════════════════════════════════════════════════════ */

test.describe('Navigation Menu', () => {
  test('❗玻璃底真的在 —— Radix 的 Viewport 会把 children 解构掉扔了', async ({ page }) => {
    /**
     * 这条防的是一次真实的返工：第一版把 `<GlassSurface>` 写在 `<Viewport>`
     * 里面，`NavigationMenuViewportImpl` 第一行就把 children 解构走了，
     * 玻璃**一声不响地消失**，控制台一个字都没有。
     */
    await open(page, 'navigation-menu');
    expect(await page.locator('[data-slot="navigation-menu-panel"]').count(), '关闭时不该留残影').toBe(
      0,
    );

    await page.getByTestId('nm-trigger-a').click();
    const panel = page.locator('[data-slot="navigation-menu-panel"]');
    await expect(panel).toBeVisible();
    const m = await panel.evaluate((el) => ({
      glass: el.classList.contains('lg-surface'),
      layer: el.getAttribute('data-layer'),
      radius: parseFloat(getComputedStyle(el).borderTopLeftRadius),
      // 必须铺满视口，而不是塌成 0
      box: el.getBoundingClientRect().height,
    }));
    expect(m.glass).toBe(true);
    expect(m.layer).toBe('elevated');
    expect(m.radius, '`[推定]` 借 §7.7 菜单面板的实测 34').toBeCloseTo(34, 1);
    expect(m.box, '铺满视口').toBeGreaterThan(20);
  });

  test('触发器几何借自 iPadOS 菜单栏项（32 / 胶囊 / 14）', async ({ page }) => {
    await open(page, 'navigation-menu');
    const m = await page.getByTestId('nm-trigger-a').evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        h: el.getBoundingClientRect().height,
        radius: parseFloat(cs.borderTopLeftRadius),
        font: cs.fontSize,
        pad: cs.paddingLeft,
      };
    });
    expect(m.h, '`[推定]` 借 §13.3 的实测 32').toBeCloseTo(32, 1);
    expect(m.radius).toBeCloseTo(16, 1);
    expect(m.font, '`[推定]` 借 §13.3 的实测 14').toBe('14px');
    expect(m.pad, '`[推定]` 借 §13.3 的实测 10.5').toBe('10.5px');
  });

  test('切菜单：同一块玻璃在变形，不是两块交叉淡入', async ({ page }) => {
    /*
     * ⚠️ 用 hover 换菜单，不是 click。
     *
     * NavigationMenu 的交互模型是**移过去就换**（Radix 靠 pointerEnter 接力）。
     * 在 A 已展开时去 click B，会先被「点外面关掉」吃掉一次，
     * 再由 click 切成开——结果是 closed。测出来的是 Radix 的 toggle 语义，
     * 不是这个组件要保证的事。
     */
    await open(page, 'navigation-menu');
    await page.getByTestId('nm-trigger-a').click();
    await expect(page.locator('[data-slot="navigation-menu-panel"]')).toHaveCount(1);
    await page.getByTestId('nm-trigger-b').hover();
    await expect(page.getByTestId('nm-trigger-b')).toHaveAttribute('data-state', 'open');
    await expect(page.getByTestId('nm-trigger-a')).toHaveAttribute('data-state', 'closed');
    expect(
      await page.locator('[data-slot="navigation-menu-panel"]').count(),
      '始终只有一块玻璃',
    ).toBe(1);
  });

  test('展开后关闭，玻璃与投影都要收走', async ({ page }) => {
    await open(page, 'navigation-menu');
    await page.getByTestId('nm-trigger-a').click();
    await expect(page.locator('[data-slot="navigation-menu-panel"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-slot="navigation-menu-panel"]')).toHaveCount(0);
  });

  test('链接是真实的 <a>（本库禁用 asChild）', async ({ page }) => {
    await open(page, 'navigation-menu');
    await page.getByTestId('nm-trigger-a').click();
    const link = page.getByTestId('nm-link');
    await expect(link).toBeVisible();
    expect(await link.evaluate((el) => el.tagName)).toBe('A');
    await expect(link).toHaveAttribute('href', '#sidebar');
  });
});
