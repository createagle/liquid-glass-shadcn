/**
 * 发布前检查：README 里写的包名，得是这个包真正的名字。
 *
 * ── 为什么需要它 ──────────────────────────────────────────────────────
 *
 * 2026-09-05 真炸过一次，而且是**发出去之后**才发现的：
 *
 *   1. 先写好 `packages/glass-core/README.md`（那时包名还是 `@glass/core`）；
 *   2. 随后把包名改成 `@createagle/glass-core`，改名脚本遍历的是
 *      `git ls-files` —— 而那个 README **当时还没被 git 跟踪**，于是整份跳过；
 *   3. 它带着旧名字被提交、被打包、被发布。
 *
 * 结果：npmjs.com 上那一页写着 `pnpm add @glass/core` —— 一个不存在的包。
 * 仓库里所有检查都是绿的（README 不参与类型检查，也不进 registry），
 * 而 npm 的包页面只能靠**发新版本**才能更正。
 *
 * 所以这条检查挂在 `prepublishOnly` 上：只在真正要发布时跑，
 * 而那正是「README 写错包名」唯一会造成实际伤害的时刻。
 *
 * 判据两条：
 *   1. 第一个标题必须就是包名；
 *   2. README 里出现的 `@scope/name` 记号，要么是本包，
 *      要么是 package.json 里真实声明过的依赖 —— 剩下的一律当成写错的自指。
 *
 * 用法：node scripts/check-package-readme.mjs <包目录>
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(process.argv[2] ?? '.');
const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'));
const readmePath = resolve(dir, 'README.md');

if (!existsSync(readmePath)) {
  console.error(`✗ ${pkg.name} 没有 README.md —— npm 包页面会是空的。`);
  process.exit(1);
}

const readme = readFileSync(readmePath, 'utf8');
let bad = 0;

/* 1. 第一个标题 */
const heading = readme.split('\n').find((l) => l.startsWith('# '));
if (!heading) {
  console.error('✗ README 里没有一级标题。');
  bad += 1;
} else if (heading.slice(2).trim() !== pkg.name) {
  console.error(`✗ README 的一级标题是 "${heading.slice(2).trim()}"，包名却是 "${pkg.name}"。`);
  bad += 1;
}

/* 2. 所有 @scope/name 记号 */
const declared = new Set([
  pkg.name,
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
]);
const seen = new Set();
for (const m of readme.matchAll(/@[a-z0-9-~][a-z0-9-._~]*\/[a-z0-9-._~]+/gi)) {
  const spec = m[0];
  if (declared.has(spec) || seen.has(spec)) continue;
  // 子路径导出（@x/y/theme.css）按其包名判断
  const base = spec.split('/').slice(0, 2).join('/');
  if (declared.has(base)) continue;
  seen.add(spec);
  console.error(`✗ README 里出现 "${spec}" —— 既不是本包 (${pkg.name})，也不是声明过的依赖。`);
  bad += 1;
}

if (bad) {
  console.error(`\n✗ ${pkg.name} 的 README 有 ${bad} 处对不上，发布会把它印在 npm 页面上。\n`);
  process.exit(1);
}
console.log(`✓ README 与包名一致（${pkg.name}）`);
