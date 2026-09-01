/**
 * WCAG AA 对比度自动检查。对应 PROJECT_SPEC §13：
 *
 *   「所有文本在**材质档位 0（最通透）+ 最不利背景**下仍需满足 WCAG AA
 *     （正文 4.5:1，大字 3:1）。这是最容易翻车的地方 —— 写一个自动化检查脚本，
 *     在 CI 里对每个组件的截图做采样检测，不通过就 fail。」
 *
 * ── 为什么必须走截图采样，不能只按 CSS 值算 ──────────────────────────
 * 玻璃的实际背景是 `backdrop-filter: blur() saturate()` 合成出来的，
 * 半透明底座叠在任意内容上。光看 CSS 变量算不出人眼实际看到的那个颜色。
 * 所以这里真的去截图、真的读像素。
 *
 * ── 怎么拿到「文字背后的颜色」 ────────────────────────────────────────
 * 渲染两次：
 *   1. 正常渲染 → 用 getComputedStyle 拿到文字颜色（含 alpha）与包围盒
 *   2. 把待测文字 visibility:hidden（保留布局）后截图
 *      → 包围盒范围内的像素就是「文字背后的真实合成结果」
 * 再把文字色（若带 alpha）合成到每个背景像素上，逐像素算对比度，
 * **取最差的那个像素**作为该测点的成绩 —— 这就是「最不利背景」的落地。
 *
 * ── 关于基线（棘轮） ─────────────────────────────────────────────────
 * 2026-08-31 起 **14 个测点全部达标**。做法见 docs/research/STATUS.md §0：
 * 材质 alpha 加可读性地板（a11y/legibility.ts），着色标签改用派生的
 * --lg-on-glass-*。此前一度有 11 个测点不达标。
 *
 * 棘轮基线仍然保留，它的作用变成「守住已达标的成绩」：
 *   - 已达 AA 的测点 → 按 AA 卡死，之后再也不许掉下去
 *   - 未达 AA 的测点 → 按当前实测值卡死，只许变好，变差就 fail
 * 基线不是豁免，是「不许更糟」。已知缺口在 STATUS.md 里单独追踪。
 *
 * 用法：
 *   node scripts/contrast-audit.mjs                    # 全量，回归则退出码 1
 *   node scripts/contrast-audit.mjs --verbose          # 打印每个测点
 *   node scripts/contrast-audit.mjs --update-baseline  # 重写基线（需人工确认差异）
 *   node scripts/contrast-audit.mjs --strict           # 忽略基线，直接按 AA 判定
 */

import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { decodePng } from './lib/png.mjs';
import { measureMaskedContrast, parseColor, isLargeText } from './lib/contrast.mjs';

/**
 * 可读性地板 —— 直接 import TS 源，**不在本脚本里复算**。
 * Node 24 原生支持 .ts 的类型剥离，故可以直接导入 glass-core 的源文件，
 * 保证 CI 检查的地板值与运行时实际用的是同一份。
 */
import {
  resolveLegibleAlpha,
  SECONDARY_ALPHA_AT_FLOOR,
} from '../packages/glass-core/src/a11y/legibility.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, '../packages/glass-core/debug/contrast-fixture.html');

const VERBOSE = process.argv.includes('--verbose');
const UPDATE_BASELINE = process.argv.includes('--update-baseline');
const STRICT = process.argv.includes('--strict');
const BASELINE_FILE = resolve(__dirname, 'contrast-baseline.json');

/** 浮点噪声容差：抗锯齿与合成会带来极小的抖动 */
const EPSILON = 0.05;

/** WCAG AA 阈值 */
const AA_BODY = 4.5;
const AA_LARGE = 3.0;

const THEMES = ['light', 'dark'];
/** 档位 0 是 SPEC 点名的最不利条件；另外两档一并跑，确认不存在非单调的意外 */
const TINTS = [0, 0.34, 1];
const TIERS = ['a', 'b', 'c'];
/**
 * 档位表里的 alpha 一列 —— 与 `provider/glass-provider.tsx` 的 STOPS 对齐。
 * 只取 alpha 是因为对比度只跟它有关；blur/saturate 由夹具自己插值。
 */
const RAW_STOP_ALPHA = {
  light: (t) => lerpStops([0.34, 0.62, 0.78, 0.96], t),
  dark: (t) => lerpStops([0.22, 0.44, 0.62, 0.94], t),
};
function lerpStops(stops, t) {
  const clamped = Math.min(1, Math.max(0, t));
  const pos = clamped * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(pos));
  const f = pos - i;
  return stops[i] + (stops[i + 1] - stops[i]) * f;
}

/**
 * 最不利背景集合。
 * 亮色主题文字是黑的 → 暗背景最不利；暗色主题文字是白的 → 亮背景最不利。
 * 两个极端都要覆盖，另加高频棋盘（模糊也抹不平）与高饱和渐变。
 */
const BACKGROUNDS = ['black', 'white', 'mid', 'checker', 'saturated', 'photo'];

/** sRGB 相对亮度（WCAG 定义） */
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


async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 900, height: 700 },
    deviceScaleFactor: 1,
  });

  const failures = [];
  const all = [];
  let combos = 0;

  for (const theme of THEMES) {
    for (const tint of TINTS) {
      for (const tier of TIERS) {
        for (const bg of BACKGROUNDS) {
          combos++;
          // 与 GlassProvider 完全同源的地板计算：根节点算不出逐元素背景，
          // 故传 null（= 按最不利背景求地板），与 legibility:'guaranteed' 一致。
          const rawAlpha = RAW_STOP_ALPHA[theme](tint);
          const flooredAlpha = resolveLegibleAlpha(rawAlpha, theme, 'guaranteed', null);

          const url =
            pathToFileURL(FIXTURE).href +
            `?theme=${theme}&tint=${tint}&tier=${tier}&bg=${bg}` +
            `&alpha=${flooredAlpha.toFixed(4)}&secalpha=${SECONDARY_ALPHA_AT_FLOOR}`;
          await page.goto(url, { waitUntil: 'load' });
          await page.waitForFunction(() => window.__ready === true);

          const points = await page.evaluate(() => window.__collect());

          const settle = () =>
            page.evaluate(
              () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
            );

          // 差分测量需要两张图：文字可见 / 文字隐藏。
          // 见 lib/contrast.mjs 头部说明 —— 旧的「读 CSS 色再合成」测法
          // 会采到圆角之外的像素，且对 mix-blend-mode 失效。
          await settle();
          const shownPng = decodePng(await page.screenshot({ type: 'png' }));

          await page.evaluate(() => window.__setTextHidden(true));
          await settle();
          const png = decodePng(await page.screenshot({ type: 'png' }));
          await page.evaluate(() => window.__setTextHidden(false));

          for (const p of points) {
            const result = measureMaskedContrast(shownPng, png, p.box, parseColor(p.color));
            if (!result) continue;

            const large = isLargeText(p.fontSize, p.fontWeight);
            const threshold = large ? AA_LARGE : AA_BODY;
            const record = {
              theme,
              tint,
              tier,
              bg,
              where: p.where,
              large,
              threshold,
              ratio: Number(result.ratio.toFixed(2)),
              textColor: p.color,
              bgPixel: result.pixel?.bg,
            };
            all.push(record);
            if (result.ratio < threshold) failures.push(record);
          }
        }
      }
    }
  }

  await browser.close();

  // ── 归并：每个测点只保留最差的一次 ────────────────────────────────
  const worstPerPoint = new Map();
  for (const r of all) {
    const cur = worstPerPoint.get(r.where);
    if (!cur || r.ratio < cur.ratio) worstPerPoint.set(r.where, r);
  }

  const baseline =
    existsSync(BASELINE_FILE) && !STRICT
      ? JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))
      : null;

  console.log('');
  console.log(
    `对比度审计：${combos} 个组合 × ${worstPerPoint.size} 个测点 = ${all.length} 次采样`,
  );
  console.log(`阈值：正文 ${AA_BODY}:1 · 大字 ${AA_LARGE}:1（WCAG AA）`);
  console.log(
    baseline
      ? `基线：${basename(BASELINE_FILE)}（棘轮模式，只许变好）`
      : '基线：未启用（--strict，直接按 AA 判定）',
  );
  console.log('');

  if (UPDATE_BASELINE) {
    const next = { $comment: '由 scripts/contrast-audit.mjs --update-baseline 生成。达标项按 AA 卡死，未达标项按实测值卡死。', points: {} };
    for (const [where, r] of [...worstPerPoint].sort()) {
      next.points[where] = {
        ratio: r.ratio,
        threshold: r.threshold,
        meetsAA: r.ratio >= r.threshold,
        worstCombo: `${r.theme}/tint${r.tint}/tier${r.tier}/${r.bg}`,
      };
    }
    writeFileSync(BASELINE_FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    console.log(`已写入基线：${worstPerPoint.size} 个测点`);
    return 0;
  }

  // ── 判定 ──────────────────────────────────────────────────────────
  const regressions = [];
  const belowAA = [];
  const newPoints = [];

  for (const [where, r] of worstPerPoint) {
    const meetsAA = r.ratio >= r.threshold;
    if (meetsAA) continue;
    belowAA.push(r);

    if (!baseline) continue;
    const b = baseline.points?.[where];
    if (!b) {
      newPoints.push(r);
    } else if (b.meetsAA) {
      // 曾经达标的点掉下来了 —— 一律算回归
      regressions.push({ ...r, was: b.ratio, reason: '曾达 AA，现在掉了' });
    } else if (r.ratio < b.ratio - EPSILON) {
      regressions.push({ ...r, was: b.ratio, reason: '比基线更差' });
    }
  }

  // 达标点也要防掉：拿 AA 当它们的地板
  if (baseline) {
    for (const [where, r] of worstPerPoint) {
      const b = baseline.points?.[where];
      if (b && !b.meetsAA && r.ratio > b.ratio + 0.5) {
        console.log(`  ↑ ${where} 从 ${b.ratio} 改善到 ${r.ratio}，记得跑 --update-baseline 收紧棘轮`);
      }
    }
  }

  if (VERBOSE) {
    console.log('每个测点的最差成绩：');
    for (const [where, r] of [...worstPerPoint].sort((a, b) => a[1].ratio - b[1].ratio)) {
      const ok = r.ratio >= r.threshold ? '✓' : '✗';
      console.log(
        `  ${ok} ${where.padEnd(26)} ${String(r.ratio).padStart(6)}  ` +
          `(阈值 ${r.threshold}) 最差组合: ${r.theme}/tint${r.tint}/tier${r.tier}/${r.bg}`,
      );
    }
    console.log('');
  }

  const detail = (f) =>
    `  ${f.where}
` +
    `    对比度 ${f.ratio}:1  <  阈值 ${f.threshold}:1` +
    (f.was !== undefined ? `（基线 ${f.was}，${f.reason}）` : '') +
    `
    最差组合 ${f.theme} / 档位 ${f.tint} / Tier ${f.tier} / 背景 ${f.bg}
` +
    `    文字色 ${f.textColor}  背后像素 rgb(${f.bgPixel?.join(', ')})
`;

  if (regressions.length || newPoints.length) {
    if (regressions.length) {
      console.error(`✗ ${regressions.length} 个测点相对基线回归：
`);
      for (const f of regressions.sort((a, b) => a.ratio - b.ratio)) console.error(detail(f));
    }
    if (newPoints.length) {
      console.error(`✗ ${newPoints.length} 个新增测点未达 AA 且不在基线中：
`);
      for (const f of newPoints.sort((a, b) => a.ratio - b.ratio)) console.error(detail(f));
    }
    return 1;
  }

  if (!baseline && belowAA.length) {
    console.error(`✗ ${belowAA.length} 个测点未达 WCAG AA：
`);
    for (const f of belowAA.sort((a, b) => a.ratio - b.ratio)) console.error(detail(f));
    return 1;
  }

  const min = [...worstPerPoint.values()].reduce((m, r) => (r.ratio < m.ratio ? r : m));
  if (belowAA.length) {
    console.log(
      `✓ 无回归。但仍有 ${belowAA.length} 个测点未达 AA（已在基线中登记，非豁免）：`,
    );
    for (const f of belowAA.sort((a, b) => a.ratio - b.ratio)) {
      console.log(`    ${f.where.padEnd(26)} ${f.ratio}:1 < ${f.threshold}:1  (${f.theme}/${f.bg})`);
    }
    console.log('');
    console.log('  这些不是「可以接受」，是「已知且被盯住」——');
    console.log('  基线只保证不再变差，不等于豁免。根因见 docs/research/STATUS.md。');
    return 0;
  }

  console.log(
    `✓ 全部达标。最紧的一处是 ${min.where} = ${min.ratio}:1 ` +
      `(阈值 ${min.threshold})，组合 ${min.theme}/tint${min.tint}/tier${min.tier}/${min.bg}`,
  );
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('审计脚本本身出错：', err);
    process.exit(2);
  });
