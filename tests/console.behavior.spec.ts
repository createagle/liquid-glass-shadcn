/**
 * 控制台必须是干净的 —— 每个验证台都过一遍。
 *
 * ── 为什么补这条 ──────────────────────────────────────────────────────
 *
 * 做文档站时发现 Tabs 从写出来那天起就在无限重渲染：
 * `TabsTrigger` 的同步 effect 依赖整个 ctx，而 ctx 的 memo 依赖 punch，
 * 那个 effect 又会 setPunch —— 一个闭环。控制台刷
 * "Maximum update depth exceeded"，但**画面完全看不出异常**
 * （每次算出来的洞位置都一样），两个观察器每帧被拆掉重建。
 *
 * 已有的测试一条都抓不到它：
 *   · 行为测试断言的是 DOM 与几何 —— 值是对的；
 *   · 视觉快照比的是像素 —— 画面是对的；
 *   · **没有任何一条看过控制台。**
 *
 * 所以补这一条。它很便宜（每个台一次加载），但盖住的是一整类
 * 「功能正常、实现在空转」的问题。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/** 每个验证台跑一个最有代表性的场景 */
const HARNESSES: { name: string; file: string; query: string; viewport?: { width: number; height: number } }[] = [
  { name: 'tabs', file: 'tabs-demo', query: '' },
  { name: 'controls（Slider / Switch）', file: 'controls-demo', query: '' },
  { name: 'button', file: 'button-demo', query: '' },
  { name: 'dialog', file: 'dialog-demo', query: 'open=1' },
  { name: 'card', file: 'card-demo', query: '' },
  { name: 'sheet', file: 'sheet-demo', query: 'open=1' },
  { name: 'popover', file: 'overlay-demo', query: 'only=popover&open=1' },
  { name: 'dropdown-menu', file: 'overlay-demo', query: 'only=dropdown&open=1', viewport: { width: 1000, height: 800 } },
  { name: 'responsive-overlay', file: 'overlay-demo', query: 'only=responsive&open=1' },
  { name: 'select', file: 'select-demo', query: 'open=1&value=size', viewport: { width: 1000, height: 800 } },
];

/**
 * 允许通过的噪音。
 *
 * **刻意保持为空。** 有需要加进来的时候，请连同「为什么它不是 bug」一起写在这里 ——
 * 这个列表一旦开始长，这条测试就失去意义了。
 */
const ALLOW: RegExp[] = [];

async function collect(page: Page, url: string) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const text = m.text();
    if (ALLOW.some((re) => re.test(text))) return;
    errors.push(`[${m.type()}] ${text}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  // 无限循环需要几帧才会撞上 React 的更新深度上限
  await page.waitForTimeout(1200);
  return errors;
}

for (const h of HARNESSES) {
  test(`${h.name} —— 控制台无 error / warning`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: h.viewport ?? { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const url =
      pathToFileURL(resolve(`apps/www/dev/${h.file}.html`)).href +
      (h.query ? `?${h.query}` : '');
    const errors = await collect(page, url);
    await ctx.close();
    // 去重后再报，否则一个循环会刷出几十条一模一样的
    const unique = [...new Set(errors.map((e) => e.slice(0, 160)))];
    expect(unique, `${h.name} 的控制台输出`).toEqual([]);
  });
}
