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
 *
 * ⚠️⚠️ **这里曾经有一条会吞掉真实代码的规则，而且吞了很久没人发现。**
 *
 * 原来的第一条是 `/\{\s*\/\*[\s\S]*?\*\/\s*\}/g`，本意是删 JSX 注释 `{/* … *\/}`。
 * 但中间虽然非贪婪，尾部的 `\s*\}` 会逼它继续往后找 ——
 * 一个普通块注释（`*\/` 后面不是 `}`）会让它一路吞到**下一个** `*\/}`，
 * 把中间的代码整段删掉。calendar.tsx 里 `function Calendar(` 就是这么消失的。
 *
 * 后果不是报错，是**规则悄悄少查了一大片文件**：`no-as-child` 也一样受影响。
 * 一条永远查不到东西的规则比没有规则更糟 —— 它会让人以为这类问题已经守住了。
 *
 * 现在只删块注释与行注释。JSX 注释的内容会被块注释那条删掉，
 * 剩下一对空的 `{}` —— 对两条规则都无害，而且**保持花括号配对**，
 * 下面 `dataSlotClobbered` 的深度计数还指望着这一点。
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // 块注释（含 JSX 注释的内容）
    .replace(/^[ \t]*\/\/.*$/gm, '') // 整行行注释
    .replace(/([^:])\/\/.*$/gm, '$1'); // 行尾注释（避开 https://）
}

/* ══════════════════════════════════════════════════════════════════════
   `data-slot` 归属分析
   ══════════════════════════════════════════════════════════════════════ */

/**
 * 从 `{` 开始做括号配对，返回到匹配的 `}` 为止的那一段。
 *
 * 只在函数体上用，不追求完备 —— 字符串与模板串里的括号会被算进去，
 * 但本库的组件里没有出现过不成对的括号字面量。
 */
function blockFrom(src, braceIndex) {
  let depth = 0;
  for (let i = braceIndex; i < src.length; i += 1) {
    const c = src[i];
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(braceIndex, i + 1);
    }
  }
  return src.slice(braceIndex);
}

/**
 * 这个文件里，哪些组件**自己拥有 `data-slot`**。
 *
 * 判据：函数体里出现 `{...props}`（或 `{...rest}`）之后**又**出现 `data-slot=`。
 * 那正是本库的约定写法 —— 展开在前、`data-slot` 在后，于是调用方传的
 * `data-slot` 会被组件自己的那一个盖掉。
 */
function ownsDataSlot(src) {
  const owners = new Set();
  const fn = /function\s+([A-Z][A-Za-z0-9_]*)\s*(<[^>]*>)?\s*\(/g;
  let m;
  while ((m = fn.exec(src)) !== null) {
    /*
     * ⚠️ 必须先跳过**参数列表**再找函数体的 `{`。
     *
     * 本库的组件几乎都写成 `function X({ className, ...props }: Props)` ——
     * 直接 `indexOf('{')` 找到的是**解构参数**那个花括号，
     * 于是「函数体」只有参数列表那么长，规则一条都命中不了。
     * 第一版就是这样：跑得过、不报错、**什么都没查**。
     */
    let depth = 1;
    let i = fn.lastIndex;
    for (; i < src.length && depth > 0; i += 1) {
      if (src[i] === '(') depth += 1;
      else if (src[i] === ')') depth -= 1;
    }
    const brace = src.indexOf('{', i);
    if (brace === -1) continue;
    const body = blockFrom(src, brace);
    if (/\{\s*\.\.\.(props|rest)\s*\}[\s\S]*?data-slot\s*=/.test(body)) owners.add(m[1]);
  }
  return owners;
}

/**
 * 找出「给一个**自己拥有 data-slot** 的本库组件传 data-slot」的地方。
 *
 * ⚠️ 范围是两次收窄出来的，两次都是被误报逼的：
 *
 *  1. 第一版查「所有大写开头的 JSX 标签」，把
 *     `<AccordionPrimitive.Content data-slot="…">` 这类**正当写法**全报了 ——
 *     Radix 原语会把不认识的属性原样透传到 DOM，给它们写 data-slot 正是常规做法。
 *  2. 第二版收窄到「从 `@/components/ui/*` 引进来的名字」，还是误报 ——
 *     `<PopoverAnchor>` / `<ResponsiveOverlayTrigger>` 这些**自己不写 data-slot**，
 *     透传下去完全正常。
 *
 * 所以最终判据是**目标组件自己写不写 data-slot**，按 registry 全量源码建索引。
 */
function dataSlotClobbered(src, ownersByName) {
  const hits = [];
  // `<` 前面必须不是标识符字符，否则会把 `Omit<T>` / `useState<Date>` 这类泛型当成 JSX
  const openTag = /(^|[^A-Za-z0-9_$.])<([A-Z][A-Za-z0-9_.]*)/g;
  let m;
  while ((m = openTag.exec(src)) !== null) {
    const name = m[2];
    if (name.includes('.') || !ownersByName.has(name)) continue;
    let i = openTag.lastIndex;
    let depth = 0;
    let quote = null;
    let attrs = '';
    for (; i < src.length; i += 1) {
      const c = src[i];
      if (quote) {
        // 92 = 反斜杠。用 charCodeAt 而不是字面量 —— 这个文件被脚本改写过几轮，
        // 反斜杠字面量在中间某一环被吃掉过一次（详见下面 includes 那行的注释）。
        if (c === quote && src.charCodeAt(i - 1) !== 92) quote = null;
      } else if (c === '"' || c === "'" || c === '`') {
        quote = c;
      } else if (c === '{' || c === '(' || c === '[') {
        depth += 1;
      } else if (c === '}' || c === ')' || c === ']') {
        depth -= 1;
      } else if (c === '>' && depth === 0) {
        break;
      }
      attrs += c;
    }
    /*
     * 用 `includes` 而不是正则。
     *
     * ⚠️ 这一行原本是 `/\bdata-slot\s*=/`，被改写脚本经手时转义少了一层，
     * 变成了「一个真的退格符 + data-slot」—— 语法合法、跑得过、**永远不报错**。
     * 一条永远不报错的 lint 规则比没有规则更糟：它会让人以为这类问题已经被守住了。
     * 子串判断没有转义可吃。
     */
    if (attrs.includes('data-slot')) hits.push(name);
  }
  return hits;
}

/** 全量扫一遍，建立「组件名 → 自己拥有 data-slot」的索引。 */
const OWNERS = new Set();
const SOURCES = new Map();
for (const file of FILES) {
  const src = stripComments(readFileSync(resolve(ROOT, file), 'utf8'));
  SOURCES.set(file, src);
  for (const name of ownsDataSlot(src)) OWNERS.add(name);
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
  {
    name: 'no-data-slot-on-component',
    /**
     * **这条规则是欠了两个月才补上的。**
     *
     * 本库组件一律在展开 props **之后**写自己的 `data-slot`。好处是调用方传的
     * 多余属性不会被吞掉；代价是**从外面给它传 `data-slot` 会被静默吃掉** ——
     * 元素照渲染，属性就是不见了，控制台一个字都没有。
     *
     * 这一族的坑到 2026-09-05 已经踩了**七次**：SheetClose、ResponsiveOverlay、
     * DropdownMenu、命令面板、GlassSurface（那次是属性被整个吞掉）、
     * 以及 DataTable 里的 Checkbox 与 TableCell。每一次都是测试红了才发现，
     * 而 STATUS §0.63 里那句「该有一条 lint 规则。记着，没做」一直挂着。
     *
     * 解法与前七次一样：**另起一个属性**（`data-select-all`、`data-dialog-close` …）。
     */
    test: (src) => dataSlotClobbered(src, OWNERS).length > 0,
    message: (src) =>
      '不能给这些组件传 `data-slot`（' +
      [...new Set(dataSlotClobbered(src, OWNERS))].map((n) => '<' + n + '>').join('、') +
      '）—— 它们在展开 props **之后**设自己的 data-slot，外面传的会被**静默吃掉**。' +
      '另起一个属性，例如 `data-select-all=""`。',
  },
];

let failed = 0;
for (const [file, src] of SOURCES) {
  for (const rule of RULES) {
    if (rule.test(src)) {
      const msg = typeof rule.message === 'function' ? rule.message(src) : rule.message;
      console.error(`✗ ${relative('.', file)}  [${rule.name}]\n  ${msg}\n`);
      failed++;
    }
  }
}

if (failed) {
  console.error(`registry 组件检查未通过：${failed} 处`);
  process.exit(1);
}
console.log(`✓ registry 组件检查通过（${FILES.length} 个文件 · ${RULES.length} 条规则）`);
