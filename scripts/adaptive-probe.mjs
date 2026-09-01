/**
 * 元素级明暗自适应 —— 候选方案实测台。
 *
 * 与 `contrast-audit.mjs` 的区别，也是本脚本存在的理由：
 *
 *   contrast-audit 的测法是「读出文字的 CSS 颜色 → 合成到背景像素上 → 算对比度」。
 *   这个测法有个前提：**文字的最终颜色等于它的 CSS color**。
 *   一旦候选方案用了 `mix-blend-mode`，这个前提就破了 —— 文字的实际颜色
 *   是它与底下像素混合的结果，CSS color 只是混合的输入之一。
 *
 * 所以这里改用**差分测量**：
 *   1. 渲染两次：一次文字可见，一次 `visibility:hidden`（布局不变）
 *   2. 两张图逐像素相减，变化大的就是字形像素
 *   3. 对每个字形像素，用「可见那张的颜色」当前景、「隐藏那张的颜色」当背景
 *
 * 这样测的是**屏幕上真实发生的事**，对任何实现手段都成立。
 * 代价是要处理反锯齿：字形边缘像素是半覆盖的，对比度天然偏低，
 * 会把结论压成一片红。故只取覆盖度足够高的「核心像素」，见 CORE_COVERAGE。
 */

import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from './lib/png.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const FIXTURE = resolve(ROOT, 'packages/glass-core/debug/adaptive-fixture.html');

const AA_BODY = 4.5;

/** 只有覆盖度 ≥ 此比例（相对该测点内最大变化量）的像素才算「核心字形像素」。
 *  取 0.75 是权衡：太低会把反锯齿边缘算进来（虚假失败），
 *  太高会只剩笔画正中心几个点（样本太少，掩盖真实问题）。 */
const CORE_COVERAGE = 0.75;

const THEMES = ['light', 'dark'];
const BACKGROUNDS = ['black', 'white', 'mid', 'checker', 'saturated', 'photo'];
/** PROJECT_SPEC §13 点名档位 0（最通透）是最不利条件，本实验只测它。 */
const TINT = 0;

const CANDIDATES = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'];
const CAND_LABEL = {
  c0: 'C0 基线（当前实现）',
  c1: 'C1 alpha 地板',
  c2: 'C2 亮度钳制',
  c3: 'C3 difference 混合',
  c4: 'C4 元素级自适应',
  c5: 'C5 自适应+地板',
};

function luminance(r, g, b) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(l1, l2) {
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * 差分测量一个测点。
 * @returns {{ratio:number, samples:number, pixel:object}|null}
 */
function measurePoint(shown, hidden, box) {
  const { width, height } = shown;
  const x0 = Math.max(0, box.x);
  const y0 = Math.max(0, box.y);
  const x1 = Math.min(width, box.x + box.w);
  const y1 = Math.min(height, box.y + box.h);
  if (x1 <= x0 || y1 <= y0) return null;

  // 第一遍：找出该框内的最大变化量，用来定核心像素的门槛
  let maxDelta = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const d = Math.max(
        Math.abs(shown.data[i] - hidden.data[i]),
        Math.abs(shown.data[i + 1] - hidden.data[i + 1]),
        Math.abs(shown.data[i + 2] - hidden.data[i + 2]),
      );
      if (d > maxDelta) maxDelta = d;
    }
  }

  // 文字与背景完全同色 → 根本没有字形像素 → 对比度就是 1:1
  if (maxDelta < 3) {
    return { ratio: 1, samples: 0, pixel: null, invisible: true };
  }

  const gate = maxDelta * CORE_COVERAGE;
  let worst = Infinity;
  let worstPixel = null;
  let samples = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const d = Math.max(
        Math.abs(shown.data[i] - hidden.data[i]),
        Math.abs(shown.data[i + 1] - hidden.data[i + 1]),
        Math.abs(shown.data[i + 2] - hidden.data[i + 2]),
      );
      if (d < gate) continue;
      samples++;

      const lf = luminance(shown.data[i], shown.data[i + 1], shown.data[i + 2]);
      const lb = luminance(hidden.data[i], hidden.data[i + 1], hidden.data[i + 2]);
      const c = contrast(lf, lb);
      if (c < worst) {
        worst = c;
        worstPixel = {
          x, y,
          fg: [shown.data[i], shown.data[i + 1], shown.data[i + 2]],
          bg: [hidden.data[i], hidden.data[i + 1], hidden.data[i + 2]],
        };
      }
    }
  }

  if (!samples) return { ratio: 1, samples: 0, pixel: null, invisible: true };
  return { ratio: worst, samples, pixel: worstPixel };
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 900, height: 560 },
    deviceScaleFactor: 1,
  });

  // results[theme][cand][kind] = [{bg, ratio, ...}]
  const results = {};

  for (const theme of THEMES) {
    results[theme] = {};
    for (const bg of BACKGROUNDS) {
      const url =
        pathToFileURL(FIXTURE).href + `?theme=${theme}&tint=${TINT}&tier=a&bg=${bg}`;
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__ready === true);

      const points = await page.evaluate(() => window.__collect());

      const settle = () =>
        page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );

      await settle();
      const shownPng = decodePng(await page.screenshot({ type: 'png' }));

      await page.evaluate(() => window.__setTextHidden(true));
      await settle();
      const hiddenPng = decodePng(await page.screenshot({ type: 'png' }));
      await page.evaluate(() => window.__setTextHidden(false));

      for (const p of points) {
        const [cand, kind] = p.point.split('/');
        const m = measurePoint(shownPng, hiddenPng, p.box);
        if (!m) continue;
        results[theme][cand] ??= {};
        results[theme][cand][kind] ??= [];
        results[theme][cand][kind].push({
          bg,
          ratio: m.ratio,
          samples: m.samples,
          invisible: m.invisible ?? false,
          adaptedTo: p.adaptedTo,
          pixel: m.pixel,
        });
      }
    }
  }

  await browser.close();

  // ── 输出 ───────────────────────────────────────────────────────────
  console.log('元素级明暗自适应 —— 候选方案实测');
  console.log(`档位 ${TINT}（最通透，PROJECT_SPEC §13 指定的最不利条件）· Tier A`);
  console.log(`阈值 ${AA_BODY}:1（WCAG AA 正文）· 差分测量，核心像素门槛 ${CORE_COVERAGE}`);
  console.log('');

  for (const theme of THEMES) {
    console.log(`\n━━━ ${theme === 'dark' ? '暗色主题' : '亮色主题'} ━━━`);
    const head = ['候选', '标签', ...BACKGROUNDS, '最差'].map((h) => h.padEnd(10)).join('');
    console.log(head);
    console.log('─'.repeat(head.length));

    for (const cand of CANDIDATES) {
      for (const kind of ['primary', 'secondary']) {
        const rows = results[theme]?.[cand]?.[kind] ?? [];
        if (!rows.length) continue;
        const byBg = Object.fromEntries(rows.map((r) => [r.bg, r]));
        const cells = BACKGROUNDS.map((bg) => {
          const r = byBg[bg];
          if (!r) return '—'.padEnd(10);
          const v = r.ratio === Infinity ? '∞' : r.ratio.toFixed(2);
          return (v + (r.ratio >= AA_BODY ? ' ✓' : ' ✗')).padEnd(10);
        });
        const worst = Math.min(...rows.map((r) => r.ratio));
        console.log(
          (cand === 'c0' || kind === 'primary' ? cand : '').padEnd(10) +
            kind.padEnd(10) +
            cells.join('') +
            (worst.toFixed(2) + (worst >= AA_BODY ? ' ✓' : ' ✗')).padEnd(10),
        );
      }
    }
  }

  // ── 判定 ───────────────────────────────────────────────────────────
  console.log('\n\n━━━ 判定 ━━━');
  const verdicts = [];
  for (const cand of CANDIDATES) {
    let worst = Infinity;
    let worstWhere = '';
    for (const theme of THEMES) {
      for (const kind of ['primary', 'secondary']) {
        for (const r of results[theme]?.[cand]?.[kind] ?? []) {
          if (r.ratio < worst) {
            worst = r.ratio;
            worstWhere = `${theme}/${kind}/${r.bg}`;
          }
        }
      }
    }
    verdicts.push({ cand, worst, worstWhere });
  }
  verdicts.sort((a, b) => b.worst - a.worst);
  for (const v of verdicts) {
    const ok = v.worst >= AA_BODY;
    console.log(
      `${ok ? '✅' : '❌'} ${CAND_LABEL[v.cand].padEnd(22)} 全场最差 ${v.worst.toFixed(2)}:1` +
        `   （${v.worstWhere}）`,
    );
  }

  const winners = verdicts.filter((v) => v.worst >= AA_BODY);
  console.log('');
  if (winners.length) {
    console.log(`通过 AA 的候选：${winners.map((w) => w.cand).join(', ')}`);
  } else {
    console.log('没有任何候选在全部条件下通过 AA。');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
