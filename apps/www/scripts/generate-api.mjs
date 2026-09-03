/**
 * 从组件源码的 TypeScript 类型生成 API 数据。
 *
 * PROJECT_SPEC §12：「API Reference —— props 表格（**从 TS 类型自动生成，不要手写**）」
 *
 * ── 为什么不用 react-docgen-typescript ────────────────────────────────
 *
 * 本库的 props 接口普遍这么写：
 *
 *     interface GlassButtonProps extends Omit<React.ComponentProps<'button'>, …> { … }
 *
 * 通用工具会把继承链**整个摊平**，于是 API 表里出现 300 多个 DOM 属性
 * （`onAnimationIteration`、`itemProp`、`vocab`…），组件自己那两三个
 * 真正需要说明的 prop 反而被淹没。
 *
 * 所以这里只取**接口自己声明的成员**，继承来的部分不摊平、
 * 而是把基类原样写成一行说明（"另外继承 <button> 的原生属性"）。
 * 少即是准确 —— 摊平出来的那 300 行没人会读，也没人维护得了。
 *
 * ── 三张表，全部来自源码 ──────────────────────────────────────────────
 *
 *   1. props        —— 每个 `Glass*Props` 接口自己的成员 + JSDoc + 默认值
 *                      默认值从组件函数的解构参数里读，不是手抄的
 *   2. 尺寸常量      —— `*GEOMETRY` / `MOTION` 这类 `as const` 对象，
 *                      **连同 JSDoc 里的 `[实测]` / `[推定]` 可信度标注一起**。
 *                      这是本库的立身之本：文档站上每一个数字都要能说出出处。
 *   3. APPLE REFERENCE —— 文件头那段注释，原样搬到页面上
 *
 *   node scripts/generate-api.mjs
 */

import ts from 'typescript';
import { readFileSync, writeFileSync, mkdirSync, globSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT_DIR = resolve(ROOT, '__registry__');

/* ── 建 program ───────────────────────────────────────────────────────── */

const files = globSync('registry/glass/ui/*.tsx', { cwd: ROOT }).map((f) => resolve(ROOT, f));

const configPath = resolve(ROOT, 'tsconfig.json');
const parsed = ts.parseJsonConfigFileContent(
  ts.readConfigFile(configPath, ts.sys.readFile).config,
  ts.sys,
  ROOT,
);
const program = ts.createProgram(files, { ...parsed.options, noEmit: true });
const checker = program.getTypeChecker();

/* ── 工具 ─────────────────────────────────────────────────────────────── */

/** JSDoc 正文。保留换行，前端按行渲染。 */
function docOf(node) {
  const sym = checker.getSymbolAtLocation(node.name ?? node);
  if (sym) {
    const text = ts.displayPartsToString(sym.getDocumentationComment(checker)).trim();
    if (text) return text;
  }
  // 属性赋值（`as const` 对象里的键）拿不到 symbol 文档时，退回读原始 JSDoc
  const jsDoc = node.jsDoc?.[node.jsDoc.length - 1];
  if (!jsDoc) return '';
  return typeof jsDoc.comment === 'string'
    ? jsDoc.comment.trim()
    : (jsDoc.comment ?? []).map((c) => c.text ?? '').join('').trim();
}

/** 把多行类型文本压成一行，方便放进表格 */
const oneLine = (s) => s.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();

/**
 * 继承子句转成一句人话。
 * 只认本库真正用到的几种形态，认不出来就原样回显 —— 不猜。
 */
function describeHeritage(text, localAliases = new Map()) {
  let t = oneLine(text);
  /**
   * 本地类型别名展开一层。
   *
   * `interface GlassButtonProps extends NativeButtonProps` 里那个
   * `NativeButtonProps` 是同文件的 `type NativeButtonProps = Omit<...>`。
   * 不展开的话 API 表上只会写「继承 NativeButtonProps」—— 读者还得去翻源码。
   * 只展开一层：再往下就该去看类型定义本身了。
   */
  if (localAliases.has(t)) t = oneLine(localAliases.get(t));
  let m = t.match(/^Omit<\s*React\.ComponentProps<'(\w+)'>\s*,([\s\S]*)>$/);
  if (m) {
    const omitted = m[2]
      .split('|')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .filter(Boolean);
    return {
      kind: 'native',
      text: t,
      summary: `继承 <${m[1]}> 的原生属性（已排除 ${omitted.join('、')}）`,
    };
  }
  m = t.match(/^React\.ComponentProps<'(\w+)'>$/);
  if (m) return { kind: 'native', text: t, summary: `继承 <${m[1]}> 的原生属性` };
  m = t.match(/^React\.ComponentProps<typeof (\w+)\.(\w+)>$/);
  if (m) return { kind: 'radix', text: t, summary: `继承 Radix ${m[1]}.${m[2]} 的属性` };
  if (/^Glass\w+Props$/.test(t)) return { kind: 'local', text: t, summary: `继承 ${t}` };
  return { kind: 'unknown', text: t, summary: `继承 ${t}` };
}

/**
 * 组件函数的解构默认值。
 *
 * `function SelectTrigger({ side = 'bottom', … }: GlassSelectTriggerProps)`
 * 里的 `'bottom'` 是**唯一的事实来源** —— 手抄进文档必然会漂。
 */
function collectDefaults(sourceFile) {
  /** @type {Map<string, Record<string,string>>} 接口名 → { prop: 默认值文本 } */
  const byInterface = new Map();

  /** 参数类型里出现的接口名（交叉类型也拆开找） */
  function interfaceNamesOf(typeNode) {
    if (!typeNode) return [];
    if (ts.isTypeReferenceNode(typeNode)) return [typeNode.typeName.getText()];
    if (ts.isIntersectionTypeNode(typeNode)) return typeNode.types.flatMap(interfaceNamesOf);
    return [];
  }

  function visit(node) {
    const fn =
      ts.isFunctionDeclaration(node) && node.parameters.length === 1
        ? node
        : ts.isVariableDeclaration(node) &&
            node.initializer &&
            (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
            node.initializer.parameters.length === 1
          ? node.initializer
          : null;
    if (fn) {
      const param = fn.parameters[0];
      const names = interfaceNamesOf(param.type);
      if (names.length && param.name && ts.isObjectBindingPattern(param.name)) {
        const defaults = {};
        for (const el of param.name.elements) {
          if (!el.initializer) continue;
          const key = (el.propertyName ?? el.name).getText();
          defaults[key] = oneLine(el.initializer.getText());
        }
        for (const n of names) {
          if (!byInterface.has(n)) byInterface.set(n, {});
          Object.assign(byInterface.get(n), defaults);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return byInterface;
}

/** 文件头的 `// APPLE REFERENCE:` 注释块，原样取出（去掉 `// ` 前缀） */
function appleReference(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith('// APPLE REFERENCE:'));
  if (start < 0) return null;
  const out = [];
  for (let i = start; i < lines.length; i++) {
    const l = lines[i];
    if (!l.startsWith('//')) break;
    out.push(l.replace(/^\/\/ ?/, ''));
  }
  return out;
}

/* ── 抽取 ─────────────────────────────────────────────────────────────── */

const components = {};

for (const file of files) {
  const sf = program.getSourceFile(file);
  if (!sf) continue;
  const name = basename(file, '.tsx');
  const raw = readFileSync(file, 'utf8');
  const defaultsByInterface = collectDefaults(sf);

  /** 同文件里的 `type X = ...` —— 继承子句里出现时展开一层，见 describeHeritage */
  const localAliases = new Map();
  for (const stmt of sf.statements) {
    if (ts.isTypeAliasDeclaration(stmt)) localAliases.set(stmt.name.text, stmt.type.getText());
  }

  /** @type {Array<object>} */
  const propGroups = [];
  /** @type {Array<object>} */
  const constants = [];

  for (const stmt of sf.statements) {
    /* props 接口 */
    if (ts.isInterfaceDeclaration(stmt) && /^Glass\w*Props$/.test(stmt.name.text)) {
      const iface = stmt.name.text;
      const defaults = defaultsByInterface.get(iface) ?? {};
      const props = [];
      for (const member of stmt.members) {
        if (!ts.isPropertySignature(member) || !member.name) continue;
        const propName = member.name.getText().replace(/^'|'$/g, '');
        props.push({
          name: propName,
          type: member.type ? oneLine(member.type.getText()) : 'unknown',
          required: !member.questionToken,
          default: defaults[propName] ?? null,
          doc: docOf(member),
        });
      }
      const heritage = (stmt.heritageClauses ?? [])
        .flatMap((h) => h.types)
        .map((t) => describeHeritage(t.getText(), localAliases));
      propGroups.push({ interface: iface, props, heritage });
    }

    /* `as const` 的尺寸常量 —— 连同可信度标注 */
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        const init = decl.initializer;
        if (
          !init ||
          !ts.isAsExpression(init) ||
          !ts.isObjectLiteralExpression(init.expression) ||
          !ts.isIdentifier(decl.name)
        )
          continue;
        const entries = [];
        for (const p of init.expression.properties) {
          if (!ts.isPropertyAssignment(p)) continue;
          entries.push({
            key: p.name.getText(),
            value: oneLine(p.initializer.getText()),
            doc: docOf(p),
          });
        }
        if (entries.length) {
          constants.push({
            name: decl.name.text,
            exported: !!stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword),
            doc: docOf(decl),
            entries,
          });
        }
      }
    }
  }

  components[name] = {
    name,
    file: `registry/glass/ui/${name}.tsx`,
    appleReference: appleReference(raw),
    propGroups,
    constants,
  };
}

/* ── 可信度标注统计 —— 让「有没有裸数字」这件事可被检查 ─────────────── */

const CREDIBILITY = ['[官方]', '[实测]', '[推定]', '[待核实]'];
let labelled = 0;
let unlabelled = 0;
const missing = [];
for (const c of Object.values(components)) {
  for (const konst of c.constants) {
    for (const e of konst.entries) {
      if (CREDIBILITY.some((k) => e.doc.includes(k))) labelled++;
      else {
        unlabelled++;
        missing.push(`${c.name}.${konst.name}.${e.key}`);
      }
    }
  }
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  resolve(OUT_DIR, 'api.json'),
  JSON.stringify({ components, stats: { labelled, unlabelled, missing } }, null, 2) + '\n',
);

const nProps = Object.values(components).reduce(
  (n, c) => n + c.propGroups.reduce((m, g) => m + g.props.length, 0),
  0,
);
console.log(
  `生成 API 数据 → __registry__/api.json\n` +
    `  ${Object.keys(components).length} 个组件 · ${nProps} 个 prop · ` +
    `${labelled + unlabelled} 个尺寸常量（${labelled} 个带可信度标注、${unlabelled} 个没有）`,
);
if (missing.length) {
  /*
   * ⚠️ **这里必须退出非零，不能只打印。**
   *
   * 「每个尺寸常量都要带可信度标注」原本只有 CI 里一个独立步骤在把关 ——
   * 于是本机怎么跑都是绿的，推上去才红。Phase 7 第二批就是这么挂的：
   * progress 的 trackHeight 写成了 `[推定 · 借自 Slider 实测]`，
   * 中间插了字，检测器找的完整 `[推定]` 匹配不上。
   *
   * 生成器是每次 build / gen 都会跑的，把闸放在这儿才是本机最早能拦住的地方。
   * 可信度标注只认这四个**完整**的方括号词：[官方] [实测] [推定] [待核实]，
   * 限定语请写在方括号外面。
   */
  console.error(`
✗ ${unlabelled} 个尺寸常量没有可信度标注：${missing.join(', ')}`);
  console.error('  可信度标注只认完整的 [官方] / [实测] / [推定] / [待核实]，限定语写在方括号外面。');
  process.exit(1);
}
