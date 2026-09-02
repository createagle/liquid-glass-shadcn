'use client';

/**
 * 安装命令 —— CLI / Manual 两个 tab（PROJECT_SPEC §12）。
 *
 * 内容全部由 `registry.json` 里那一条 item 推出来，没有手写：
 *   · CLI    → `shadcn add @glass/<name>`
 *   · Manual → npm 依赖 + registryDependencies + 组件源码路径 + item 自带的 docs
 *
 * 改了 registry item，这一段跟着变；不会出现「文档说要装 A，实际带的是 B」。
 */

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CodeBlock } from '@/components/code-block';
import type { RegistryItem } from '@/lib/registry';

export function InstallTabs({ item }: { item: RegistryItem }) {
  const npmDeps = (item.dependencies ?? []).join(' ');
  const registryDeps = item.registryDependencies ?? [];

  const manual = [
    '# 1) 光学引擎（npm 包，不进 registry）',
    `pnpm add ${npmDeps || '@glass/core'}`,
    '',
    '# 2) 依赖的 registry item',
    registryDeps.length
      ? `npx shadcn@latest add ${registryDeps.join(' ')}`
      : '# （这个组件没有 registryDependencies）',
    '',
    '# 3) 组件源码：把下面这个文件复制进你的工程',
    ...(item.files ?? []).map((f) => `#   apps/www/${f.path}  →  src/components/ui/${item.name}.tsx`),
  ].join('\n');

  return (
    <Tabs defaultValue="cli" height={44}>
      <TabsList>
        <TabsTrigger value="cli">CLI</TabsTrigger>
        <TabsTrigger value="manual">手动</TabsTrigger>
      </TabsList>

      <TabsContent value="cli" className="pt-3">
        <CodeBlock lang="bash" code={`npx shadcn@latest add @glass/${item.name}`} />
        <p className="pt-2 text-[13px] text-[var(--lg-label-secondary)]">
          需要先在 <code className="font-mono">components.json</code> 里注册{' '}
          <code className="font-mono">@glass</code> 命名空间，见「安装」页。
          <br />
          registryDependencies 会自动带上：
          {registryDeps.length ? registryDeps.join('、') : '（无）'}
        </p>
      </TabsContent>

      <TabsContent value="manual" className="pt-3">
        <CodeBlock lang="bash" code={manual} />
      </TabsContent>
    </Tabs>
  );
}
