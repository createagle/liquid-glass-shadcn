'use client';

// APPLE REFERENCE: UITextField + 附件视图（leftView / rightView）
//
// ⚠️ **没有 InputGroup 自己的参考图。** iOS 27 资源里那四行文本框
// （节点 12740:33850）只有一行带附件 —— 就是有值那行右侧的**清除按钮**，
// 18×18、右内缩 17（已实测，见 apple-metrics.md §8.3）。
// 除此之外没有任何「输入框 + 前后附件」的样例。
//
//   借来的值：
//     行高 52 / 文字左内缩 16     [实测]（与 Input 的 list 变体同源）
//     附件与文字的间距 8          `[推定]`
//     附件最小触控目标 44         [官方]（HIG 44×44pt）
//
// ── 关键设计：**框由 group 画，输入框自己不画** ─────────────────────────
//
// 这是 Input 那两个 variant 直接带来的结果，不用新造第三个：
//   · `variant="list"` 就是「不画任何框」的那一支（而且它才是有实测依据的那个）
//   · InputGroup 自己是一块 Layer B 玻璃，把附件和 list 变体的输入框装进去
//
// 如果让 Input 保持 `field`（自带玻璃胶囊）再套一层 group，就会出现
// **两层玻璃叠在一起** —— 材质会翻倍变浑，而且两个圆角对不齐。
// 组件会在 dev 模式下对这种用法发一次警告。

import * as React from 'react';
import { GlassSurface } from '@createagle/glass-core';
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /** 默认高度（px）。`[推定]` —— 与 Input 的 field 变体对齐（HIG 44pt 触控下限） */
  height: 44,
  /** 左右内边距 / 高度之比。`[推定]` —— 借用 Button 实测的 0.25 */
  paddingRatio: 0.25,
  /** 附件与输入文字之间的间距（px）。`[推定]` */
  gap: 8,
  /** 附件的最小触控目标（px）。[官方] HIG 44×44pt */
  minTouchTarget: 44,
} as const;

export interface GlassInputGroupProps extends React.ComponentProps<'div'> {
  /** 高度（px）。默认 44。 */
  height?: number;
  /** 整组禁用时变灰。真正的 disabled 请同时传给里面的 input。 */
  disabled?: boolean;
  /** 校验失败时换成红色描边。 */
  invalid?: boolean;
}

/**
 * 一块 Layer B 玻璃，把附件和输入框装在一起。
 *
 * ```tsx
 * <InputGroup>
 *   <InputGroupAddon>￥</InputGroupAddon>
 *   <Input variant="list" placeholder="0.00" />
 *   <InputGroupAddon interactive aria-label="清空">⌫</InputGroupAddon>
 * </InputGroup>
 * ```
 */
function InputGroup({
  className,
  height = GEOMETRY.height,
  disabled = false,
  invalid = false,
  style,
  children,
  ...props
}: GlassInputGroupProps) {
  const inset = Math.round(GEOMETRY.paddingRatio * height);

  /**
   * 开发期检查：里面套了自带玻璃的 Input 会变成两层玻璃。
   *
   * ⚠️ 只在 dev 跑，而且只看**直接子元素**上有没有 `variant="list"` ——
   * 深挖整棵子树代价太大，而这个错误几乎总是发生在直接子元素上。
   */
  if (process.env.NODE_ENV !== 'production') {
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      const props = child.props as { variant?: string; 'data-slot'?: string };
      // 只认得出本库的 Input / Textarea：它们没传 variant 时默认就是 field
      const name =
        typeof child.type === 'function' ? (child.type as { name?: string }).name : undefined;
      if ((name === 'Input' || name === 'Textarea') && props.variant !== 'list') {
        console.warn(
          '[Liquid Glass] <InputGroup> 里的 <' +
            name +
            '> 应当传 variant="list" —— ' +
            '否则输入框会自带一层玻璃，与 group 的玻璃叠在一起（材质翻倍、圆角对不齐）。',
        );
      }
    });
  }

  return (
    <GlassSurface
      layer="base"
      radius={height / 2}
      className={cn('flex w-full items-center', className)}
      style={{
        height,
        paddingInline: inset,
        gap: GEOMETRY.gap,
        ...(disabled ? { opacity: 0.6 } : {}),
        ...(invalid ? { boxShadow: 'inset 0 0 0 1.5px var(--lg-destructive-fill)' } : {}),
        ...style,
      }}
      {...props}
      /*
       * ⚠️ `data-slot` 写在 `{...props}` **之后**。
       *
       * 本仓库在这上面踩过四次（SheetClose / ResponsiveOverlay / DropdownMenu /
       * 命令面板）：写在前面的话，调用方顺手传一个 data-slot 就把组件自己的
       * 标记冲掉了，而所有靠 [data-slot=...] 选中它的测试与样式会一起静默失效。
       * 写在后面，调用方覆盖不了。
       */
      data-slot="input-group"
      data-invalid={invalid ? 'true' : undefined}
    >
      {children}
    </GlassSurface>
  );
}

export interface GlassInputGroupAddonProps extends React.ComponentProps<'button'> {
  /**
   * 可点的附件（清空、显示密码、选择单位…）。默认 `false` = 纯装饰。
   *
   * ⚠️ 装饰性附件渲染成 `<span aria-hidden>`，**不进无障碍树**：
   * 一个「￥」符号对屏幕阅读器没有意义，输入框的 aria-label 里
   * 本来就该写清楚这是金额。可点的才渲染成真的 button。
   */
  interactive?: boolean;
}

function InputGroupAddon({
  className,
  interactive = false,
  children,
  style,
  ...props
}: GlassInputGroupAddonProps) {
  const shared = cn(
    'flex shrink-0 items-center justify-center',
    'text-[var(--lg-label-secondary)]',
    className,
  );

  if (!interactive) {
    return (
      <span data-slot="input-group-addon" aria-hidden="true" className={shared} style={style}>
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-slot="input-group-addon"
      data-interactive="true"
      className={cn(
        shared,
        'relative rounded-full outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--lg-ring)]',
        'disabled:pointer-events-none disabled:opacity-40',
        /*
         * 命中区撑到 44×44（HIG [官方]）而不改变视觉尺寸 ——
         * 与 Switch 的做法一致：伪元素往外扩，视觉上还是那么大。
         */
        "before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2",
        'before:h-[44px] before:w-[44px] before:content-[""]',
      )}
      style={style}
      {...props}
    >
      {children}
    </button>
  );
}

export { InputGroup, InputGroupAddon, GEOMETRY as INPUT_GROUP_GEOMETRY };
