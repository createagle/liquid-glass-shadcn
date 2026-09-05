'use client';

// APPLE REFERENCE: UITextView（iOS 26+）
//
// ⚠️ **没有可量的参考图。** iOS 27 资源里那几块 Grouped List
// （节点 12740:33850 等）全是**单行** Text Field，没有出现多行输入区。
// 所以本组件的几何来自两处，都逐条标注：
//
//   · 与 Input 共享的部分（字号 17、左内缩 16、占位符处理）→ 沿用 Input 的 [实测]
//   · 多行特有的部分（最小高度、行高、竖向内边距）        → **全部 `[推定]`**
//
// component-inventory 把 Textarea 标成「内容层 / 弱 B」。本组件按这个走：
//   list   不画框，交给 <Card>。与 Input 的 list 同源，那一支有实测依据。
//   field  弱 B —— 用 Layer B 磨砂，但**圆角不是胶囊**（多行控件做成胶囊很怪），
//          取圆角阶梯上的 14。
//
// ⚠️ 占位符颜色同样**刻意不还原** Apple 的 #c5c5c7（压白底 1.72:1，过不了 AA），
//    改用 `--lg-label-secondary`。理由见 input.tsx 文件头。

import * as React from 'react';
import { GlassSurface } from '@createagle/glass-core';
import { cn } from '@/lib/utils';
import { useFieldControl } from '@/components/ui/field';

const GEOMETRY = {
  /** 字号。[实测] 17pt —— 与 Input 同源 */
  fontSize: 17,
  /** 行高倍数。`[推定]` —— 排版里 17/22 那一档换算成 1.294，取整到 1.3 */
  lineHeight: 1.3,
  /** 默认可见行数。`[推定]` */
  rows: 3,
  /** field：左右内边距（px）。`[推定]` —— 与 Input field 的 44×0.25 对齐 */
  paddingInline: 11,
  /** field：上下内边距（px）。`[推定]` */
  paddingBlock: 10,
  /** field：圆角（px）。`[推定]` —— 取圆角阶梯上的 14，不用胶囊 */
  radius: 14,
} as const;

export type GlassTextareaVariant = 'field' | 'list';

export interface GlassTextareaProps extends React.ComponentProps<'textarea'> {
  /** 见 input.tsx 的同名 prop。`list` 那一支才有实测依据。 */
  variant?: GlassTextareaVariant;
  /**
   * 随内容自动长高，不出滚动条。默认 false。
   *
   * 打开后 `rows` 只作为**最小**高度。实现是每次输入把 height 归零再读
   * scrollHeight —— 归零这一步不能省，否则元素只会长不会缩。
   */
  autoResize?: boolean;
}

function Textarea({
  className,
  variant = 'field',
  autoResize = false,
  style,
  rows = GEOMETRY.rows,
  onChange,
  id: idProp,
  'aria-describedby': describedByProp,
  'aria-invalid': invalidProp,
  ref: refProp,
  ...props
}: GlassTextareaProps) {
  const field = useFieldControl();
  const id = idProp ?? field.id;
  const describedBy = describedByProp ?? field.describedBy;
  const invalid = invalidProp ?? field.invalid;

  const innerRef = React.useRef<HTMLTextAreaElement>(null);
  const setRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof refProp === 'function') refProp(node);
      else if (refProp) (refProp as React.RefObject<HTMLTextAreaElement | null>).current = node;
    },
    [refProp],
  );

  const grow = React.useCallback(() => {
    const node = innerRef.current;
    if (!node || !autoResize) return;
    // ⚠️ 先归零再读 scrollHeight —— 不归零的话 scrollHeight 永远 ≥ 当前高度，
    //    元素只会越长越高，删字时缩不回去。
    node.style.height = '0px';
    node.style.height = `${node.scrollHeight}px`;
  }, [autoResize]);

  React.useEffect(() => {
    grow();
  }, [grow]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    grow();
    onChange?.(e);
  };

  const textareaEl = (
    <textarea
      ref={setRef}
      id={id}
      rows={rows}
      data-slot="textarea"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn(
        'peer w-full flex-1 resize-none bg-transparent outline-none',
        'placeholder:text-[var(--lg-label-secondary)]',
        'disabled:cursor-not-allowed disabled:opacity-40',
        // autoResize 时不该出现滚动条 —— 高度就是内容高度
        autoResize && 'overflow-hidden',
        variant === 'list' && 'px-0',
      )}
      style={{
        fontSize: GEOMETRY.fontSize,
        lineHeight: GEOMETRY.lineHeight,
        color: 'var(--lg-label-primary)',
        caretColor: 'var(--lg-blue)',
      }}
      onChange={handleChange}
      {...props}
    />
  );

  if (variant === 'list') {
    return (
      <div
        data-slot="textarea-wrapper"
        data-variant="list"
        className={cn('flex w-full', className)}
        style={{ paddingBlock: GEOMETRY.paddingBlock, ...style }}
      >
        {textareaEl}
      </div>
    );
  }

  return (
    <GlassSurface
      layer="base"
      radius={GEOMETRY.radius}
      className={cn(
        'flex w-full',
        'has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-[var(--lg-ring)]',
        'has-[textarea:disabled]:opacity-60',
        className,
      )}
      style={{
        paddingInline: GEOMETRY.paddingInline,
        paddingBlock: GEOMETRY.paddingBlock,
        ...(invalid ? { boxShadow: 'inset 0 0 0 1.5px var(--lg-destructive-fill)' } : {}),
        ...style,
      }}
    >
      {textareaEl}
    </GlassSurface>
  );
}

export { Textarea, GEOMETRY as TEXTAREA_GEOMETRY };
