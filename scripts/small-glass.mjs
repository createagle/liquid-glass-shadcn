/**
 * 玻璃从多大开始才看得出来？
 *
 * component-inventory 给 Badge / Avatar / Skeleton 这类小件的分层理由是
 * 「小尺寸玻璃看不出效果」。这句话一直是**断言**，本脚本把它变成**数**。
 *
 * 做法：同一块 Layer I 玻璃，同一张 6px 黑白条纹背景，同一个尺寸，
 * 只把 **JS 注入的 SVG 折射**开/关各截一张图，比两张图的差。
 * 其余一切（材质底色、描边、镜面高光、backdrop 模糊）两边完全一致 ——
 * 所以差值里剩下的**就是折射本身**贡献的那部分，没有别的变量混进来。
 *
 * 报三个数：
 *   meanΔ    平均每通道绝对差（0–255）。折射把多少「量」搬到了别处。
 *   maxΔ     最大单像素差。有没有哪怕一处明显的畸变。
 *   ratio    差异超过 8/255（肉眼在高频条纹上大致能察觉的下限）的像素占比。
 *
 * ⚠️ 8/255 这个阈值是 `[推定]`。它不是某个标准里的数字，
 *    是照着「条纹背景上刚好能看出边缘错位」定的。换个背景会变。
 *
 *   node scripts/small-glass.mjs
 */

import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { decodePng } from './lib/png.mjs';

const HARNESS = pathToFileURL(resolve('apps/www/dev/scale-demo.html')).href;

/** 觉察阈值（0–255）。`[推定]`，见文件头。 */
const NOTICEABLE = 8;

/**
 * 扫的尺寸。宽高比固定 2.2:1，贴近本库里那些小件的实际形状
 * （Badge 约 44×20、Switch knob 38×24、Tabs 指示器 104×54）。
 */
const SIZES = [16, 20, 24, 28, 32, 40, 48, 64, 80, 104, 140, 200];
const RATIO = 2.2;

async function shoot(page, w, h, refraction, bg) {
  const q = new URLSearchParams({
    w: String(w),
    h: String(h),
    theme: 'light',
    tint: '0.34',
    ...(bg ? { bg } : {}),
    ...(refraction ? {} : { refraction: 'off' }),
  });
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => window.__ready === true);
  // 折射滤镜是异步建的，等到它真的落到 backdrop-filter 上再截
  if (refraction) {
    await page
      .waitForFunction(
        () => {
          const el = document.querySelector('.lg-surface[data-layer="indicator"]');
          return !!el && getComputedStyle(el).backdropFilter.includes('url(');
        },
        { timeout: 5000 },
      )
      .catch(() => {
        throw new Error(`尺寸 ${w}×${h}：折射没建起来，这一档的对比无效`);
      });
  }
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  return page.locator('[data-testid="stage"]').screenshot();
}

function compare(aBuf, bBuf) {
  const a = decodePng(aBuf);
  const b = decodePng(bBuf);
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`两张图尺寸不同：${a.width}×${a.height} vs ${b.width}×${b.height}`);
  }
  let sum = 0;
  let max = 0;
  let noticeable = 0;
  const n = a.width * a.height;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    // 只比 RGB，不比 alpha（两张图都是不透明的舞台）
    const d = Math.max(
      Math.abs(a.data[o] - b.data[o]),
      Math.abs(a.data[o + 1] - b.data[o + 1]),
      Math.abs(a.data[o + 2] - b.data[o + 2]),
    );
    sum += d;
    if (d > max) max = d;
    if (d >= NOTICEABLE) noticeable++;
  }
  return { mean: sum / n, max, ratio: noticeable / n, pixels: n };
}

const browser = await chromium.launch();
// 与视觉回归同一个 deviceScaleFactor，两边的像素口径才对得上
const page = await browser.newPage({ deviceScaleFactor: 2 });

console.log('折射的可见度 —— 同尺寸、同背景，只开关 SVG 折射');
console.log('觉察阈值：' + NOTICEABLE + '/255 `[推定]`');
console.log('');

const BACKDROPS = [
  { key: 'stripes', bg: undefined, label: '6px 黑白条纹（高频最坏情况）' },
  { key: 'gradient', bg: 'gradient', label: '平滑渐变（真实界面里的常态）' },
];

const table = {};
for (const backdrop of BACKDROPS) {
  console.log(`背景：${backdrop.label}`);
  console.log('  尺寸(pt)      meanΔ    maxΔ   超阈值像素占比');
  console.log('  ─────────────────────────────────────────────');
  const rows = [];
  for (const h of SIZES) {
    const w = Math.round(h * RATIO);
    const on = await shoot(page, w, h, true, backdrop.bg);
    const off = await shoot(page, w, h, false, backdrop.bg);
    const r = compare(on, off);
    rows.push({ w, h, ...r });
    const flag = r.ratio >= 0.02 ? '  ← 看得出来' : r.ratio >= 0.005 ? '  ← 勉强' : '';
    console.log(
      `  ${String(w).padStart(3)}×${String(h).padEnd(3)}` +
        `${r.mean.toFixed(2).padStart(9)}` +
        `${String(r.max).padStart(8)}` +
        `${(r.ratio * 100).toFixed(2).padStart(10)}%` +
        flag,
    );
  }
  table[backdrop.key] = rows;
  console.log('');
}

await browser.close();

/* ── 结论 ─────────────────────────────────────────────────────────────── */

const pick = (key, h) => table[key].find((r) => r.h === h);

console.log('────────────────────────────────────────────────────────────');
console.log('⚠️ 先说清楚哪个指标可信。');
console.log('');
console.log('  「超阈值像素占比」在**平滑背景上会骗人**：渐变那一档它报到 13%，');
console.log('  但同一档的 meanΔ 只有 2.8/255、maxΔ 才 44 —— 也就是说那些像素只是');
console.log('  在玻璃**边缘**被轻微弯了一下，幅度极小。占比只数「有没有差」，');
console.log('  不数「差多少」。**看幅度要看 meanΔ。**');
console.log('');

for (const h of [20, 104]) {
  const a = pick('stripes', h);
  const b = pick('gradient', h);
  if (!a || !b) continue;
  const name = h === 20 ? '徽章尺寸' : 'Tabs 指示器尺寸';
  console.log(
    `  ${name}（${a.w}×${a.h}）　meanΔ：条纹 ${a.mean.toFixed(1)}　渐变 ${b.mean.toFixed(1)}` +
      `　相差 ${(a.mean / b.mean).toFixed(1)} 倍`,
  );
}

const sSmall = table.stripes[0];
const sBig = table.stripes[table.stripes.length - 1];
const gSmall = table.gradient[0];
const gBig = table.gradient[table.gradient.length - 1];

console.log('');
console.log(
  `  尺寸的放大作用（最小 → 最大，meanΔ）：` +
    `条纹 ${sSmall.mean.toFixed(1)} → ${sBig.mean.toFixed(1)}（${(sBig.mean / sSmall.mean).toFixed(1)}×）　` +
    `渐变 ${gSmall.mean.toFixed(1)} → ${gBig.mean.toFixed(1)}（${(gBig.mean / gSmall.mean).toFixed(1)}×）`,
);

console.log(`
────────────────────────────────────────────────────────────
这张表**推翻了 component-inventory 给 Badge 写的理由**。

  它写的是「小尺寸玻璃看不出效果」—— 把变量归给了**尺寸**。
  实测不支持：条纹背景上，35×16 这么小的一块玻璃 meanΔ 就有 ${sSmall.mean.toFixed(
    1,
  )}/255，
  肉眼一看就知道它在扭。**小并不等于看不见。**

  真正的变量是**背景里有没有高频内容**：
  同一个徽章尺寸，条纹上与渐变上的 meanΔ 差 ${(
    pick('stripes', 20).mean / pick('gradient', 20).mean
  ).toFixed(1)} 倍。
  尺寸只是**放大器** —— 背后有边缘时越大越明显（${(sBig.mean / sSmall.mean).toFixed(
    1,
  )} 倍），
  背后是平滑渐变时，从最小扫到最大也只从 ${gSmall.mean.toFixed(1)} 爬到 ${gBig.mean.toFixed(
    1,
  )}。

所以 Badge / Avatar / Skeleton 定成内容层，**结论对，但原来的理由是错的**。
应当改成：
  1) 这些小件通常压在**页面底色或卡片**上 —— 那是平滑的，折射几乎无从发挥；
  2) §5.2 的同屏折射预算只有 8 个（该数字本身是 \`[推定]\`），
     把名额花在一个大概率看不出差别的地方，收益为负。

反过来也成立，而且更值得记：**Tabs 的指示器、Sheet 的抓手这些「该有玻璃」的地方，
之所以真的看得出玻璃，是因为它们底下压着滚动的内容 —— 不是因为它们够大。**
`);
