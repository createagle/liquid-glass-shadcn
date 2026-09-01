/**
 * registry 组件源码的静态检查。
 *
 * 这里只放**「本机看不出来、装到别人工程里才炸」**的规则 —— 那类问题本来只有
 * registry 冒烟测试能抓到，而冒烟测试要起 Next 工程，一轮好几分钟。
 * 能静态判定的就别等 CI 跑完再说。
 *
 * 跑法：node scripts/registry-lint.mjs
 */

import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const FILES = globSync('apps/www/registry/glass/**/*.{ts,tsx}', { cwd: ROOT });

/**
 * 去掉注释再匹配 —— 规则说明里往往就写着被禁的那个词。
 * 不做完整的 JS 词法分析：这里只需要判断「有没有」，
 * 唯一的漏网情形是它出现在字符串字面量里，那对本文件的规则不成立。
 */
function stripComments(src) {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '') // JSX 注释 {/* … */}
    .replace(/\/\*[\s\S]*?\*\//g, '') // 块注释
    .replace(/^[ \t]*\/\/.*$/gm, '') // 整行行注释
    .replace(/([^:])\/\/.*$/gm, '$1'); // 行尾注释（避开 https://）
}

const RULES = [
  {
    name: 'no-as-child',
    /**
     * `shadcn add` 在目标工程的 style 以 `base-` 开头时（`shadcn init -d`
     * 现在的默认值），会把 `<X asChild><Y/></X>` 改写成 `<X render={<Y/>} />`。
     * 那是 Base UI 的 API，而本库组件用的是 `@radix-ui/react-*`，
     * 装进去直接 TS2322: Property 'render' does not exist。
     *
     * 本机 typecheck 查的是**改写前**的源码，永远发现不了。
     * 2026-09-01 由 Switch 在冒烟测试里撞出来一次，见 STATUS.md §0.3。
     */
    test: (src) => /\basChild\b/.test(src),
    message:
      "组件里不能用 `asChild` —— shadcn 会在 base-* style 的工程里把它改写成 Base UI 的 " +
      '`render` prop，与 @radix-ui/react-* 不兼容。改成把 wrapper 放在外层。',
  },
];

let failed = 0;
for (const file of FILES) {
  const src = stripComments(readFileSync(resolve(ROOT, file), 'utf8'));
  for (const rule of RULES) {
    if (rule.test(src)) {
      console.error(`✗ ${relative('.', file)}  [${rule.name}]\n  ${rule.message}\n`);
      failed++;
    }
  }
}

if (failed) {
  console.error(`registry 组件检查未通过：${failed} 处`);
  process.exit(1);
}
console.log(`✓ registry 组件检查通过（${FILES.length} 个文件 · ${RULES.length} 条规则）`);
