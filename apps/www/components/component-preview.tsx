'use client';

/**
 * Preview / Code 切换 —— PROJECT_SPEC §12 的 `ComponentPreview` 模式。
 *
 * 两半的内容都来自**同一个示例文件**：
 *   Preview = 那个文件默认导出的组件，真的渲染出来、可交互
 *   Code    = 那个文件的源码原文（`scripts/generate-examples.mjs` 生成）
 *
 * 所以 Code 永远不可能和 Preview 对不上 —— 它们是同一份东西的两种投影。
 *
 * 切换用的是本库的 `Tabs`（SPEC §12「站点必须吃自己的狗粮」）。
 */

import * as React from 'react';
import { GlassSurface } from '@createagle/glass-core';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/code-block';
import { withBase } from '@/lib/base-path';
import { examples } from '@/__registry__/examples';
import { cn } from '@/lib/utils';

export interface ComponentPreviewProps {
  name: string;
  /** 预览区最小高度。浮层类组件需要更高，好让面板展开后不被裁掉。 */
  minHeight?: number;
  className?: string;
}

export function ComponentPreview({ name, minHeight = 220, className }: ComponentPreviewProps) {
  const entry = examples[name];

  if (!entry) {
    // 不静默吞掉 —— 示例缺失是内容缺口，应该在页面上看得见
    return (
      <div className="rounded-2xl border border-dashed border-[var(--lg-separator)] p-6 text-[15px] text-[var(--lg-label-secondary)]">
        没有名为 <code className="font-mono">{name}</code> 的示例。
        新建 <code className="font-mono">registry/glass/examples/{name}.tsx</code> 后重新跑{' '}
        <code className="font-mono">pnpm --filter www gen</code>。
      </div>
    );
  }

  const Demo = entry.component;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <Tabs defaultValue="preview" height={44}>
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="preview">预览</TabsTrigger>
            <TabsTrigger value="code">代码</TabsTrigger>
          </TabsList>
          <Button
            variant="plain"
            size="sm"
            /*
             * 独立预览路由 —— 便于截图与 iframe 嵌入（SPEC §12）。
             *
             * ⚠️ window.open **不经过 Next**，basePath 不会自动加上去
             * （只有 <Link> 和 Next 自己的资源有），所以走 withBase()。
             * 少了这一截，部署到 GitHub Pages 上就是 404，
             * 而本地 basePath 为空、怎么点都对。
             */
            onClick={() => window.open(withBase(`/view/${name}`), '_blank', 'noopener')}
          >
            单独打开 ↗
          </Button>
        </div>

        <TabsContent value="preview" className="pt-3">
          <GlassSurface
            layer="base"
            radius={22}
            continuous
            className="flex items-center justify-center overflow-hidden p-8"
            style={{ minHeight }}
          >
            <Demo />
          </GlassSurface>
        </TabsContent>

        <TabsContent value="code" className="pt-3">
          <CodeBlock code={entry.source} collapseAfter={26} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
