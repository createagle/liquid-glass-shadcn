/**
 * 校验 `--lg-on-glass-*` 与推导结果没有漂移。
 *
 * 这些 token 是**解出来的**，不是手调的 —— 但它们必须以字面值躺在 CSS 里，
 * 否则不装 JS 的用户就拿不到。字面值一旦与推导逻辑脱节又不会有任何报错，
 * 所以用这个脚本在 CI 里钉住。
 *
 *   node scripts/on-glass-colors.mjs          校验（漂移则退出码 1）
 *   node scripts/on-glass-colors.mjs --print  打印当前应有的值
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  deriveOnGlassLabel,
  worstBaseUnderFloor,
  contrastRatio,
} from '../packages/glass-core/src/a11y/legibility.ts';

const ROOT = resolve(import.meta.dirname, '..');
const CSS = resolve(ROOT, 'packages/glass-core/src/tokens/semantic.css');
const PRIMITIVE = resolve(ROOT, 'packages/glass-core/src/tokens/primitive.css');

const NAMES = ['blue', 'green', 'red', 'orange', 'yellow', 'pink', 'purple', 'indigo', 'teal'];

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

/** 从 semantic.css 读已写入的 on-glass 值（light 块在前，dark 块在后） */
function readOnGlass() {
  const css = readFileSync(CSS, 'utf8');
  const out = { light: {}, dark: {} };
  for (const name of NAMES) {
    const all = [...css.matchAll(new RegExp(`--lg-on-glass-${name}:\\s*(#[0-9a-fA-F]{6})`, 'g'))];
    if (all.length !== 2) {
      throw new Error(`--lg-on-glass-${name} 应当在亮/暗两块各声明一次，实际 ${all.length} 次`);
    }
    out.light[name] = all[0][1].toLowerCase();
    out.dark[name] = all[1][1].toLowerCase();
  }
  return out;
}

const system = readSystemColors();
const printOnly = process.argv.includes('--print');

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

if (printOnly) process.exit(0);
if (drift) {
  console.log(`✗ ${drift} 个 token 与推导结果不一致。`);
  console.log('  跑 node scripts/on-glass-colors.mjs --print 拿到应有的值，更新 semantic.css。');
  process.exit(1);
}
console.log('✓ 全部与推导一致');
