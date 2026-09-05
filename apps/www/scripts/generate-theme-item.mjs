/**
 * 从 @createagle/glass-core 的 CSS 源**单向生成** registry 的 theme item。
 *
 * 为什么要生成而不是手写：
 * token 的唯一真相在 packages/glass-core/src/tokens/*.css。
 * 手写一份 JSON 意味着两边必然漂移 —— 改了 CSS 忘了改 JSON，
 * 用户装到自己项目里拿到的就是旧值，而且不会有任何报错。
 *
 * 映射规则（对应 registry-item.json 的字段语义）：
 *   :root { … }                          → cssVars.light
 *   :root[data-glass-theme='dark'], .dark → cssVars.dark
 *   @theme inline { … }                  → cssVars.theme
 *   其余所有规则（高对比块 / .lg-surface 渲染路径 / 媒体查询 / 内容层材质）
 *                                        → css（挂在 @layer base 下）
 *
 * 用法：node scripts/generate-theme-item.mjs
 *       node scripts/generate-theme-item.mjs --check   只比对不写（漂移则退出码 1）
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WWW = resolve(__dirname, '..');
const TOKENS = resolve(WWW, '../../packages/glass-core/src/tokens');

/** 去掉注释，避免把注释里的花括号当成结构 */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** 把 CSS 顶层切成 { selector, body } 列表，忽略 @import */
function topLevelRules(css) {
  const out = [];
  let i = 0;
  let selStart = 0;
  let depth = 0;
  let bodyStart = -1;

  while (i < css.length) {
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) bodyStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        // 归一化空白：否则同一个选择器因为换行位置不同会变成两个键，规则会互相覆盖
        const selector = css.slice(selStart, bodyStart).replace(/\s+/g, ' ').trim();
        const body = css.slice(bodyStart + 1, i);
        if (selector) out.push({ selector, body });
        selStart = i + 1;
      }
    } else if (ch === ';' && depth === 0) {
      // 顶层的 @import 等语句，跳过
      selStart = i + 1;
    }
    i++;
  }
  return out;
}

/** 解析声明块里的自定义属性（只取 --x: y，忽略嵌套规则） */
function parseDecls(body) {
  const decls = {};
  let depth = 0;
  let buf = '';
  for (const ch of body) {
    if (ch === '(' || ch === '{') depth++;
    else if (ch === ')' || ch === '}') depth--;
    if (ch === ';' && depth === 0) {
      pushDecl(decls, buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  pushDecl(decls, buf);
  return decls;
}

function pushDecl(decls, raw) {
  const text = raw.trim();
  if (!text.startsWith('--')) return;
  const idx = text.indexOf(':');
  if (idx < 0) return;
  const name = text.slice(0, idx).trim().replace(/^--/, '');
  const value = text.slice(idx + 1).trim();
  if (name && value) decls[name] = value;
}

/** 把一个规则块转成 css 字段用的嵌套对象 */
function ruleToObject(body) {
  const obj = {};
  // 先取本层声明（含非自定义属性）
  let depth = 0;
  let buf = '';
  const nested = [];
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{') {
      depth++;
      if (depth === 1) {
        // buf 是嵌套规则的选择器
        const start = i;
        let d = 1;
        let j = i + 1;
        while (j < body.length && d > 0) {
          if (body[j] === '{') d++;
          else if (body[j] === '}') d--;
          j++;
        }
        nested.push({ selector: buf.replace(/\s+/g, ' ').trim(), body: body.slice(start + 1, j - 1) });
        buf = '';
        i = j - 1;
        depth = 0;
        continue;
      }
    } else if (ch === ';' && depth === 0) {
      const text = buf.trim();
      if (text) {
        const idx = text.indexOf(':');
        if (idx > 0) obj[text.slice(0, idx).trim()] = text.slice(idx + 1).trim();
      }
      buf = '';
    } else {
      buf += ch;
    }
  }
  const tail = buf.trim();
  if (tail) {
    const idx = tail.indexOf(':');
    if (idx > 0) obj[tail.slice(0, idx).trim()] = tail.slice(idx + 1).trim();
  }
  for (const n of nested) obj[n.selector] = ruleToObject(n.body);
  return obj;
}

const DARK_SELECTOR = /^:root\[data-glass-theme=['"]dark['"]\]\s*,\s*\.dark$/;
const ROOT_SELECTOR = /^:root$/;

const cssVars = { theme: {}, light: {}, dark: {} };

/**
 * css 字段分两层：
 *   @layer base       —— 纯变量块（高对比覆盖等）。放 base 保证它们是「默认值」。
 *   @layer components —— .lg-surface / .lg-content 等组件类与渲染路径。
 *                        放 components 意味着用户的 Tailwind 工具类能盖过它们，
 *                        这正是我们要的：消费方可以用 class 覆盖本库的默认表现。
 */
const layerBase = {};
const layerComponents = {};

/** 规则体是否只包含自定义属性声明（没有普通属性、没有嵌套规则） */
function isVarOnlyRule(body) {
  if (body.includes('{')) return false;
  return body
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .every((d) => d.startsWith('--'));
}

/** 同一个选择器可能出现在多个源文件里（例如高对比块）—— 必须合并而不是覆盖 */
function mergeInto(target, selector, obj) {
  if (!target[selector]) {
    target[selector] = obj;
    return;
  }
  const existing = target[selector];
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && existing[k] && typeof existing[k] === 'object') {
      mergeInto(existing, k, v);
    } else {
      existing[k] = v;
    }
  }
}

const FILES = ['primitive.css', 'semantic.css', 'shadcn.css', 'optics.css', 'theme.css'];

for (const file of FILES) {
  /**
   * 读进来先把 CRLF 归一成 LF。
   *
   * **不能指望 .gitattributes 解决这个。** 多行 CSS 值（渐变、box-shadow）
   * 会被原样塞进 JSON 的**字符串值内部**。git 只归一化文件的行尾，
   * 管不了字符串内容里的回车符 —— 于是 Windows 上生成的 JSON 里是 CRLF、
   * Linux 上是 LF，同一份源产出两种 registry.json。
   * CI 那道「生成物与源同步」的断言第一次真跑就是挂在这里。
   */
  const source = readFileSync(join(TOKENS, file), 'utf8').split('\r\n').join('\n');
  const raw = stripComments(source);
  for (const { selector, body } of topLevelRules(raw)) {
    if (ROOT_SELECTOR.test(selector)) {
      Object.assign(cssVars.light, parseDecls(body));
    } else if (DARK_SELECTOR.test(selector)) {
      Object.assign(cssVars.dark, parseDecls(body));
    } else if (selector === '@theme inline') {
      Object.assign(cssVars.theme, parseDecls(body));
    } else if (selector === '@layer components') {
      /*
       * 源码里**已经**分好层的，拆开并进去，不要再套一层。
       *
       * optics.css 里的 .lg-surface 现在自己写在 @layer components 里
       * （给直接 `@import '@createagle/glass-core/optics.css'` 的消费方用 —— 无层规则
       *  会压过 Tailwind 的工具类，见那条规则上面的注释）。
       * 而这里本来就要把组件类归到 components 层，照搬就成了
       * `@layer components { @layer components { … } }` —— 一个多余的子层。
       */
      for (const inner of topLevelRules(body)) {
        mergeInto(layerComponents, inner.selector, ruleToObject(inner.body));
      }
    } else if (isVarOnlyRule(body)) {
      // 只含自定义属性的块（高对比覆盖等）→ base 层
      mergeInto(layerBase, selector, ruleToObject(body));
    } else {
      // 组件类、渲染路径、媒体查询 → components 层
      mergeInto(layerComponents, selector, ruleToObject(body));
    }
  }
}

const item = {
  $schema: 'https://ui.shadcn.com/schema/registry-item.json',
  name: 'theme',
  type: 'registry:theme',
  title: 'Liquid Glass Theme',
  description:
    'Liquid Glass UI 的完整 token 体系：Layer 1 原始值、Layer 2 材质与角色（明暗 × 常规/高对比 共四套）、Layer 3 shadcn 兼容层，以及 Tier A/B/C 三档渲染路径。',
  author: 'Liquid Glass UI',
  dependencies: ['@createagle/glass-core'],
  files: [],
  cssVars,
  css: {
    '@layer base': layerBase,
    '@layer components': layerComponents,
  },
  docs: [
    '已安装 Liquid Glass 主题。',
    '',
    '还需要两步：',
    '1) 安装光学引擎：pnpm add @createagle/glass-core',
    '2) 确认你的 globals.css 里有 shadcn 默认的暗色变体声明：',
    '   @custom-variant dark (&:is(.dark *));',
    '   （shadcn init 会自动写入。缺了它，dark: 工具类不会跟随 .dark 类。）',
    '',
    '在应用根组件挂上 <GlassProvider>，并在 <head> 注入 glassSsrScript() 以避免首屏闪烁。',
  ].join('\n'),
  categories: ['theme', 'liquid-glass'],
};

/**
 * 输出成一个**子 registry.json**（而不是裸的 registry-item.json）——
 * 根 registry.json 的 `include` 字段要求指向明确的 registry.json 文件，
 * 不接受单个 item 文件，也不接受目录。
 * 见 docs/research/shadcn-registry.md §2。
 */
const outDir = join(WWW, 'registry', 'glass');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'registry.json');
const next =
  JSON.stringify(
    { $schema: 'https://ui.shadcn.com/schema/registry.json', items: [item] },
    null,
    2,
  ) + '\n';

/**
 * `--check`：只比对，不写。
 *
 * CI 里本来就有一道等价的闸（registry-smoke.yml 的「确认生成物与源同步」，
 * 靠 `git status --porcelain` 判断）。加这个 flag 是因为那道闸有两个前提：
 * **提交得推上去、工作区得干净**。
 *
 * ⚠️ 而 P2 的七个提交一次都没推 —— 于是 `--lg-base-alpha-raw` /
 * `--lg-large-boost` 和两条 `[data-scale='large']` 规则连着三个提交没进
 * registry：装了主题的用户拿到的 Sidebar，`scale="large"` 那条 CSS 根本不存在，
 * 而本机跑什么都是绿的。
 *
 * 这个 flag 不依赖 git，也不要求工作区干净，随时能跑；
 * `scripts/registry-lint.mjs` 会替你跑它。
 */
if (process.argv.includes('--check')) {
  const current = existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';
  if (current === next) {
    console.log('✓ registry/glass/registry.json 与 tokens/*.css 一致');
    process.exit(0);
  }
  const a = current.split('\n');
  const b = next.split('\n');
  const i = a.findIndex((line, k) => line !== b[k]);
  console.error('✗ registry/glass/registry.json 与 tokens/*.css 不一致。');
  console.error(`  第一处差异在第 ${i + 1} 行：`);
  console.error(`    磁盘上：${a[i] ?? '（文件到此为止）'}`);
  console.error(`    应该是：${b[i] ?? '（文件到此为止）'}`);
  console.error('  跑 node apps/www/scripts/generate-theme-item.mjs 重新生成，');
  console.error('  再跑 pnpm --filter www registry:build 让 public/r 跟上，然后提交。');
  process.exit(1);
}

writeFileSync(outFile, next, 'utf8');

const counts = {
  theme: Object.keys(cssVars.theme).length,
  light: Object.keys(cssVars.light).length,
  dark: Object.keys(cssVars.dark).length,
  base: Object.keys(layerBase).length,
  components: Object.keys(layerComponents).length,
};
console.log('生成子 registry →', outFile);
console.log(
  `  cssVars.theme ${counts.theme} 项 · light ${counts.light} 项 · dark ${counts.dark} 项` +
    ` · css @layer base ${counts.base} 条 · @layer components ${counts.components} 条`,
);

if (counts.light === 0 || counts.dark === 0 || counts.theme === 0) {
  console.error('✗ 解析结果为空，生成失败');
  process.exit(1);
}
