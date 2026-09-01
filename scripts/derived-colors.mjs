/**
 * 校验「解出来的颜色 token」与推导结果没有漂移。
 *
 * 覆盖两族：
 *   --lg-on-glass-*      压在玻璃上当**文字**的系统色（deriveOnGlassLabel）
 *   --lg-accent-fill /
 *   --lg-destructive-fill  实心填充按钮的背景（deriveProminentFill）
 *
 * 这些 token 是**解出来的**，不是手调的 —— 但它们必须以字面值躺在 CSS 里，
 * 否则不装 JS 的用户就拿不到。字面值一旦与推导逻辑脱节又不会有任何报错，
 * 所以用这个脚本在 CI 里钉住。
 *
 *   node scripts/derived-colors.mjs          校验（漂移则退出码 1）
 *   node scripts/derived-colors.mjs --print  打印当前应有的值
 *   node scripts/derived-colors.mjs --write  直接把推导结果写回 semantic.css
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  deriveOnGlassLabel,
  deriveProminentFill,
  worstBaseUnderFloor,
  contrastRatio,
  AA_TARGET_FILL,
} from '../packages/glass-core/src/a11y/legibility.ts';

const ROOT = resolve(import.meta.dirname, '..');
const CSS = resolve(ROOT, 'packages/glass-core/src/tokens/semantic.css');
const PRIMITIVE = resolve(ROOT, 'packages/glass-core/src/tokens/primitive.css');

const NAMES = ['blue', 'green', 'red', 'orange', 'yellow', 'pink', 'purple', 'indigo', 'teal'];

/**
 * 实心填充按钮：token 名 → 源系统色。
 *
 * 只解实际用到的两个，不整族生成 —— 标签极性要有参考图支撑才能定，
 * 而我们只有蓝色那一张（黄色配白字会被压成褐色，那不是任何 iOS 界面的样子）。
 * 以后有新的填充色需求，先找到对应的 Apple 参考图再加进来。
 */
const FILLS = { 'accent-fill': 'blue', 'destructive-fill': 'red' };
const WHITE = [255, 255, 255];

const hexToRgb = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const rgbToHex = (c) =>
  '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** 从 primitive.css 读真实系统色，避免在本脚本里再抄一遍 */
function readSystemColors() {
  const css = readFileSync(PRIMITIVE, 'utf8');
  const out = { light: {}, dark: {} };
  for (const scheme of ['light', 'dark']) {
    for (const name of NAMES) {
      const m = css.match(new RegExp(`--lg-ios-${name}-${scheme}:\\s*(#[0-9a-fA-F]{6})`));
      if (!m) throw new Error(`primitive.css 里找不到 --lg-ios-${name}-${scheme}`);
      out[scheme][name] = m[1].toLowerCase();
    }
  }
  return out;
}

/** 读一个「亮块在前、暗块在后」各声明一次的 token */
function readPair(css, token) {
  const all = [...css.matchAll(new RegExp(`--lg-${token}:\\s*(#[0-9a-fA-F]{6})`, 'g'))];
  if (all.length !== 2) {
    throw new Error(`--lg-${token} 应当在亮/暗两块各声明一次，实际 ${all.length} 次`);
  }
  return { light: all[0][1].toLowerCase(), dark: all[1][1].toLowerCase() };
}

/** 从 semantic.css 读已写入的 on-glass 值（light 块在前，dark 块在后） */
function readOnGlass() {
  const css = readFileSync(CSS, 'utf8');
  const out = { light: {}, dark: {} };
  for (const name of NAMES) {
    const p = readPair(css, `on-glass-${name}`);
    out.light[name] = p.light;
    out.dark[name] = p.dark;
  }
  return out;
}

/** 实心填充族 */
function readFills() {
  const css = readFileSync(CSS, 'utf8');
  const out = { light: {}, dark: {} };
  for (const token of Object.keys(FILLS)) {
    const p = readPair(css, token);
    out.light[token] = p.light;
    out.dark[token] = p.dark;
  }
  return out;
}

const system = readSystemColors();
const printOnly = process.argv.includes('--print');
const write = process.argv.includes('--write');

/**
 * 把推导结果写回 semantic.css。
 * 亮/暗两块各有一份同名 token，按出现顺序替换（亮在前、暗在后）。
 */
if (write) {
  let css = readFileSync(CSS, 'utf8');
  let n = 0;
  for (const name of NAMES) {
    const wanted = ['light', 'dark'].map((scheme) =>
      rgbToHex(deriveOnGlassLabel(hexToRgb(system[scheme][name]), scheme)),
    );
    let seen = 0;
    css = css.replace(
      new RegExp(`(--lg-on-glass-${name}:\\s*)#[0-9a-fA-F]{6}`, 'g'),
      (_m, head) => {
        const v = wanted[seen++] ?? wanted[wanted.length - 1];
        n++;
        return head + v;
      },
    );
    if (seen !== 2) throw new Error(`--lg-on-glass-${name} 应当出现 2 次，实际 ${seen} 次`);
  }
  for (const [token, src] of Object.entries(FILLS)) {
    const wanted = ['light', 'dark'].map((scheme) =>
      rgbToHex(deriveProminentFill(hexToRgb(system[scheme][src]), WHITE)),
    );
    let seen = 0;
    css = css.replace(new RegExp(`(--lg-${token}:\\s*)#[0-9a-fA-F]{6}`, 'g'), (_m, head) => {
      const v = wanted[seen++] ?? wanted[wanted.length - 1];
      n++;
      return head + v;
    });
    if (seen !== 2) throw new Error(`--lg-${token} 应当出现 2 次，实际 ${seen} 次`);
  }
  writeFileSync(CSS, css, 'utf8');
  console.log(`已写回 ${n} 个 token 到 semantic.css`);
  process.exit(0);
}

let drift = 0;
for (const scheme of ['light', 'dark']) {
  const base = worstBaseUnderFloor(scheme);
  console.log(`── ${scheme} ── 最不利底座 rgb(${base.map(Math.round).join(' ')})`);
  const actual = printOnly ? null : readOnGlass();
  for (const name of NAMES) {
    const orig = hexToRgb(system[scheme][name]);
    const want = rgbToHex(deriveOnGlassLabel(orig, scheme));
    const before = contrastRatio(orig, base);
    const after = contrastRatio(hexToRgb(want), base);
    if (printOnly) {
      console.log(
        `  --lg-on-glass-${name}: ${want};`.padEnd(36) +
          ` /* ${system[scheme][name]} ${before.toFixed(2)} → ${after.toFixed(2)}:1 */`,
      );
    } else {
      const got = actual[scheme][name];
      const ok = got === want;
      if (!ok) drift++;
      console.log(
        `  ${ok ? '✓' : '✗'} ${name.padEnd(8)} CSS=${got} 推导=${want}` +
          `  （原色 ${before.toFixed(2)} → ${after.toFixed(2)}:1）`,
      );
    }
  }
  console.log('');
}

/* ── 实心填充按钮 ──────────────────────────────────────────────────── */
console.log(`── 实心填充（白字，目标 ${AA_TARGET_FILL}:1）──`);
{
  const actual = printOnly ? null : readFills();
  for (const scheme of ['light', 'dark']) {
    for (const [token, src] of Object.entries(FILLS)) {
      const orig = hexToRgb(system[scheme][src]);
      const want = rgbToHex(deriveProminentFill(orig, WHITE));
      const before = contrastRatio(WHITE, orig);
      const after = contrastRatio(WHITE, hexToRgb(want));
      if (printOnly) {
        console.log(
          `  --lg-${token}: ${want};`.padEnd(34) +
            ` /* ${scheme} ${system[scheme][src]} ${before.toFixed(2)} → ${after.toFixed(2)}:1 */`,
        );
      } else {
        const got = actual[scheme][token];
        const ok = got === want;
        if (!ok) drift++;
        console.log(
          `  ${ok ? '✓' : '✗'} ${scheme.padEnd(5)} ${token.padEnd(17)} CSS=${got} 推导=${want}` +
            `  （白字 ${before.toFixed(2)} → ${after.toFixed(2)}:1）`,
        );
      }
    }
  }
}
console.log('');

if (printOnly) process.exit(0);
if (drift) {
  console.log(`✗ ${drift} 个 token 与推导结果不一致。`);
  console.log('  跑 node scripts/derived-colors.mjs --write 写回 semantic.css，然后提交。');
  process.exit(1);
}
console.log('✓ 全部与推导一致');
