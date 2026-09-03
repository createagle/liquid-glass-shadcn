'use client';

// APPLE REFERENCE: HIG Typography（SF Pro）/ Grouped List 行标签
//
// 尺寸来源：Apple Design Resources《iOS and iPadOS 27》Figma 文件
// （节点 12740:33850 / 12740:33923），记录见 apple-metrics.md §7.6、§8.2。
//
//   行标签字号   17 pt（= SF body）   [实测] —— Alert 标题/正文、
//                                     Grouped List 行标签、文本框值，三处同一档
//
// ⚠️ **Label 不是一个 Apple 控件。** component-inventory 里它被标成
// 「无 Apple 控件对应，属排版」，这里也照这个定位实现：**内容层，不套任何材质**。
// PROJECT_SPEC §2「材质属于控件层」—— 给一个 <label> 糊玻璃是这条规则最典型的反例。
//
// 所以本组件几乎没有样式，它的存在理由是**接线**：
// 放进 <Field> 里就自动拿到 htmlFor，点标签能聚焦到控件。
// 这件事手写时最容易漏，而漏了在视觉上完全看不出来。

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useFieldControl } from '@/components/ui/field';

const GEOMETRY = {
  /** 字号。[实测] 17pt —— 与 Grouped List 行标签同一档 */
  fontSize: 17,
} as const;

export interface GlassLabelProps extends React.ComponentProps<'label'> {}

function Label({ className, htmlFor: htmlForProp, style, ...props }: GlassLabelProps) {
  // 在 Field 外面用时 useFieldControl 返回空对象，htmlFor 就完全交给调用方
  const field = useFieldControl();
  const htmlFor = htmlForProp ?? field.id;

  return (
    <label
      data-slot="label"
      {...(htmlFor ? { htmlFor } : {})}
      className={cn(
        'inline-flex items-center gap-2 leading-tight font-medium select-none',
        // 控件禁用时标签跟着变灰 —— 靠 :has 从兄弟节点读状态，不用 JS 传
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-40',
        className,
      )}
      style={{ fontSize: GEOMETRY.fontSize, color: 'var(--lg-label-primary)', ...style }}
      {...props}
    />
  );
}

export { Label, GEOMETRY as LABEL_GEOMETRY };
