/**
 * 静态导出产物的「绝对路径链接」检查。
 *
 * ── 为什么需要它 ──────────────────────────────────────────────────────
 *
 * 站点部署在 GitHub Pages 的**项目页**上，也就是挂在 /<repo>/ 下面，
 * 于是 next.config.ts 打开了 `basePath`。
 *
 * ⚠️ basePath **只管两样东西**：`<Link>` 和 Next 自己发出的资源。
 *    裸 `<a href="/…">`、`window.open('/…')`、`fetch('/…')`、
 *    手写的 `<img src="/…">` —— 一个都不带前缀。
 *
 * 而这类问题在本机**测不出来**：本地 basePath 是空的，那些路径全都是对的。
 * 只有部署到 Pages 之后才 404，还得有人真的点到那个链接才会发现。
 *
 * 所以在导出之后扫一遍产物：凡是以 `/` 开头、又没带 basePath 前缀的
 * href / src，一律报错。这是**能在构建期判定**的事，不该留到线上。
 *
 * 用法：node scripts/check-export-links.mjs <outDir> <basePath>
 *   node scripts/check-export-links.mjs apps/www/out /liquid-glass-shadcn
 */

import { readFileSync, globSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const [outDirArg, basePath] = process.argv.slice(2);
if (!outDirArg || !basePath) {
  console.error('用法：node scripts/check-export-links.mjs <outDir> <basePath>');
  process.exit(2);
}
if (!basePath.startsWith('/') || basePath.endsWith('/')) {
  console.error(`basePath 应形如 "/repo"，实际拿到 "${basePath}"`);
  process.exit(2);
}

const ROOT = resolve(import.meta.dirname, '..');
const outDir = resolve(ROOT, outDirArg);
const files = globSync('**/*.html', { cwd: outDir });

if (files.length === 0) {
  console.error(`✗ ${outDirArg} 下一个 .html 都没有 —— 导出没跑成功？`);
  process.exit(1);
}

/** `href="…"` / `src="…"`，单双引号都收 */
const ATTR = /\b(href|src)=("([^"]*)"|'([^']*)')/g;

let bad = 0;
let scanned = 0;

for (const file of files) {
  const html = readFileSync(resolve(outDir, file), 'utf8');
  for (const m of html.matchAll(ATTR)) {
    const value = m[3] ?? m[4] ?? '';
    scanned += 1;
    // 只看站内绝对路径：`//cdn…` 是协议相对的外链，不归这里管
    if (!value.startsWith('/') || value.startsWith('//')) continue;
    if (value === basePath || value.startsWith(`${basePath}/`)) continue;
    console.error(`✗ ${file}\n    ${m[1]}="${value}"  —— 少了 ${basePath} 前缀`);
    bad += 1;
  }
}

if (bad) {
  console.error(
    `\n✗ ${files.length} 个页面里有 ${bad} 处站内绝对路径没带 basePath。\n` +
      '  这些链接在本地全对、在 Pages 上全 404。\n' +
      `  改法：内部跳转用 <Link>；window.open / fetch 这类自己拼 ` +
      '`process.env.NEXT_PUBLIC_BASE_PATH`。\n',
  );
  process.exit(1);
}

console.log(
  `✓ 导出产物链接检查通过（${files.length} 个页面 · ${scanned} 处 href/src · ` +
    `basePath ${basePath}）`,
);
