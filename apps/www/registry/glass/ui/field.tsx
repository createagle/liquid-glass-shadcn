'use client';

// APPLE REFERENCE: SwiftUI `Form` 的一行（LabeledContent / Section footer）
//
// ⚠️ **本组件没有可量的几何。** iOS 27 资源里那几块 Grouped List
// （节点 12740:33850 等）只有「行」本身，没有出现「标签 + 控件 + 说明 + 错误」
// 这种四段式表单行 —— iOS 把说明文字放在 **Section footer** 里，
// 每行内部并不带说明。所以：
//
//   · 行高 / 内缩 / 分隔线  →  由 <Card> / <CardRow> 提供，那些有实测（§8.2、§8.3）
//   · 说明与错误文字的字号与间距  →  **`[推定]`**，逐条标注
//
// 本组件真正的价值不在几何，在**接线**：把 id / aria-describedby /
// aria-invalid 这三样自动接对。手写表单最常漏的就是这三样，
// 而它们漏了不会报错、只会让屏幕阅读器读不出「这个框错在哪」。
//
// ⚠️ 与 shadcn 的 `Field` **不声称 API 对齐**。写这个组件时没有联网核对
// 上游的导出名与形状，所以这里只实现一个自洽的最小集，不假装兼容。

import * as React from 'react';
import { cn } from '@/lib/utils';

/** 几何。**全部 `[推定]`** —— 见文件头，iOS 参考里没有这种四段式行。 */
const GEOMETRY = {
  /** 标签与控件之间的间距（px）。`[推定]` */
  labelGap: 6,
  /** 控件与说明 / 错误之间的间距（px）。`[推定]` */
  helpGap: 6,
  /** 说明与错误的字号（px）。`[推定]` —— 取排版阶梯里 body 17 下面那一档 */
  helpSize: 13,
} as const;

interface FieldContextValue {
  /** 控件的 id。Label 用它做 htmlFor，Input 用它做 id。 */
  id: string;
  /** 说明 + 错误的 id 拼起来，给控件的 aria-describedby */
  describedBy: string | undefined;
  invalid: boolean;
  /** 说明 / 错误在挂载时登记自己的 id —— 没渲染就不该出现在 describedby 里 */
  register: (kind: 'description' | 'error', id: string, on: boolean) => void;
}

const FieldCtx = React.createContext<FieldContextValue | null>(null);

/**
 * 控件侧的接线口。**在 Field 外面用也不会报错** —— 返回空值，
 * 控件退回到「调用方自己管 id 和 aria」的常规行为。
 *
 * Input / Textarea 都调它，所以这三个组件必须互相能 import；
 * registry 的 registryDependencies 里已经声明了这条依赖。
 */
export function useFieldControl(): {
  id?: string;
  describedBy?: string;
  invalid?: boolean;
} {
  const ctx = React.useContext(FieldCtx);
  if (!ctx) return {};
  return {
    id: ctx.id,
    ...(ctx.describedBy !== undefined ? { describedBy: ctx.describedBy } : {}),
    invalid: ctx.invalid,
  };
}

export interface GlassFieldProps extends React.ComponentProps<'div'> {
  /**
   * 这一项是否有校验错误。
   *
   * 只传 `invalid` 而不渲染 `<FieldError>` 是允许的（控件会红），
   * 但**不推荐** —— 只靠颜色传达状态过不了无障碍那一关。
   */
  invalid?: boolean;
  /** 覆盖自动生成的控件 id。一般不需要。 */
  id?: string;
}

function Field({ className, invalid = false, id: idProp, ...props }: GlassFieldProps) {
  const auto = React.useId();
  const id = idProp ?? `${auto}-control`;

  /**
   * describedBy 由子节点**登记**出来，而不是无条件拼两个 id。
   *
   * 无条件拼的话，没渲染 <FieldDescription> 时 aria-describedby 会指向一个
   * 不存在的元素 —— 屏幕阅读器对这种悬空引用的处理各不相同，多数是直接静默，
   * 于是「读不出说明」这件事在测试里完全看不出来。
   */
  const [ids, setIds] = React.useState<{ description?: string; error?: string }>({});
  const register = React.useCallback((kind: 'description' | 'error', rid: string, on: boolean) => {
    setIds((prev) => {
      if (on) return prev[kind] === rid ? prev : { ...prev, [kind]: rid };
      if (prev[kind] !== rid) return prev;
      const next = { ...prev };
      delete next[kind];
      return next;
    });
  }, []);

  // 顺序有意义：先读说明再读错误，和视觉顺序一致
  const describedBy = [ids.description, ids.error].filter(Boolean).join(' ') || undefined;

  const ctx = React.useMemo<FieldContextValue>(
    () => ({ id, describedBy, invalid, register }),
    [id, describedBy, invalid, register],
  );

  return (
    <FieldCtx.Provider value={ctx}>
      <div
        data-slot="field"
        data-invalid={invalid ? 'true' : undefined}
        className={cn('flex w-full flex-col', className)}
        style={{ gap: GEOMETRY.labelGap }}
        {...props}
      />
    </FieldCtx.Provider>
  );
}

export interface GlassFieldDescriptionProps extends React.ComponentProps<'p'> {}

/** 辅助说明。对应 iOS 的 Section footer —— 常驻，不随校验状态变化。 */
function FieldDescription({ className, id: idProp, ...props }: GlassFieldDescriptionProps) {
  const ctx = React.useContext(FieldCtx);
  const auto = React.useId();
  const id = idProp ?? `${auto}-description`;

  React.useEffect(() => {
    ctx?.register('description', id, true);
    return () => ctx?.register('description', id, false);
  }, [ctx, id]);

  return (
    <p
      id={id}
      data-slot="field-description"
      className={cn('text-[var(--lg-label-secondary)]', className)}
      style={{ fontSize: GEOMETRY.helpSize, marginTop: GEOMETRY.helpGap - GEOMETRY.labelGap }}
      {...props}
    />
  );
}

export interface GlassFieldErrorProps extends React.ComponentProps<'p'> {}

/**
 * 校验错误。
 *
 * `role="alert"` 让它在出现时被朗读 —— 校验失败是**需要打断**的信息，
 * 而 aria-describedby 只有在焦点落到控件上时才会被读到，
 * 用户点了提交按钮、焦点还在按钮上，光靠 describedby 是听不见的。
 */
function FieldError({ className, id: idProp, children, ...props }: GlassFieldErrorProps) {
  const ctx = React.useContext(FieldCtx);
  const auto = React.useId();
  const id = idProp ?? `${auto}-error`;
  const on = children != null && children !== false;

  React.useEffect(() => {
    ctx?.register('error', id, on);
    return () => ctx?.register('error', id, false);
  }, [ctx, id, on]);

  if (!on) return null;

  return (
    <p
      id={id}
      role="alert"
      data-slot="field-error"
      className={cn('text-[var(--lg-destructive-fill)]', className)}
      style={{ fontSize: GEOMETRY.helpSize, marginTop: GEOMETRY.helpGap - GEOMETRY.labelGap }}
      {...props}
    >
      {children}
    </p>
  );
}

export { Field, FieldDescription, FieldError, GEOMETRY as FIELD_GEOMETRY };
