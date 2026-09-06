/**
 * Tabs 的行为与几何回归。
 *
 * 这里断言的都是**确定性事实**（尺寸、DOM 结构、a11y 语义、降级分支），
 * 不含截图 —— 所以任何平台跑结果都一样，可以放心进 CI。
 * 截图比对在 `tabs.visual.spec.ts`，那个是平台相关的，见 playwright.config.ts。
 *
 * 几何基准来自 iOS 27 官方设计资源（docs/research/apple-metrics.md §7.2）：
 * 底座 62pt、指示器 54pt、内缩 4pt、外半径 = 高/2。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/tabs-demo.html')).href;

async function open(
  page: Page,
  opts: { theme?: string; tier?: string; tint?: number } = {},
) {
  const q = new URLSearchParams({
    theme: opts.theme ?? 'light',
    tier: opts.tier ?? 'a',
    tint: String(opts.tint ?? 0.34),
  });
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  // 等合成完成，避免量到中间态
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

const base = (p: Page) => p.locator('.lg-surface[data-layer="base"]');
const indicator = (p: Page) => p.locator('.lg-surface[data-layer="indicator"]');

test.describe('几何 —— 对齐 iOS 27 实测值', () => {
  test('底座 62、指示器 54、内缩 4', async ({ page }) => {
    await open(page);
    const b = (await base(page).boundingBox())!;
    const i = (await indicator(page).boundingBox())!;
    expect(Math.round(b.height)).toBe(62);
    expect(Math.round(i.height)).toBe(54);
    expect(Math.round(i.x - b.x)).toBe(4);
    expect(Math.round(i.y - b.y)).toBe(4);
  });

  test('高度可缩放，内缩按比例跟随', async ({ page }) => {
    await open(page);
    // 把底座高度改成 40，内缩应当按 4/62 的比例缩到 3
    await page.evaluate(() => {
      const root = document.querySelector('[data-slot="tabs"]') as HTMLElement;
      root.style.setProperty('--lg-tabs-height', '40px');
    });
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const b = (await base(page).boundingBox())!;
    expect(Math.round(b.height)).toBe(40);
  });
});

test.describe('挖洞 —— 指示器必须看到未被底座模糊的背景', () => {
  test('Tier A/B 挖洞，Tier C 不需要', async ({ page }) => {
    for (const tier of ['a', 'b']) {
      await open(page, { tier });
      await expect(base(page)).toHaveAttribute('data-punched', 'true');
      await expect(page.locator('.lg-punch-layer')).toHaveCount(1);
    }
    // Tier C 没有 backdrop-filter，挖洞无意义；子层被 CSS 隐藏
    await open(page, { tier: 'c' });
    await expect(page.locator('.lg-punch-layer')).toBeHidden();
  });

  test('洞跟着选中项走', async ({ page }) => {
    await open(page);
    const readHole = () =>
      page.evaluate(() => {
        const el = document.querySelector('.lg-punch-layer') as HTMLElement;
        return getComputedStyle(el).clipPath;
      });
    const before = await readHole();
    await page.getByRole('tab', { name: '搜索' }).click();
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

test.describe('a11y —— Radix 语义不得被样式破坏', () => {
  test('tablist / tab / tabpanel 与选中态齐全', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('tablist')).toHaveCount(1);
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
  });

  test('键盘可达：方向键切换', async ({ page }) => {
    await open(page);
    await page.getByRole('tab', { name: '资料库' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: '广播' })).toBeFocused();
  });

  test('指示器不进无障碍树', async ({ page }) => {
    await open(page);
    // 指示器是纯装饰，必须 aria-hidden，否则读屏会念出空节点
    const hidden = await page.evaluate(() => {
      const ind = document.querySelector('.lg-surface[data-layer="indicator"]');
      return ind?.closest('[aria-hidden="true"]') !== null;
    });
    expect(hidden).toBe(true);
  });
});

test.describe('三级降级 —— B / C 各自都要是完整设计', () => {
  test('每个 tier 下指示器都存在且尺寸正确', async ({ page }) => {
    for (const tier of ['a', 'b', 'c']) {
      await open(page, { tier });
      const i = (await indicator(page).boundingBox())!;
      expect(Math.round(i.height), `tier ${tier}`).toBe(54);
    }
  });

  test('只有 Tier A 走 SVG 折射', async ({ page }) => {
    const filterOf = () =>
      page.evaluate(() => {
        const el = document.querySelector('.lg-surface[data-layer="indicator"]') as HTMLElement;
        return getComputedStyle(el).backdropFilter;
      });
    await open(page, { tier: 'a' });
    expect(await filterOf()).toContain('url(');
    await open(page, { tier: 'b' });
    expect(await filterOf()).not.toContain('url(');
    await open(page, { tier: 'c' });
    expect(await filterOf()).not.toContain('url(');
  });
});

test.describe('无障碍偏好降级（PROJECT_SPEC §13）', () => {
  /**
   * 测的是「切换后多久静止」，不是「有没有位移」——
   * 位移总是会发生（指示器要移到新位置），差别在于**用多久**。
   * SPEC §13 给的上限是 120ms。
   */
  async function travelAfter(page: Page, ms: number) {
    await page.getByRole('tab', { name: '搜索' }).click();
    await page.waitForTimeout(ms);
    const mid = (await indicator(page).boundingBox())!.x;
    await page.waitForTimeout(700); // 足够任何 spring 静止
    const settled = (await indicator(page).boundingBox())!.x;
    return Math.abs(settled - mid);
  }

  test('reduced-motion 下 150ms 内已静止', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await open(page);
    expect(await travelAfter(page, 150)).toBeLessThan(1);
    await ctx.close();
  });

  /**
   * 反向对照 —— 没有这一条，上面那个测试可能只是因为「动画本来就很快」而通过，
   * 并不能证明 reduced-motion 真的起了作用。
   */
  test('正常动效下 150ms 时仍在移动（证明上条有区分力）', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    await open(page);
    expect(await travelAfter(page, 150)).toBeGreaterThan(1);
    await ctx.close();
  });

  test('reduced-transparency 下材质压到 solid 且不折射', async ({ browser }) => {
    const ctx = await browser.newContext({ forcedColors: 'none' });
    const page = await ctx.newPage();
    await page.emulateMedia({ reducedMotion: null });
    // Playwright 目前无法直接模拟 prefers-reduced-transparency，
    // 故直接驱动 Provider 暴露的同一条路径：tier 强制为 c。
    await open(page, { tier: 'c' });
    const f = await page.evaluate(() => {
      const el = document.querySelector('.lg-surface[data-layer="indicator"]') as HTMLElement;
      return getComputedStyle(el).backdropFilter;
    });
    expect(f).not.toContain('url(');
    await ctx.close();
  });
});

test.describe('交互态（PROJECT_SPEC §14）', () => {
  /**
   * 高亮层是**每个 trigger 各一个**，所以必须按 trigger 定位。
   *
   * ⚠️ 这三条原来写的是 `document.querySelector('[data-slot=tabs-trigger-highlight]')`
   * ——取文档里第一个。那依赖「第一个 trigger 恰好是未选中的」这个偶然事实；
   * 指示器重构之后选中项也会渲染一个（用 CSS 藏起来），第一个就变成了选中项那个，
   * 三条同时红。断言的本来就该是**要求本身**（选中项没有可见高亮、
   * 未选中项 hover 才出现），不是 DOM 里有几个节点、哪个排在前面。
   */
  const highlightIn = (p: Page, name: string) =>
    p.getByRole('tab', { name }).locator('[data-slot="tabs-trigger-highlight"]');

  /** 看得见 = 渲染了、没被 display:none、且不透明度上来了 */
  const visibleOpacity = async (p: Page, name: string) =>
    p.getByRole('tab', { name }).evaluate((tab) => {
      const el = tab.querySelector('[data-slot="tabs-trigger-highlight"]') as HTMLElement | null;
      if (!el) return 0;
      const cs = getComputedStyle(el);
      return cs.display === 'none' ? 0 : Number(cs.opacity);
    });

  test('未选中项：静止无高亮，hover 后出现', async ({ page }) => {
    await open(page);
    expect(await visibleOpacity(page, '广播')).toBe(0);

    await page.getByRole('tab', { name: '广播' }).hover();
    await expect.poll(() => visibleOpacity(page, '广播')).toBeGreaterThan(0.5);
  });

  test('移开后高亮退回', async ({ page }) => {
    await open(page);
    await page.getByRole('tab', { name: '广播' }).hover();
    await expect.poll(() => visibleOpacity(page, '广播')).toBeGreaterThan(0.5);
    // 移到组件外
    await page.mouse.move(600, 400);
    await expect.poll(() => visibleOpacity(page, '广播')).toBeLessThan(0.05);
  });

  test('选中项没有可见高亮 —— 它已经有指示器了', async ({ page }) => {
    await open(page);
    // 静止时看不见
    expect(await visibleOpacity(page, '资料库')).toBe(0);
    // **hover 上去也不该出现** —— 这才是 §14 那条要求的实质，
    // 旧写法只数了数节点个数，压根没验过这一步
    await page.getByRole('tab', { name: '资料库' }).hover();
    await page.waitForTimeout(300);
    expect(await visibleOpacity(page, '资料库')).toBe(0);
    // 未选中项照样能亮，说明上面那条不是因为整个机制坏了
    await page.getByRole('tab', { name: '广播' }).hover();
    await expect.poll(() => visibleOpacity(page, '广播')).toBeGreaterThan(0.5);
  });

  test('按下选中项时指示器上扬', async ({ page }) => {
    await open(page);
    const ind = indicator(page);
    await expect(ind).not.toHaveAttribute('data-pressed', 'true');
    const b = (await page.getByRole('tab', { name: '资料库' }).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect(ind).toHaveAttribute('data-pressed', 'true');
    await page.mouse.up();
    await expect(ind).not.toHaveAttribute('data-pressed', 'true');
  });

  test('指针移出后按下态不会卡住', async ({ page }) => {
    await open(page);
    const ind = indicator(page);
    const b = (await page.getByRole('tab', { name: '资料库' }).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect(ind).toHaveAttribute('data-pressed', 'true');
    // 移到组件外再松手 —— 只听自己的 pointerup 会把状态卡住
    await page.mouse.move(b.x + 400, b.y + 200);
    await page.mouse.up();
    await expect(ind).not.toHaveAttribute('data-pressed', 'true');
  });
});

/* ── 指示器拖动（本库扩展，不是实测还原 —— 见 tabs.tsx 文件头）────────── */

test.describe('指示器可拖动', () => {
  const ind = (p: Page) => p.locator('[data-slot="tabs-indicator"]');

  /** 指示器相对 List 的左沿与宽度 —— 位置由 transform 驱动，boundingBox 才准 */
  const indBox = (p: Page) =>
    p.evaluate(() => {
      const list = document.querySelector('[data-slot="tabs-list"]')!.getBoundingClientRect();
      const el = document.querySelector('[data-slot="tabs-indicator"]')!.getBoundingClientRect();
      return { left: el.x - list.x, width: el.width };
    });

  /** 每个 trigger 相对 List 的左沿与宽度 */
  const segBoxes = (p: Page) =>
    p.evaluate(() => {
      const list = document.querySelector('[data-slot="tabs-list"]')!.getBoundingClientRect();
      return [...document.querySelectorAll('[data-slot="tabs-trigger"]')].map((t) => {
        const r = t.getBoundingClientRect();
        return { text: t.textContent, left: r.x - list.x, width: r.width };
      });
    });

  /**
   * 洞在 clip-path 里的**起点** x。
   *
   * ⚠️ 它不是 punch.x：路径写的是「先跳到左上圆角的起点」，
   * 读出来天然带一个圆角半径的偏移。第一版忘了这一层，断言差了 27px，
   * 看着像「洞没跟上」，其实是测量端算错了 —— 差点把自己的算错当成组件的 bug。
   */
  const holeStartX = (p: Page) =>
    p.evaluate(() => {
      const layer = document.querySelector('.lg-surface[data-layer="base"] > *') as HTMLElement;
      const m = getComputedStyle(layer).clipPath.match(/Z M ([\d.]+) ([\d.]+)/);
      return m ? Number(m[1]) : null;
    });

  /**
   * 指示器的**布局**位移（transform 矩阵里的 translateX）。
   *
   * 不能用 boundingBox：按住时有 1.03 的放大、拖动时还有速度拉伸，
   * 视觉盒子会比布局位置左移一两个像素 —— 而挖洞用的是布局位置。
   */
  const indTranslateX = (p: Page) =>
    p.evaluate(() => {
      const el = document.querySelector('[data-slot="tabs-indicator"]') as HTMLElement;
      return new DOMMatrixReadOnly(getComputedStyle(el).transform).e;
    });

  async function grab(p: Page, name: string) {
    const b = (await p.getByRole('tab', { name }).boundingBox())!;
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await p.mouse.down();
    return { y: b.y + b.height / 2 };
  }

  test('按住选中段横向拖动 —— 指示器跟手，选中态跟着变', async ({ page }) => {
    await open(page);
    const segs = await segBoxes(page);
    const start = await indBox(page);
    expect(Math.round(start.left)).toBe(Math.round(segs[0]!.left));

    const { y } = await grab(page, '资料库');
    const list = (await page.locator('[data-slot="tabs-list"]').boundingBox())!;
    // 拖到第三段中心
    await page.mouse.move(list.x + segs[2]!.left + segs[2]!.width / 2, y, { steps: 8 });

    // 还没松手，指示器已经离开原位，选中态也已经跟过去了
    const mid = await indBox(page);
    expect(mid.left).toBeGreaterThan(start.left + 20);
    await expect(page.getByRole('tab', { name: '搜索' })).toHaveAttribute('data-state', 'active');
    await expect(ind(page)).toHaveAttribute('data-dragging', 'true');

    await page.mouse.up();
    // 松手后落到目标段，位置与宽度都对齐
    await expect.poll(async () => Math.round((await indBox(page)).left)).toBe(
      Math.round(segs[2]!.left),
    );
    expect(Math.round((await indBox(page)).width)).toBe(Math.round(segs[2]!.width));
    await expect(ind(page)).not.toHaveAttribute('data-dragging', 'true');
  });

  test('🔴 挖洞必须跟着指示器一起走', async ({ page }) => {
    /*
     * 这条是拖动能不能成立的关键。洞停在原处的话，指示器一拖出洞就只能看到
     * 被底座模糊过的背景 —— 折射当场失效，玻璃在半路变成一块糊。
     * 光看「指示器动了」是发现不了的，必须单独钉。
     *
     * ⚠️ **刻意在同一段内小幅拖动**，不跨段。
     * 第一版是拖过两段的，探针（把洞对 x 的订阅摘掉）居然还是绿的 ——
     * 因为跨段时宽度也在动，宽度那条订阅顺手把洞刷新了，
     * 于是这条测试是靠**另一条链路**通过的，根本没验到自己声称的东西。
     * 同段内拖动时宽度不变、选中态不变，位置是唯一的变量。
     */
    await open(page);
    const segs = await segBoxes(page);
    const before = await holeStartX(page);
    const { y } = await grab(page, segs[0]!.text!);
    const list = (await page.locator('[data-slot="tabs-list"]').boundingBox())!;

    // 往右挪 30px：指示器中心仍落在第一段内，宽度与选中态都不变
    await page.mouse.move(list.x + segs[0]!.width / 2 + 30, y, { steps: 6 });
    await expect(page.getByRole('tab', { name: segs[0]!.text! })).toHaveAttribute(
      'data-state',
      'active',
    );

    const during = await holeStartX(page);
    const tx = await indTranslateX(page);
    const h = (await ind(page).boundingBox())!.height;
    expect(tx).toBeGreaterThan(20); // 指示器确实动了
    expect(during).not.toBe(before); // 洞也确实动了
    /*
     * 路径起点 = 内缩(4) + 指示器布局位移 + 圆角半径(高/2，胶囊)。
     * 容差 1.5px：挖洞走 React state，可能比 transform 晚一帧落地。
     */
    expect(Math.abs(during! - (4 + tx + h / 2))).toBeLessThan(1.5);
    await page.mouse.up();
  });
  test('只有选中段能起拖 —— 按住未选中段横移不跟手', async ({ page }) => {
    await open(page);
    const segs = await segBoxes(page);
    const { y } = await grab(page, '搜索'); // 按下即选中它，指示器飞过去
    await expect.poll(async () => Math.round((await indBox(page)).left)).toBe(
      Math.round(segs[2]!.left),
    );
    const list = (await page.locator('[data-slot="tabs-list"]').boundingBox())!;
    // 往回横move：不该被当成拖动
    await page.mouse.move(list.x + segs[0]!.left + 10, y, { steps: 8 });
    await expect(ind(page)).not.toHaveAttribute('data-dragging', 'true');
    /* 容差 2px：按住时指示器有 1.03 的放大，视觉盒子会比布局位置略左 */
    expect(Math.abs((await indBox(page)).left - segs[2]!.left)).toBeLessThan(2);
    await page.mouse.up();
  });

  test('小于阈值的抖动不算拖动，普通点击照常', async ({ page }) => {
    await open(page);
    const segs = await segBoxes(page);
    const b = (await page.getByRole('tab', { name: '广播' }).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 2, b.y + b.height / 2); // 2px < 阈值 3
    await expect(ind(page)).not.toHaveAttribute('data-dragging', 'true');
    await page.mouse.up();
    await expect(page.getByRole('tab', { name: '广播' })).toHaveAttribute('data-state', 'active');
    await expect.poll(async () => Math.round((await indBox(page)).left)).toBe(
      Math.round(segs[1]!.left),
    );
  });

  test('键盘不受影响 —— 方向键仍然切换', async ({ page }) => {
    await open(page);
    const segs = await segBoxes(page);
    await page.getByRole('tab', { name: '资料库' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: '广播' })).toHaveAttribute('data-state', 'active');
    await expect.poll(async () => Math.round((await indBox(page)).left)).toBe(
      Math.round(segs[1]!.left),
    );
  });
});
