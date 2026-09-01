/**
 * 交互态下的标签可读性（PROJECT_SPEC §13）。
 *
 * ── 为什么要单独一个脚本 ──────────────────────────────────────────────
 *
 * `contrast-audit.mjs` 审的是**静止态的 token 组合**。但可读性地板的推导
 * （a11y/legibility.ts）建立在 `C = a·F + (1−a)·B` 上，其中 `a` 是材质
 * 不透明度 —— 只要某个**状态**把 `a` 变成 0，整套保证就没了，而静止态的
 * 审计一个字都不会说。
 *
 * 这不是假想。做 Button 时踩到过：PROJECT_SPEC §2 要求按钮「按下升级为
 * Layer I」，而 `.lg-surface[data-layer='indicator']` 的 background-color
 * 是 transparent。实测 6px 黑白条纹背景上，标签对比度
 *
 *     静止 15.46:1  →  按下 1.92:1        （字直接看不见）
 *
 * 而同一个按钮在平滑渐变背景上是 15.46 → 13.03，**完全正常**。
 * 也就是说：**只在高频背景上翻车，看普通截图永远发现不了。**
 *
 * ── 判据 ──────────────────────────────────────────────────────────────
 *
 * 与 contrast-audit 同一套口径（scripts/lib/contrast.mjs）：
 * 截两张图（有字 / 无字）分离出字形像素，再按 WCAG 的方式用**指定文字色**
 * 与**真实背景像素**合成计算，而不是直接读渲染后的颜色。
 *
 *   node scripts/press-legibility.mjs
 */

import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { decodePng } from './lib/png.mjs';
import { measureMaskedContrast, parseColor } from './lib/contrast.mjs';

const AA_BODY = 4.5;

const HARNESS = {
  button: pathToFileURL(resolve('apps/www/dev/button-demo.html')).href,
  tabs: pathToFileURL(resolve('apps/www/dev/tabs-demo.html')).href,
  dialog: pathToFileURL(resolve('apps/www/dev/dialog-demo.html')).href,
  card: pathToFileURL(resolve('apps/www/dev/card-demo.html')).href,
};

/**
 * `gated: false` 的用例只打印、不判定。
 *
 * `plain` 变体**按定义就没有材质**（borderless 按钮），压在任意背景上时
 * 与一段裸文字没有区别 —— 本库给不了地板，这是调用方的责任。
 * 不把它排除掉而是照样量出来，是为了让这个事实**可见**，
 * 而不是悄悄从检查里消失。
 */
const CASES = [
  {
    name: 'Button · glass',
    harness: 'button',
    query: 'only=glass',
    target: '[data-slot="button"]',
    nth: 1,
    label: '[data-slot="button"] > span:last-child',
    press: true,
    gated: true,
  },
  {
    name: 'Button · prominent',
    harness: 'button',
    query: 'only=prominent',
    target: '[data-slot="button"]',
    nth: 1,
    label: '[data-slot="button"] > span:last-child',
    press: true,
    gated: true,
  },
  {
    name: 'Button · destructive',
    harness: 'button',
    query: 'only=destructive',
    target: '[data-slot="button"]',
    nth: 1,
    label: '[data-slot="button"] > span:last-child',
    press: true,
    gated: true,
  },
  {
    name: 'Button · plain（无材质，不判定）',
    harness: 'button',
    query: 'only=plain',
    target: '[data-slot="button"]',
    nth: 1,
    label: '[data-slot="button"] > span:last-child',
    press: true,
    gated: false,
  },
  {
    /**
     * Toggle 的**选中态**用 Layer I，而它是带标签的 —— 与 Button 的按下态
     * 是同一个陷阱，只不过这里是个持久状态而不是瞬时状态。
     * 组件里补了材质层，这条就是那层补偿的回归。
     * 用验证台里 defaultPressed 的那个（第 5 个），不用点。
     */
    name: 'Toggle · 选中态（Layer I）',
    harness: 'button',
    query: 'only=toggle',
    target: '[data-slot="toggle"]',
    nth: 4,
    label: '[data-slot="toggle"] > span:last-child',
    press: false,
    gated: true,
  },
  {
    /** Dialog 的标题与正文压在 elevated 面板上，且面板背后还有一层遮罩。 */
    name: 'Dialog · 标题',
    harness: 'dialog',
    query: 'open=1',
    target: '[data-slot="dialog-title"]',
    nth: 0,
    label: '[data-slot="dialog-title"]',
    press: false,
    gated: true,
  },
  {
    name: 'Dialog · 正文（次级标签色）',
    harness: 'dialog',
    query: 'open=1',
    target: '[data-slot="dialog-description"]',
    nth: 0,
    label: '[data-slot="dialog-description"]',
    press: false,
    gated: true,
  },
  {
    /**
     * Card 是内容层组件，没有玻璃 —— 但它照样有「标签压在半透明底上」的问题，
     * 只不过底换成了 Apple 的四档标准材质。`.lg-content` 的 alpha 也是从
     * a11y/legibility.ts 的地板推出来的（regular 亮色 0.78），这几条就是那组
     * 推导在真实渲染上的回归。
     */
    name: 'Card · grouped（不透明）',
    harness: 'card',
    query: 'only=grouped',
    target: '[data-slot="card-title"]',
    nth: 0,
    label: '[data-slot="card-title"]',
    press: false,
    gated: true,
  },
  {
    name: 'Card · material（内容层材质）',
    harness: 'card',
    query: 'only=material',
    target: '[data-slot="card-title"]',
    nth: 0,
    label: '[data-slot="card-title"]',
    press: false,
    gated: true,
  },
  {
    /**
     * `plain` 与 Button 的 `plain` 是同一个道理：**按定义就没有底**，
     * 给不了地板。照样量出来，只是为了让这个事实可见，不判定。
     */
    name: 'Card · plain（无底，不判定）',
    harness: 'card',
    query: 'only=plain',
    target: '[data-slot="card-title"]',
    nth: 0,
    label: '[data-slot="card-title"]',
    press: false,
    gated: false,
  },
  {
    /**
     * Tabs 的选中项标签压在 Layer I 指示器之上，与 Button 是同一类结构 ——
     * 必须一起量。（结论：它没事，因为指示器是**叠在底座材质上面**的，
     * 底座的底色仍在标签背后；Button 翻车是因为按钮**自己就是**那层底座。）
     */
    name: 'Tabs · 选中项标签（压在 Layer I 上）',
    harness: 'tabs',
    query: '',
    target: '[data-slot="tabs-trigger"][data-state="active"]',
    nth: 0,
    label: '[data-slot="tabs-trigger"][data-state="active"] > span:last-child',
    press: false,
    gated: true,
  },
];

const BACKGROUNDS = [
  { name: '渐变', bg: null },
  { name: '条纹', bg: 'stripes' }, // 6px 黑白，高频最坏情况
];

const browser = await chromium.launch();
let failed = 0;
const rows = [];

for (const c of CASES) {
  for (const b of BACKGROUNDS) {
    for (const pressed of c.press ? [false, true] : [false]) {
      const page = await browser.newPage({ viewport: { width: 640, height: 260 } });
      const q = `theme=light&tier=a&tint=0.34${c.query ? `&${c.query}` : ''}${b.bg ? `&bg=${b.bg}` : ''}`;
      await page.goto(`${HARNESS[c.harness]}?${q}`);
      await page.waitForFunction(() => window.__ready === true);
      await page.waitForTimeout(350);

      const el = page.locator(c.target).nth(c.nth);
      const box = await el.boundingBox();
      if (!box) throw new Error(`量不到元素：${c.target}`);

      if (pressed) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(600); // 等 spring 静止
      }

      const clip = {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
      const color = await page.evaluate(
        ([sel, n]) => getComputedStyle(document.querySelectorAll(sel)[n]).color,
        [c.target, c.nth],
      );

      const shown = decodePng(await page.screenshot({ clip }));
      await page.addStyleTag({
        content: `${c.label} { visibility: hidden !important }`,
      });
      await page.waitForTimeout(120);
      const hidden = decodePng(await page.screenshot({ clip }));
      if (pressed) await page.mouse.up();
      await page.close();

      const r = measureMaskedContrast(
        shown,
        hidden,
        { x: 0, y: 0, w: clip.width, h: clip.height },
        parseColor(color),
      );
      if (!r) throw new Error(`采样失败：${c.name}`);

      const ok = r.ratio >= AA_BODY;
      if (c.gated && !ok) failed++;
      rows.push({
        name: c.name,
        bg: b.name,
        state: pressed ? '按下' : '静止',
        ratio: r.ratio,
        samples: r.samples,
        ok,
        gated: c.gated,
      });
    }
  }
}
await browser.close();

console.log(`交互态可读性：${rows.length} 个测点，阈值 ${AA_BODY}:1（WCAG AA 正文）\n`);
for (const r of rows) {
  const mark = r.ok ? '✓' : r.gated ? '✗' : '·';
  console.log(
    `  ${mark} ${r.name.padEnd(34)} ${r.bg}  ${r.state}  ` +
      `${r.ratio.toFixed(2).padStart(6)}:1  (采样 ${r.samples})` +
      (r.gated ? '' : '   ← 不判定'),
  );
}

if (failed) {
  console.log(`\n✗ ${failed} 个测点不过 AA。`);
  console.log('  最常见的原因：某个状态把材质的不透明度变成了 0（例如切到 Layer I），');
  console.log('  a11y/legibility.ts 的地板保证依赖 α > 0，α 归零则保证失效。');
  process.exit(1);
}
console.log('\n✓ 全部达标');
