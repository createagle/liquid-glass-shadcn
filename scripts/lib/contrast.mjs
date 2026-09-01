/**
 * 对比度测量 —— 供 `contrast-audit.mjs` 与 `adaptive-probe.mjs` 共用。
 *
 * ── 为什么用「差分测量」而不是「读 CSS 色再合成」 ────────────────────
 *
 * 早先的测法是：读出文字的 CSS `color` → 把它按 alpha 合成到「隐藏文字后
 * 截图」的每个像素上 → 取包围盒内最差的一个。这个测法有两个硬伤：
 *
 *   1. **会采到元素之外的像素。** 文字的包围盒是矩形，玻璃面是圆角矩形。
 *      靠近圆角的文字，其包围盒的角会落在圆角外面，采到的是页面背景。
 *      实测把 `base-inline/secondary` 误报成 1:1（底座 26px 圆角，
 *      文字框右上角正好在圆角外的白色页面上）—— 纯属测量假阳性。
 *
 *   2. **对 `mix-blend-mode` 完全失效。** 一旦文字用了混合模式，它的最终
 *      颜色就不是 CSS `color`，而是与底下像素混合的结果。
 *
 * 差分测量改为：渲染两次（文字可见 / `visibility:hidden`），逐像素相减，
 * 变化大的就是字形像素；用「可见图的颜色」当前景、「隐藏图的颜色」当背景。
 * 测的是屏幕上真实发生的事，对任何实现手段都成立，也不会采到字形以外的地方。
 *
 * 代价是要处理反锯齿：字形边缘像素是半覆盖的，对比度天然偏低。
 * 故只统计覆盖度足够高的「核心像素」，门槛见 CORE_COVERAGE。
 */

/** 只有变化量 ≥ 该测点内最大变化量的这个比例，才算核心字形像素。 */
export const CORE_COVERAGE = 0.75;

/** WCAG 相对亮度 */
export function luminance(r, g, b) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(l1, l2) {
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** WCAG 的「大字」定义：≥24px，或 ≥18.66px 且加粗 */
export function isLargeText(fontSize, fontWeight) {
  const weight = Number(fontWeight) || 400;
  return fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
}

/**
 * 差分测量一个测点的最差对比度。
 *
 * @param {{width:number,height:number,data:Uint8Array}} shown  文字可见时的截图
 * @param {{width:number,height:number,data:Uint8Array}} hidden 文字隐藏时的截图
 * @param {{x:number,y:number,w:number,h:number}} box           测点包围盒
 * @returns {{ratio:number, samples:number, pixel:object|null, invisible:boolean}|null}
 */
export function measureGlyphContrast(shown, hidden, box) {
  const { width, height } = shown;
  const x0 = Math.max(0, box.x);
  const y0 = Math.max(0, box.y);
  const x1 = Math.min(width, box.x + box.w);
  const y1 = Math.min(height, box.y + box.h);
  if (x1 <= x0 || y1 <= y0) return null;

  const deltaAt = (x, y) => {
    const i = (y * width + x) * 4;
    return Math.max(
      Math.abs(shown.data[i] - hidden.data[i]),
      Math.abs(shown.data[i + 1] - hidden.data[i + 1]),
      Math.abs(shown.data[i + 2] - hidden.data[i + 2]),
    );
  };

  let maxDelta = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const d = deltaAt(x, y);
      if (d > maxDelta) maxDelta = d;
    }
  }

  // 文字与背景完全同色 → 根本没有字形像素 → 就是 1:1（真·看不见）
  if (maxDelta < 3) return { ratio: 1, samples: 0, pixel: null, invisible: true };

  const gate = maxDelta * CORE_COVERAGE;
  let worst = Infinity;
  let worstPixel = null;
  let samples = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (deltaAt(x, y) < gate) continue;
      samples++;
      const i = (y * width + x) * 4;
      const lf = luminance(shown.data[i], shown.data[i + 1], shown.data[i + 2]);
      const lb = luminance(hidden.data[i], hidden.data[i + 1], hidden.data[i + 2]);
      const c = contrast(lf, lb);
      if (c < worst) {
        worst = c;
        worstPixel = {
          x,
          y,
          fg: [shown.data[i], shown.data[i + 1], shown.data[i + 2]],
          bg: [hidden.data[i], hidden.data[i + 1], hidden.data[i + 2]],
        };
      }
    }
  }

  if (!samples) return { ratio: 1, samples: 0, pixel: null, invisible: true };
  return { ratio: worst, samples, pixel: worstPixel, invisible: false };
}

/** 解析 `rgb(r, g, b)` / `rgba(r, g, b, a)` */
export function parseColor(css) {
  const m = css.match(/[\d.]+/g);
  if (!m) throw new Error(`无法解析颜色：${css}`);
  return {
    r: Number(m[0]),
    g: Number(m[1]),
    b: Number(m[2]),
    a: m[3] === undefined ? 1 : Number(m[3]),
  };
}

/**
 * 掩膜式测量 —— **合规审计用这个**，不要用 measureGlyphContrast。
 *
 * 两者的分工：
 *
 *   `measureGlyphContrast`  纯差分，测「屏幕上真实的像素」。
 *      唯一能评估 `mix-blend-mode` 之类方案的办法，实验台用它。
 *      但它会把**反锯齿边缘**算进来 —— 半覆盖的边缘像素对比度天然偏低，
 *      而 WCAG 判定的是**文字色与背景色**，并不惩罚字形边缘。
 *
 *   `measureMaskedContrast`（本函数）按 WCAG 的定义算：用**指定的文字色**
 *      合成到背景上。但只在「差分显示确实有字形」的像素上取样，
 *      从而避开旧实现的 bug —— 按整个矩形包围盒取样会采到圆角之外的页面背景，
 *      曾把 `base-inline/secondary` 误报成 1:1。
 *
 * @param {{r:number,g:number,b:number,a:number}} textColor 指定的文字色
 */
export function measureMaskedContrast(shown, hidden, box, textColor) {
  const { width, height } = shown;
  const x0 = Math.max(0, box.x);
  const y0 = Math.max(0, box.y);
  const x1 = Math.min(width, box.x + box.w);
  const y1 = Math.min(height, box.y + box.h);
  if (x1 <= x0 || y1 <= y0) return null;

  const deltaAt = (x, y) => {
    const i = (y * width + x) * 4;
    return Math.max(
      Math.abs(shown.data[i] - hidden.data[i]),
      Math.abs(shown.data[i + 1] - hidden.data[i + 1]),
      Math.abs(shown.data[i + 2] - hidden.data[i + 2]),
    );
  };

  let maxDelta = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const d = deltaAt(x, y);
      if (d > maxDelta) maxDelta = d;
    }
  }
  // 完全没有字形像素 = 文字与背景同色，真·看不见
  if (maxDelta < 3) return { ratio: 1, samples: 0, pixel: null, invisible: true };

  const gate = maxDelta * CORE_COVERAGE;
  let worst = Infinity;
  let worstPixel = null;
  let samples = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (deltaAt(x, y) < gate) continue;
      samples++;
      const i = (y * width + x) * 4;
      const br = hidden.data[i];
      const bg = hidden.data[i + 1];
      const bb = hidden.data[i + 2];
      // WCAG 口径：用**指定**文字色按其 alpha 合成，而不是读渲染后的像素
      const fr = textColor.a * textColor.r + (1 - textColor.a) * br;
      const fg = textColor.a * textColor.g + (1 - textColor.a) * bg;
      const fb = textColor.a * textColor.b + (1 - textColor.a) * bb;
      const c = contrast(luminance(fr, fg, fb), luminance(br, bg, bb));
      if (c < worst) {
        worst = c;
        worstPixel = { x, y, bg: [br, bg, bb] };
      }
    }
  }

  if (!samples) return { ratio: 1, samples: 0, pixel: null, invisible: true };
  return { ratio: worst, samples, pixel: worstPixel, invisible: false };
}
