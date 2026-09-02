'use client';

/**
 * 代码块 + 一键复制。
 *
 * PROJECT_SPEC §12：「代码块**工具栏**必须用本库组件搭建」「代码块一键复制」。
 * 复制按钮就是本库的 `Button`（plain 变体）。
 *
 * ⚠️ 刻意**没有做语法高亮**。加一个高亮库（shiki / prism）会让站点多出
 * 一份和本库主题无关的配色表，而 PROJECT_SPEC §15.4 禁止裸色值 ——
 * 高亮配色要么另建一套 token（超出本阶段范围），要么就会变成一堆硬编码颜色。
 * 现在的做法是等宽 + 本库的标签色层级。这是**已知的未完成**，记在 STATUS 里。
 */

import * as React from 'react';
import { GlassSurface } from '@glass/core';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface CodeBlockProps {
  code: string;
  /** 只作展示用的语言标签，不参与高亮 */
  lang?: string;
  className?: string;
  /** 超过这个行数就折叠，给一个「展开」按钮 */
  collapseAfter?: number;
}

export function CodeBlock({ code, lang = 'tsx', className, collapseAfter }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const timer = React.useRef(0);

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  const lines = code.split('\n');
  const collapsible = collapseAfter !== undefined && lines.length > collapseAfter;
  const shown = collapsible && !expanded ? lines.slice(0, collapseAfter).join('\n') : code;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // 非安全上下文 / 无权限：不假装成功
      setCopied(false);
    }
  }

  return (
    <GlassSurface
      layer="base"
      radius={18}
      continuous
      className={cn('relative overflow-hidden', className)}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-2.5 pb-1">
        <span className="font-mono text-[12px] tracking-wide text-[var(--lg-label-tertiary)]">
          {lang}
        </span>
        <Button variant="plain" size="sm" onClick={copy} aria-label="复制代码">
          {copied ? '已复制' : '复制'}
        </Button>
      </div>
      <pre className="overflow-x-auto px-4 pb-4 font-mono text-[13px] leading-[1.65]">
        <code>{shown}</code>
      </pre>
      {collapsible ? (
        <div className="border-t border-[var(--lg-separator)] px-4 py-1.5 text-center">
          <Button variant="plain" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? '收起' : `展开全部 ${lines.length} 行`}
          </Button>
        </div>
      ) : null}
    </GlassSurface>
  );
}
