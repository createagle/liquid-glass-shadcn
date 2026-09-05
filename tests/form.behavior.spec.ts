/**
 * 表单一批（Input / Textarea / Label / Field）的行为与几何回归。
 *
 * 断言的都是**确定性事实**（尺寸、DOM 结构、a11y 语义、降级分支），不含截图，
 * 所以任何平台跑结果都一样，可以放心进 CI。
 *
 * 几何基准：iOS 27 官方设计资源节点 12740:33850（四行 Text Field 的 Grouped List），
 * 逐像素测量脚本 scripts/measure-textfield.mjs，记录见 apple-metrics.md §8.3。
 *
 *   区块 370 宽 · 行高 52 · 文字左内缩 16 · 分隔线 1pt 内缩 16
 *   占位符 #c5c5c7 · 值 #000000 · 光标 2×23 #0088ff · 清除按钮 18×18 右内缩 17
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/form-demo.html')).href;

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

/* ── 几何 —— 对齐 iOS 27 实测值 ─────────────────────────────────────── */

test.describe('几何 —— list 变体对齐 iOS 27 实测值', () => {
  test('区块 370、四行各 52、文字左内缩 16', async ({ page }) => {
    await open(page, { only: 'reference', bg: 'grouped' });
    const card = page.locator('[data-slot="card"]');
    const box = (await card.boundingBox())!;
    expect(Math.round(box.width), '区块宽 370').toBe(370);

    const rows = page.locator('[data-slot="card-row"]');
    await expect(rows).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      const r = (await rows.nth(i).boundingBox())!;
      expect(Math.round(r.height), `第 ${i + 1} 行高 52`).toBe(52);
    }

    const firstInput = (await page.locator('[data-slot="input"]').first().boundingBox())!;
    expect(Math.round(firstInput.x - box.x), '文字左内缩 16').toBe(16);
  });

  test('list 变体**不画任何框** —— 这是参考图最重要的结论', async ({ page }) => {
    /**
     * iOS 的表单文本框没有描边、没有填充、没有玻璃。
     * 只要哪天有人给 list 变体加了背景或描边，这条就会红。
     */
    await open(page, { only: 'reference', bg: 'grouped' });
    const wrapper = page.locator('[data-slot="input-wrapper"][data-variant="list"]').first();
    const style = await wrapper.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        background: cs.backgroundColor,
        border: cs.borderTopWidth,
        shadow: cs.boxShadow,
        backdrop: cs.backdropFilter,
        isGlass: el.classList.contains('lg-surface'),
      };
    });
    expect(style.background, '不该有背景').toBe('rgba(0, 0, 0, 0)');
    expect(style.border, '不该有描边').toBe('0px');
    expect(style.shadow, '不该有阴影').toBe('none');
    expect(style.backdrop, '不该有 backdrop-filter').toBe('none');
    expect(style.isGlass, 'list 变体不该是一块玻璃').toBe(false);
  });

  test('清除按钮 18×18，且只在有值时出现', async ({ page }) => {
    await open(page, { only: 'reference', bg: 'grouped' });
    const clears = page.locator('[data-slot="input-clear"]');
    // 四行里只有第三行传了 clearable 且有值
    await expect(clears).toHaveCount(1);
    const b = (await clears.boundingBox())!;
    expect(Math.round(b.width)).toBe(18);
    expect(Math.round(b.height)).toBe(18);
  });

  test('清除按钮清空之后自己消失，且焦点回到输入框', async ({ page }) => {
    await open(page, { only: 'reference', bg: 'grouped' });
    const input = page.getByLabel('value-with-clear');
    await expect(input).toHaveValue('Value');
    await page.locator('[data-slot="input-clear"]').click();
    await expect(input).toHaveValue('');
    await expect(page.locator('[data-slot="input-clear"]')).toHaveCount(0);
    await expect(input).toBeFocused();
  });

  test('清除按钮不在 Tab 顺序里 —— 与 Safari 原生 clear button 一致', async ({ page }) => {
    await open(page, { only: 'reference', bg: 'grouped' });
    await expect(page.locator('[data-slot="input-clear"]')).toHaveAttribute('tabindex', '-1');
  });
});

/* ── field 变体 ───────────────────────────────────────────────────────── */

test.describe('field 变体 —— Layer B，但无 Apple 参考', () => {
  test('是一块 Layer B 玻璃，且**不折射**', async ({ page }) => {
    await open(page, { only: 'field' });
    const surface = page.locator('.lg-surface[data-layer="base"]').first();
    await expect(surface).toHaveCount(1);
    // PROJECT_SPEC §15.2：底座绝不折射
    const backdrop = await surface.evaluate((el) => getComputedStyle(el).backdropFilter);
    expect(backdrop, 'Layer B 不该出现 SVG 折射').not.toContain('url(');
  });

  test('高度 44 —— HIG 的最小触控目标', async ({ page }) => {
    await open(page, { only: 'field' });
    const box = (await page.locator('.lg-surface[data-layer="base"]').first().boundingBox())!;
    expect(Math.round(box.height)).toBe(44);
  });

  test('aria-invalid 时有独立于颜色的语义，不只是变红', async ({ page }) => {
    await open(page, { only: 'field' });
    const invalid = page.getByLabel('field-invalid');
    await expect(invalid).toHaveAttribute('aria-invalid', 'true');
  });

  test('禁用时不可聚焦', async ({ page }) => {
    await open(page, { only: 'field' });
    await expect(page.getByLabel('field-disabled')).toBeDisabled();
  });
});

/* ── Textarea ─────────────────────────────────────────────────────────── */

test.describe('Textarea', () => {
  test('autoResize 长得回来也缩得回去', async ({ page }) => {
    /**
     * 缩回去这一半才是容易写错的：实现里必须先把 height 归零再读 scrollHeight，
     * 少了归零那一步 scrollHeight 永远 ≥ 当前高度，元素只会越长越高。
     */
    await open(page, { only: 'textarea' });
    const ta = page.getByLabel('textarea-autoresize');
    const h0 = (await ta.boundingBox())!.height;

    await ta.fill(['a', 'b', 'c', 'd', 'e', 'f'].join('\n'));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    const h1 = (await ta.boundingBox())!.height;
    expect(h1, '多行之后必须变高').toBeGreaterThan(h0);

    await ta.fill('a');
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    const h2 = (await ta.boundingBox())!.height;
    expect(h2, '删回一行必须缩回去').toBeLessThan(h1);
  });

  test('list 变体同样不画框', async ({ page }) => {
    await open(page, { only: 'textarea' });
    const wrapper = page.locator('[data-slot="textarea-wrapper"][data-variant="list"]');
    await expect(wrapper).toHaveCount(1);
    const isGlass = await wrapper.evaluate((el) => el.classList.contains('lg-surface'));
    expect(isGlass).toBe(false);
  });
});

/* ── Field 的接线（这一批真正的价值所在）───────────────────────────── */

test.describe('Field —— id / htmlFor / aria 的自动接线', () => {
  test('Label 的 for 指向 Input 的 id，一个 id 都不用手写', async ({ page }) => {
    await open(page, { only: 'wiring' });
    const label = page.locator('[data-slot="label"]').first();
    const input = page.locator('[data-slot="input"]').first();
    const forAttr = await label.getAttribute('for');
    const id = await input.getAttribute('id');
    expect(forAttr).toBeTruthy();
    expect(forAttr).toBe(id);
  });

  test('点标签能聚焦到控件', async ({ page }) => {
    await open(page, { only: 'wiring' });
    await page.locator('[data-slot="label"]').first().click();
    await expect(page.locator('[data-slot="input"]').first()).toBeFocused();
  });

  test('aria-describedby 只包含**真的渲染了**的那几个 id', async ({ page }) => {
    /**
     * 无条件拼接的话，没渲染 FieldDescription / FieldError 时
     * aria-describedby 会指向不存在的元素 —— 屏幕阅读器多数静默跳过，
     * 于是「读不出说明」这件事在测试里完全看不出来。
     */
    await open(page, { only: 'wiring' });

    // 只有说明的那一个：describedby 恰好一个 id，且指向真实存在的节点
    const nickname = page.getByLabel('nickname');
    const nickDesc = await nickname.getAttribute('aria-describedby');
    expect(nickDesc, '只有说明 → 只有一个 id').toBeTruthy();
    expect(nickDesc!.split(' ')).toHaveLength(1);
    // ⚠️ 用属性选择器而不是 `#id` —— CSS.escape 是浏览器 API，测试跑在 Node 里没有它，
    //    而 React 的 useId 生成的 id 带下划线和冒号，直接拼进 `#` 选择器并不安全。
    await expect(page.locator(`[id="${nickDesc}"]`)).toHaveCount(1);

    // 光秃秃的那一个：完全不该有 describedby
    const bare = page.getByLabel('bare');
    expect(await bare.getAttribute('aria-describedby'), '什么都没有 → 属性不该存在').toBeNull();
  });

  test('切到 invalid：aria-invalid 上身，错误 id 追加进 describedby', async ({ page }) => {
    await open(page, { only: 'wiring' });
    const input = page.locator('[data-slot="input"]').first();
    const before = await input.getAttribute('aria-describedby');
    expect(await input.getAttribute('aria-invalid'), '起始不该是 invalid').toBeNull();
    await expect(page.locator('[data-slot="field-error"]')).toHaveCount(0);

    await page.getByTestId('toggle-invalid').click();

    await expect(input).toHaveAttribute('aria-invalid', 'true');
    const error = page.locator('[data-slot="field-error"]');
    await expect(error).toHaveCount(1);
    // 校验失败必须能在焦点还在别处时被朗读 —— 只靠 describedby 是听不见的
    await expect(error).toHaveAttribute('role', 'alert');

    /**
     * ⚠️ 必须用会重试的断言 —— 与下面那条「摘掉」的测试是**同一个坑**。
     * 那边把原因写下来了，这一条当初没跟上：
     *
     * 错误元素挂载与 `aria-describedby` 更新**不在同一次渲染里**
     * （子节点在 effect 里 register(true)，那是一次 setState，属性要到
     * 下一次渲染才落地）。一次性的 getAttribute 会读到上一帧的值。
     *
     * 这不是组件的 bug，是断言的时机不对：单独重复跑 5 次能红 3 次，
     * 而在全量并行里偶尔才红一次 —— 看起来像 flaky，其实是稳定的竞态。
     */
    const errorId = await error.getAttribute('id');
    await expect
      .poll(async () => (await input.getAttribute('aria-describedby'))?.split(' ') ?? [])
      .toEqual(expect.arrayContaining([before!, errorId!]));

    const after = await input.getAttribute('aria-describedby');
    expect(after).not.toBe(before);
    expect(after!.split(' '), '说明 + 错误 = 两个 id').toHaveLength(2);
    expect(after!.split(' ')).toContain(errorId);
  });

  test('切回来之后错误 id 要从 describedby 里**摘掉**', async ({ page }) => {
    // 只加不减是这类实现最常见的漏洞：错误消失了，悬空引用还留着
    await open(page, { only: 'wiring' });
    const input = page.locator('[data-slot="input"]').first();
    const toggle = page.getByTestId('toggle-invalid');
    const before = await input.getAttribute('aria-describedby');
    await toggle.click();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await toggle.click();
    await expect(page.locator('[data-slot="field-error"]')).toHaveCount(0);
    /**
     * ⚠️ 必须用会重试的断言。
     *
     * 错误元素消失和 aria-describedby 更新**不在同一次渲染里**：
     * 子节点卸载时调 register(false)，那是一次 setState，属性要到下一次渲染才落地。
     * 用 getAttribute 取一次快照会稳定地读到上一帧的值 —— 这不是组件的 bug，
     * 是断言的时机不对（第一版就是这么写的，红了）。
     */
    await expect(input).toHaveAttribute('aria-describedby', before!);
  });

  test('Input / Textarea 在 Field 外面照样能用', async ({ page }) => {
    // useFieldControl 在没有 Provider 时返回空对象，不该抛错也不该乱写 aria
    await open(page, { only: 'field' });
    const input = page.getByLabel('field-placeholder');
    await expect(input).toHaveCount(1);
    expect(await input.getAttribute('aria-describedby')).toBeNull();
  });
});

/* ── 无障碍偏好与降级（PROJECT_SPEC §13）──────────────────────────── */

test.describe('三级降级与无障碍偏好', () => {
  for (const tier of ['a', 'b', 'c'] as const) {
    test(`Tier ${tier.toUpperCase()} 下 field 变体仍是一个完整设计`, async ({ page }) => {
      await open(page, { only: 'field', tier });
      const surface = page.locator('.lg-surface[data-layer="base"]').first();
      // 三档都必须有可见的底色，否则输入框在复杂背景上会「消失」
      const bg = await surface.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg).not.toBe('rgba(0, 0, 0, 0)');
      const box = (await surface.boundingBox())!;
      expect(Math.round(box.height), '几何不随 tier 变').toBe(44);
    });
  }

  test('reduced-transparency 下不再有 backdrop-filter', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: null, forcedColors: null });
    await page.addInitScript(() => {
      const mm = window.matchMedia.bind(window);
      window.matchMedia = (q: string) =>
        q.includes('prefers-reduced-transparency')
          ? ({
              matches: true,
              media: q,
              addEventListener() {},
              removeEventListener() {},
              addListener() {},
              removeListener() {},
              dispatchEvent: () => false,
              onchange: null,
            } as unknown as MediaQueryList)
          : mm(q);
    });
    await open(page, { only: 'field' });
    const backdrop = await page
      .locator('.lg-surface[data-layer="base"]')
      .first()
      .evaluate((el) => getComputedStyle(el).backdropFilter);
    expect(backdrop).toBe('none');
  });
});
