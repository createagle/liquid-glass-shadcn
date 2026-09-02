/**
 * 把 `registry/glass/examples/*.tsx` 编成一张表：**组件 + 源码字符串**。
 *
 * PROJECT_SPEC §12 的组件页要「Preview / Code 切换」。Code 那一半必须是
 * **示例文件本身的源码**，不能另外手写一份 —— 手写的那份第二天就和实际渲染的
 * 不一致了，而读者恰恰是照着它复制的。
 *
 * 示例文件的 import 写的是 `@/components/ui/button`，也就是用户
 * `shadcn add` 之后工程里的形态。同一段源码在本站能编译、复制走也能直接用。
 *
 *   node scripts/generate-examples.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, globSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT_DIR = resolve(ROOT, '__registry__');

// globSync 在 Windows 上返回反斜杠路径，import 说明符必须是正斜杠
const files = globSync('registry/glass/examples/*.tsx', { cwd: ROOT })
  .map((f) => f.replaceAll('\\', '/'))
  .sort();

const imports = [];
const entries = [];

for (const rel of files) {
  const name = basename(rel, '.tsx');
  const ident = 'Ex' + name.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
  const source = readFileSync(resolve(ROOT, rel), 'utf8').trimEnd();
  imports.push(`import ${ident} from '@/${rel.replace(/\.tsx$/, '')}';`);
  entries.push(
    `  ${JSON.stringify(name)}: { component: ${ident}, source: ${JSON.stringify(source)} },`,
  );
}

const out = `// 由 scripts/generate-examples.mjs 生成，不要手改。
'use client';

import type { ComponentType } from 'react';
${imports.join('\n')}

export interface ExampleEntry {
  component: ComponentType;
  /** 示例文件的源码原文 —— Preview/Code 里 Code 那一半显示的就是它 */
  source: string;
}

export const examples: Record<string, ExampleEntry> = {
${entries.join('\n')}
};
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, 'examples.tsx'), out);
console.log(`生成示例表 → __registry__/examples.tsx（${files.length} 个示例）`);
