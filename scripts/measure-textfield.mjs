/**
 * 量 iOS 27 资源里那四行 Text Field —— 本库 Input 的唯一基准。
 *
 * 图：docs/research/screenshots/ios27-list-screen.png（402×874，示例帧 1:1 = pt）
 * 内容：一个 Grouped List，四行文本框，分别是
 *   1 占位符（未聚焦）  2 聚焦空态（有光标）  3 有值 + 光标 + 清除按钮  4 有值（未聚焦）
 *
 * ⚠️ 这张图最重要的结论不是某个数值，而是**这些文本框没有自己的框**：
 * 没有描边、没有填充、没有玻璃，只是分组列表里的行。见文末。
 *
 * 只输出量到的东西。量不到的就说量不到 —— 不推一个数出来充数。
 *
 *   node scripts/measure-textfield.mjs
 */

import { readFileSync } from 'node:fs';
import { decodePng } from './lib/png.mjs';

const png = decodePng(readFileSync('docs/research/screenshots/ios27-list-screen.png'));
const { width: W, height: H, data } = png;

const px = (x, y) => {
  const i = (y * W + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};
const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
// ⚠️ px() 返回 RGBA 四元组，参考色是 RGB 三元组 —— 用参考色驱动比较，
//    否则第四位拿 undefined 去减会得到 NaN，任何比较都是 false，全表扫空。
const eq = (a, b, tol = 2) => b.every((v, i) => Math.abs(a[i] - v) <= tol);

const CARD = [255, 255, 255];
const isCard = (x, y) => eq(px(x, y), CARD, 1);

console.log(`图：${W}×${H}\n`);

/* ── 区块边界 ─────────────────────────────────────────────────────────── */
const midX = Math.floor(W / 2);
let top = -1;
let bottom = -1;
for (let y = 0; y < H; y++) {
  if (isCard(midX, y)) {
    if (top < 0) top = y;
    bottom = y;
  }
}
const midY = Math.floor((top + bottom) / 2);
let left = -1;
let right = -1;
for (let x = 0; x < W; x++) {
  if (isCard(x, midY)) {
    if (left < 0) left = x;
    right = x;
  }
}
const cardW = right - left + 1;
const cardH = bottom - top + 1;
console.log(`区块  x ${left}–${right}（宽 ${cardW}） · y ${top}–${bottom}（高 ${cardH}） · 页边距 ${left}`);

/* ── 分隔线 ───────────────────────────────────────────────────────────────
 * ⚠️ 探针列要同时避开三样东西：左侧文字、右侧清除按钮、圆角抗锯齿。
 *    x=300 落在所有行的空白区里。
 */
const probeX = 300;
const seps = [];
for (let y = top + 1; y < bottom; y++) {
  if (!isCard(probeX, y)) seps.push({ y, hex: hex(px(probeX, y)) });
}
console.log(`\n分隔线（x=${probeX} 竖扫）`);
for (const s of seps) console.log(`  y ${s.y}  ${s.hex}`);
const pitches = seps.slice(1).map((s, i) => s.y - seps[i].y);
console.log(`  间距 = 行高：${pitches.join(', ')}`);
console.log(`  首条距顶 ${seps[0].y - top + 1} · 末条距底 ${bottom - seps[seps.length - 1].y}`);

/* 分隔线的水平范围 —— 在分隔线那一行横扫，跳过圆角抗锯齿带 */
const sy = seps[0].y;
let sl = -1;
let sr = -1;
for (let x = left + 3; x <= right - 3; x++) {
  if (!isCard(x, sy)) {
    if (sl < 0) sl = x;
    sr = x;
  }
}
console.log(`  水平范围 x ${sl}–${sr}（宽 ${sr - sl + 1}） → 相对区块内缩 左 ${sl - left} / 右 ${right - sr}`);

/* ── 逐行取样 ─────────────────────────────────────────────────────────── */
const bands = [];
let y0 = top;
for (const s of seps) {
  bands.push([y0, s.y - 1]);
  y0 = s.y + 1;
}
bands.push([y0, bottom]);

const LABELS = ['占位符（未聚焦）', '聚焦空态（有光标）', '有值 + 光标 + 清除按钮', '有值（未聚焦）'];

console.log('\n逐行取样');
for (let r = 0; r < bands.length; r++) {
  const [a, b] = bands[r];
  // 只在圆角影响不到的水平区间里取样
  const x0 = left + 4;
  const x1 = right - 4;

  let darkest = null;
  let bluest = null;
  let inkLeft = -1;
  let inkRight = -1;
  let inkTop = -1;
  let inkBottom = -1;
  for (let y = a; y <= b; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = px(x, y);
      if (eq(p, CARD, 3)) continue;
      const lum = p[0] + p[1] + p[2];
      if (!darkest || lum < darkest.lum) darkest = { lum, p, x, y };
      const blueness = p[2] - (p[0] + p[1]) / 2;
      if (!bluest || blueness > bluest.blueness) bluest = { blueness, p, x, y };
      if (inkLeft < 0 || x < inkLeft) inkLeft = x;
      if (x > inkRight) inkRight = x;
      if (inkTop < 0) inkTop = y;
      inkBottom = y;
    }
  }

  console.log(`\n  ${LABELS[r] ?? `第 ${r + 1} 行`}   y ${a}–${b}（高 ${b - a + 1}）`);
  if (!darkest) {
    console.log('      整行纯白 —— 没有任何墨迹');
    continue;
  }
  console.log(`      墨迹水平 x ${inkLeft}–${inkRight}  → 左内缩 ${inkLeft - left} / 右内缩 ${right - inkRight}`);
  console.log(`      墨迹垂直 y ${inkTop}–${inkBottom}（高 ${inkBottom - inkTop + 1}）  行内居中偏移 上 ${inkTop - a} / 下 ${b - inkBottom}`);
  console.log(`      最深 ${hex(darkest.p)}`);
  if (bluest.blueness > 20) console.log(`      最蓝 ${hex(bluest.p)} @ x=${bluest.x}`);
}

/* ── 光标：第 2 行是聚焦空态，整行只有光标一个墨迹 ─────────────────────── */
const [ca, cb] = bands[1];
let caretX0 = -1;
let caretX1 = -1;
let caretY0 = -1;
let caretY1 = -1;
for (let y = ca; y <= cb; y++) {
  for (let x = left + 4; x <= right - 4; x++) {
    if (eq(px(x, y), CARD, 3)) continue;
    if (caretX0 < 0 || x < caretX0) caretX0 = x;
    if (x > caretX1) caretX1 = x;
    if (caretY0 < 0) caretY0 = y;
    caretY1 = y;
  }
}
console.log(
  `\n光标（第 2 行整行只有它）  ${caretX1 - caretX0 + 1} × ${caretY1 - caretY0 + 1} px` +
    `  色 ${hex(px(caretX0, Math.floor((caretY0 + caretY1) / 2)))}` +
    `  左内缩 ${caretX0 - left}`,
);

/* ── 清除按钮：第 3 行右侧那个圆 ───────────────────────────────────────── */
const [ea, eb] = bands[2];
let bx0 = -1;
let bx1 = -1;
let by0 = -1;
let by1 = -1;
for (let y = ea; y <= eb; y++) {
  for (let x = right - 60; x <= right - 4; x++) {
    if (eq(px(x, y), CARD, 3)) continue;
    if (bx0 < 0 || x < bx0) bx0 = x;
    if (x > bx1) bx1 = x;
    if (by0 < 0) by0 = y;
    by1 = y;
  }
}
if (bx0 >= 0) {
  const cx = Math.floor((bx0 + bx1) / 2);
  const cy = Math.floor((by0 + by1) / 2);
  console.log(
    `清除按钮  ${bx1 - bx0 + 1} × ${by1 - by0 + 1} px  右内缩 ${right - bx1}` +
      `  圆底色 ${hex(px(bx0 + 2, cy))}  中心 ${hex(px(cx, cy))}`,
  );
}

console.log(`
────────────────────────────────────────────────────────────────────────
这张图真正的结论：**iOS 的表单文本框没有自己的框。**
没有描边、没有填充、没有玻璃 —— 就是分组列表里的一行，靠 1px 分隔线分行。
所以 component-inventory 把 Input 标成「B（iOS 26 输入框是玻璃控件）」
在**表单场景里是错的**。玻璃输入框存在于另一个场景（搜索栏），不是这个。
────────────────────────────────────────────────────────────────────────`);
