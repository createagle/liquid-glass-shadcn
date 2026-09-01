/**
 * 背景探针行为测试 —— `legibility: 'adaptive'` 的回归闸门。
 *
 * 探针必须同时满足两条，缺一不可：
 *
 *   1. **该省的时候省** —— 背景本来就安全（暗色主题压在暗内容上），
 *      保持原始档位的通透度，不要无谓地加不透明度。
 *   2. **该保的时候保** —— 背景不安全，或者根本测不出来（渐变/图片/视频），
 *      一律抬到 `guaranteed` 的最不利地板。
 *
 * 第 2 条里「测不出就回落」这一点尤其要盯住：探针如果在测不出时
 * 返回一个乐观的结果，AA 保证就被静默破坏了，而且不会有任何报错。
 * 所以这里专门有一条渐变背景的用例。
 *
 * 跑法：node scripts/backdrop-probe-test.mjs
 */

import { chromium } from 'playwright';
import { stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/** 期望：clear = 维持原始档位；floor = 抬到地板；null = 测不出并回落 */
const CASES = [
  ['纯黑背景 + 暗色主题', '#000', 'dark', 'clear'],
  ['纯白背景 + 暗色主题', '#fff', 'dark', 'floor'],
  ['纯白背景 + 亮色主题', '#fff', 'light', 'clear'],
  ['纯黑背景 + 亮色主题', '#000', 'light', 'floor'],
  ['深灰 #1c1c1e + 暗色主题', '#1c1c1e', 'dark', 'clear'],
  /**
   * 中灰在暗色主题下**是有利背景**，不需要抬 alpha —— 这条反直觉，故留作用例。
   * 0.22 的暗底座把 128 压到 104，白字 5.55:1、次级 4.63:1，都过 4.6 的目标。
   * 「最不利」是纯白（把底座顶到 210），不是中灰。
   */
  ['中灰 #808080 + 暗色主题', '#808080', 'dark', 'clear'],
  ['半透明层叠 + 暗色主题', 'rgba(255,255,255,.5)', 'dark', 'floor'],
  ['渐变（测不出）+ 暗色主题', 'linear-gradient(#000,#fff)', 'dark', 'null'],
];

/**
 * 把两个 TS 模块搓成一段能丢进浏览器的脚本。
 *
 * 刻意**不用打包器**：这两个文件都是自包含的（一个 import 都没有），
 * 拼起来只需要剥掉类型和 `export` 关键字，Node 内建的
 * `stripTypeScriptTypes` 就够了。
 *
 * 早先这里调 esbuild，路径写成 `node_modules/.pnpm/esbuild@0.25.0/...`
 * —— **版本号写进了路径**，esbuild 一升级或换个 pnpm store 布局就崩，
 * 而这仓库的 CI 从没跑过，崩了也不会有人知道。去掉打包器同时去掉了
 * 那个隐患和一个构建步骤。
 *
 * 前提是两个源文件保持无 import。真需要跨文件依赖时，
 * 与其在这里手写拼接顺序，不如老实引一个打包器 —— 所以下面显式断言。
 */
function buildProbeScript() {
  const parts = ['legibility.ts', 'backdrop-probe.ts'].map((name) => {
    const src = readFileSync(resolve(ROOT, 'packages/glass-core/src/a11y', name), 'utf8');
    if (/^\s*import\s/m.test(src)) {
      throw new Error(`${name} 出现了 import —— 朴素拼接不再成立，需要改用打包器`);
    }
    // 剥类型，再去掉 export 关键字，让它们变成同一段作用域里的普通声明
    return stripTypeScriptTypes(src, { mode: 'strip' }).replace(/^export\s+/gm, '');
  });

  return [
    '(() => {',
    ...parts,
    'window.LGProbe = { probeBackdrop, resolveLegibleAlpha };',
    '})();',
  ].join('\n');
}

async function main() {
  const probeJs = buildProbeScript();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 600, height: 400 } });
  let fails = 0;

  console.log('背景探针行为测试\n');

  for (const [name, bg, theme, expect] of CASES) {
    await page.setContent(
      `<!doctype html><html><body style="margin:0">
         <div style="position:fixed;inset:0;background:${bg}"></div>
         <div id="glass" style="position:relative;margin:80px;height:120px"></div>
       </body></html>`,
    );
    await page.addScriptTag({ content: probeJs });

    const r = await page.evaluate((theme) => {
      const el = document.getElementById('glass');
      const samples = window.LGProbe.probeBackdrop(el);
      const raw = theme === 'dark' ? 0.22 : 0.34;
      if (!samples) {
        return { probed: false, raw, guaranteed: window.LGProbe.resolveLegibleAlpha(raw, theme, 'guaranteed', null) };
      }
      return {
        probed: true,
        raw,
        adaptive: window.LGProbe.resolveLegibleAlpha(raw, theme, 'adaptive', samples),
        guaranteed: window.LGProbe.resolveLegibleAlpha(raw, theme, 'guaranteed', null),
      };
    }, theme);

    let ok;
    let got;
    if (!r.probed) {
      got = `测不出 → 回落保证模式 ${r.guaranteed.toFixed(3)}`;
      ok = expect === 'null';
    } else {
      const clear = Math.abs(r.adaptive - r.raw) < 1e-6;
      got = `alpha ${r.adaptive.toFixed(3)}（原始 ${r.raw}，地板 ${r.guaranteed.toFixed(3)}）`;
      ok = expect === 'clear' ? clear : expect === 'floor' ? r.adaptive > r.raw + 0.05 : false;
    }
    if (!ok) fails++;
    console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(26)} → ${got}`);
  }

  await browser.close();

  console.log('');
  if (fails) {
    console.log(`✗ ${fails} 项不符合预期`);
    process.exit(1);
  }
  console.log('✓ 全部符合预期');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
