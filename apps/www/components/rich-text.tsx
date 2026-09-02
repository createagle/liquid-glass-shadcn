/**
 * 源码注释里的轻量标记 → 真正的排版。
 *
 * 组件源码的 JSDoc 与 registry.json 的 description 里普遍写着
 * `**重点**` 与 `` `代码` `` —— 那是给读源码的人看的。搬到页面上不处理的话，
 * 星号与反引号会**原样露出来**（第一版就是这样，截图上一眼就看见了）。
 *
 * 刻意只认这两种标记，不引 Markdown 渲染器：
 * 这些文本是注释不是文章，支持得越多越容易把注释里的普通符号误解析。
 */

import * as React from 'react';

/** `**粗体**` 与 `` `代码` `` —— 两种都匹配，按出现顺序切分 */
const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`)/g;

export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(TOKEN).filter((s) => s !== '');
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-medium text-[var(--lg-label-primary)]">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="font-mono text-[0.92em]">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
}
