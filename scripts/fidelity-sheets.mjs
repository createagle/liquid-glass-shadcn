/**
 * 生成 Fidelity 并排对照图 → `apps/www/public/fidelity/compare-*.png`
 *
 * Phase 3 任务卡要求「附一张 iOS 截图 vs 组件截图的并排对照图」。
 * 页面在 `apps/www/dev/fidelity.html`，本脚本负责把它渲染成图。
 *
 * ⚠️ 左侧一律是 **Apple Design Resources 的 Figma 渲染图，不是真机截图**。
 *    静态设计稿画不出折射与色散，所以「材质」那一栏本来就不可比；
 *    可比的是**几何**。每张图的说明里都写了具体差异，不要泛泛说「基本一致」。
 *
 * Dialog 与 Sheet 那两张要分开先截：它们都是 portal + fixed 的，塞不进对照页的栏里，
 * 所以先把**真实组件**单独截一张，再让对照页把它当图片引进去 ——
 * 这样对照的仍然是真组件，而不是照着尺寸另画一遍（那样会和组件悄悄漂移）。
 *
 * Sheet 那张更进一步：验证台按 **402×874** 渲染（就是参考图那块屏），
 * medium 档正好是 0.525×874 = 459 —— 于是裁切框与参考图**用的是同一组坐标**
 * （x=6, y=409, 390×459），两边逐像素对得上。
 *
 *   node scripts/fidelity-sheets.mjs
 */

import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const dev = (f) => pathToFileURL(resolve('apps/www/dev', f)).href;
const OUT = 'apps/www/public/fidelity';

const browser = await chromium.launch();

/* ── 第一趟：把真实的 Dialog 面板单独截出来 ─────────────────────────── */
{
  // dsf 与对照页一致（2），否则引进去会被放大成糊的
  const page = await browser.newPage({
    viewport: { width: 520, height: 480 },
    deviceScaleFactor: 2,
  });
  await page.goto(`${dev('dialog-demo.html')}?theme=light&tier=a&tint=0.34&open=1`);
  await page.waitForFunction(() => window.__ready === true);
  await page.waitForTimeout(800); // 等入场 spring 静止
  /**
   * 先把焦点摘掉再截图。
   *
   * Radix 打开弹窗时会把焦点送进去（这是对的，键盘用户需要），于是第一个按钮
   * 带着 focus-visible 的蓝环。那是**正确的无障碍行为，不是样式 bug**，
   * 但对照图要比的是材质与几何，一道焦点环只会干扰阅读。
   * 只影响这张图，不影响组件本身。
   */
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.waitForTimeout(120);
  await page
    .locator('[data-slot="dialog-content"] .lg-surface[data-layer="elevated"]')
    .screenshot({ path: 'apps/www/dev/dialog-shot.png' });
  await page.close();
}

/* ── 第二趟：把真实的 Sheet 单独截出来 ───────────────────────────────── */
{
  const page = await browser.newPage({
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 2,
  });
  await page.goto(`${dev('sheet-demo.html')}?theme=light&tier=a&tint=0.34&open=1&detent=0`);
  await page.waitForFunction(() => window.__ready === true);
  // 等入场 spring 停下来：面板位移连续几帧不变
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-slot="sheet-panel"]');
      if (!el) return false;
      const y = new DOMMatrixReadOnly(getComputedStyle(el).transform).m42;
      if (window.__y !== undefined && Math.abs(window.__y - y) < 0.05) window.__n = (window.__n ?? 0) + 1;
      else window.__n = 0;
      window.__y = y;
      return (window.__n ?? 0) >= 4;
    },
    null,
    { timeout: 8000 },
  );
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.waitForTimeout(120);
  // 与参考图同一组坐标：面板左右各内缩 6，medium 档露出 459
  await page.screenshot({
    path: 'apps/www/dev/sheet-shot.png',
    clip: { x: 6, y: 874 - 6 - 459, width: 390, height: 459 },
  });
  await page.close();
}

/* ── 第三趟：渲染对照页 ─────────────────────────────────────────────── */
{
  const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(dev('fidelity.html'));
  await page.waitForFunction(() => window.__ready === true);
  await page.waitForTimeout(700);
  for (const id of ['sheet-switch', 'sheet-slider', 'sheet-button', 'sheet-dialog', 'sheet-card', 'sheet-sheet']) {
    const name = id.replace('sheet-', '');
    await page.locator(`#${id}`).screenshot({ path: `${OUT}/compare-${name}.png` });
    console.log(`✓ ${OUT}/compare-${name}.png`);
  }
  await page.close();
}

await browser.close();
