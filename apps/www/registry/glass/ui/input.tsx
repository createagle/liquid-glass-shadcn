'use client';

// APPLE REFERENCE: UITextField（iOS 26+ Liquid Glass）
//
// 尺寸来源：Apple Design Resources《iOS and iPadOS 27》Figma 文件
// （fileKey ojEQo0rKaQ5ioARo0CO0pf，节点 12740:33850 —— 一个四行文本框的 Grouped List）。
// 逐像素测量脚本：scripts/measure-textfield.mjs，记录见 apple-metrics.md §8.3。
//
//   行高                52 pt                     [实测]
//   文字左内缩           16 pt                     [实测]
//   分隔线              1 pt，两侧各内缩 16        [实测]
//   分隔线色            #e6e6e6（压白底）          [实测]
//   值颜色              #000000                   [实测]
//   占位符颜色           #c5c5c7                   [实测]
//   光标                2 × 23 pt，#0088ff        [实测]
//   清除按钮             18 × 18 pt，右内缩 17      [实测]
//
// ⚠️⚠️ **这张参考图最重要的结论是：iOS 的表单文本框没有自己的框。**
//
//   没有描边、没有填充、**没有玻璃** —— 它就是分组列表里的一行，
//   行与行之间靠 1pt 分隔线分开。四行（占位符 / 聚焦空态 / 有值 / 未聚焦有值）
//   在图里从头到尾都没有出现任何属于输入框自己的边界。
//
//   所以 docs/research/component-inventory.md 把 Input 标成
//   「**B**（iOS 26 输入框是玻璃控件）」，在**表单场景里是错的**。
//   玻璃输入框确实存在，但那是**搜索栏**那个场景，不是表单行。
//   —— 这一条需要修订 inventory，已记在 STATUS。
//
//   本组件因此提供两个 variant，而且把哪个有依据说清楚：
//     list   ← 上表那个，**有实测依据**。放进 <Card> 里就是 iOS 表单。
//     field  ← 独立成框的那个，shadcn 用户期待的形态。
//              **没有任何 Apple 参考**，几何全部 `[推定]`，下面逐条标注。
//
// ⚠️ 刻意偏离 Apple 之处：**占位符颜色**。
//   实测 #c5c5c7 压在白底上只有 **1.72:1** —— 连大字的 3:1 都够不到，
//   离 PROJECT_SPEC §13 要求的正文 4.5:1 差得很远。
//   本库改用 `--lg-label-secondary`（已被 1512 次采样的对比度审计覆盖）。
//   这是一处**明知故犯的不还原**：可读性地板是不可协商的（§13），
//   而占位符是文本。实测值原样留在上表，不抹掉。
//
// ⚠️ 可信度说明：上表标 [实测] 而非 [官方]，因为
//   (a) 该文件是 iOS 27，PROJECT_SPEC 的基准是 iOS 26；
//   (b) 文件标题带 "(Community)"，发布者是否为 Apple 未经验证。

import * as React from 'react';
import { GlassSurface } from '@glass/core';
import { cn } from '@/lib/utils';
import { useFieldControl } from '@/components/ui/field';

/** 几何。list 一列有实测依据，field 一列没有 —— 逐条标注，不混为一谈。 */
const GEOMETRY = {
  /** list：行高。[实测] 52pt */
  listHeight: 52,
  /** list：文字左内缩。[实测] 16pt —— 但放进 Card 时由 CardRow 提供，这里只在独立用时补 */
  listInset: 16,
  /** field：高度。`[推定]` —— 无参考。取 HIG 的 44×44pt 最小触控目标（[官方]）作下限 */
  fieldHeight: 44,
  /** field：左右内边距 / 高度之比。`[推定]` —— 借用 Button 实测的 0.25（见 button.tsx） */
  fieldPaddingRatio: 0.25,
  /** 标签字号。[实测] 17pt —— 与 Alert、Grouped List 行标签同一字号 */
  fontSize: 17,
  /** 清除按钮边长。[实测] 18pt */
  clearSize: 18,
  /** 清除按钮右内缩。[实测] 17pt */
  clearInset: 17,
  /** 光标宽。[实测] 2pt */
  caretWidth: 2,
} as const;

export type GlassInputVariant = 'field' | 'list';

type NativeInputProps = Omit<React.ComponentProps<'input'>, 'size'>;

export interface GlassInputProps extends NativeInputProps {
  /**
   * `field` 默认。独立成框，Layer B 磨砂玻璃胶囊。**无 Apple 参考，几何是推定的。**
   * `list`  iOS 表单里的那一行：**不画任何框**，交给外层 `<Card>` / `<CardRow>`。
   *         这一个才有实测依据。
   */
  variant?: GlassInputVariant;
  /** 控件高度（px）。默认按 variant 取 44 / 52。 */
  height?: number;
  /**
   * 有值时在右侧显示清除按钮，对应 iOS 的 `clearButtonMode`。
   *
   * 受控与非受控都支持 —— 组件自己镜像一份「当前是否有值」，
   * 因为原生 input 不会在 value 变化时广播事件给外部。
   */
  clearable?: boolean;
  /** 点清除按钮时触发。不传就只清空并发一次 change。 */
  onClear?: () => void;
}

function Input({
  className,
  variant = 'field',
  height,
  clearable = false,
  onClear,
  style,
  value,
  defaultValue,
  onChange,
  disabled,
  id: idProp,
  'aria-describedby': describedByProp,
  'aria-invalid': invalidProp,
  ref: refProp,
  ...props
}: GlassInputProps) {
  const h = height ?? (variant === 'list' ? GEOMETRY.listHeight : GEOMETRY.fieldHeight);
  const inset = Math.round(GEOMETRY.fieldPaddingRatio * h);

  /**
   * 与 <Field> 的连线。不在 Field 里用时 `useFieldControl` 返回空对象，
   * 组件照常工作 —— Input 不强制依赖 Field。
   */
  const field = useFieldControl();
  const id = idProp ?? field.id;
  const describedBy = describedByProp ?? field.describedBy;
  const invalid = invalidProp ?? field.invalid;

  const innerRef = React.useRef<HTMLInputElement>(null);
  const setRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      innerRef.current = node;
      if (typeof refProp === 'function') refProp(node);
      else if (refProp) (refProp as React.RefObject<HTMLInputElement | null>).current = node;
    },
    [refProp],
  );

  /**
   * 「当前有没有值」是清除按钮的唯一显示条件。
   * 受控时直接看 value；非受控时只能自己镜像 —— 原生 input 的内部值改变
   * 不会通知 React，`defaultValue` 之后的每一次输入都只走 onChange。
   */
  const controlled = value !== undefined;
  const [hasValueUncontrolled, setHasValueUncontrolled] = React.useState(
    () => String(defaultValue ?? '').length > 0,
  );
  const hasValue = controlled ? String(value ?? '').length > 0 : hasValueUncontrolled;
  const showClear = clearable && hasValue && !disabled;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!controlled) setHasValueUncontrolled(e.currentTarget.value.length > 0);
    onChange?.(e);
  };

  /**
   * 清空。
   *
   * ⚠️ 不能只写 `node.value = ''` —— React 给 input 的 value 属性装了自己的
   * setter，直接赋值不会触发 React 的合成 change 事件，受控组件的状态不会更新，
   * 下一次渲染又把旧值写回来。必须走原型上的原生 setter 再手动派发 input 事件。
   * （这也是 Playwright 里给 range input 赋值时踩过的同一个坑。）
   */
  const handleClear = () => {
    const node = innerRef.current;
    if (node) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(node, '');
      node.dispatchEvent(new Event('input', { bubbles: true }));
      node.focus();
    }
    if (!controlled) setHasValueUncontrolled(false);
    onClear?.();
  };

  const inputEl = (
    <input
      ref={setRef}
      id={id}
      data-slot="input"
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn(
        'peer h-full min-w-0 flex-1 bg-transparent outline-none',
        'placeholder:text-[var(--lg-label-secondary)]',
        'disabled:cursor-not-allowed disabled:opacity-40',
        // 文件选择器按钮不该继承输入框的字号
        'file:text-[15px] file:font-medium',
        variant === 'list' && 'px-0',
      )}
      style={{
        fontSize: GEOMETRY.fontSize,
        color: 'var(--lg-label-primary)',
        // 光标实测 #0088ff —— 现在 --lg-blue 就是这个值（改动见 primitive.css）。
        // 用 --lg-blue 而不是 --lg-accent-fill：accent-fill 是为了让白字过 AA
        // 压深过的（#0075da），光标不是文本，不需要那次压深。
        caretColor: 'var(--lg-blue)',
        caretShape: 'bar',
      }}
      {...(controlled ? { value } : { defaultValue })}
      onChange={handleChange}
      {...props}
    />
  );

  const clearEl = showClear ? (
    <button
      type="button"
      data-slot="input-clear"
      /**
       * ⚠️ `tabIndex={-1}` 是刻意的，与 Safari 原生 clear button 一致。
       * 键盘用户清空输入框用的是 ⌘A / Ctrl+A 再删除，不需要多一个 Tab 停靠点 ——
       * 表单里每个输入框都多一站会让 Tab 顺序变得很难用。
       * 仍然保留 aria-label，指针与辅助技术的直接点击照常可用。
       */
      tabIndex={-1}
      aria-label="清除"
      onClick={handleClear}
      className="shrink-0 rounded-full transition-opacity hover:opacity-70"
      style={{
        width: GEOMETRY.clearSize,
        height: GEOMETRY.clearSize,
        /*
         * 圆底实测 #c5c5c7。反解一下：`--lg-label-tertiary` 是 rgb(60 60 67 / .3)，
         * 压在白底上 = 255 − 0.3 × (255 − 60) = 196.5 → #c4c4c5，
         * 与实测值只差 1/255。**不新造 token，直接用它**，而且这个吻合度
         * 反过来印证了 label-tertiary 的取值本身是对的。
         * （fill 家族最浓的一档才 0.2，压出来 #d8d8d9，明显偏浅。）
         */
        background: 'var(--lg-label-tertiary)',
        color: 'var(--lg-label-primary)',
      }}
    >
      {/* ×：两条对角线。18pt 的圆里画 8pt 的叉，比例照实测图目测，`[推定]` */}
      <svg viewBox="0 0 18 18" width={GEOMETRY.clearSize} height={GEOMETRY.clearSize} aria-hidden="true">
        <path
          d="M5.8 5.8 L12.2 12.2 M12.2 5.8 L5.8 12.2"
          stroke="var(--lg-card-fill)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </button>
  ) : null;

  /* ── list：不画框。行的几何由 <CardRow> 提供，这里只保证高度与字号。 ── */
  if (variant === 'list') {
    return (
      <div
        data-slot="input-wrapper"
        data-variant="list"
        className={cn('flex w-full items-center gap-2', className)}
        style={{ minHeight: h, ...style }}
      >
        {inputEl}
        {clearEl}
      </div>
    );
  }

  /* ── field：Layer B 磨砂胶囊。**无实测依据**，几何见 GEOMETRY 的标注。 ── */
  return (
    <GlassSurface
      layer="base"
      radius={h / 2}
      className={cn(
        'flex w-full items-center gap-2',
        // 焦点环必须在玻璃上清晰可见（PROJECT_SPEC §13）。
        // 用 :has 而不是包一层 focus-within 类：环要长在玻璃这一层，
        // 而拿到焦点的是里面那个 input。
        'has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-[var(--lg-ring)]',
        'has-[input:disabled]:opacity-60',
        className,
      )}
      style={{
        height: h,
        paddingInline: inset,
        // aria-invalid 时换成红色描边 —— 不只靠颜色，Field 那边同时给出文字错误
        ...(invalid ? { boxShadow: 'inset 0 0 0 1.5px var(--lg-destructive-fill)' } : {}),
        ...style,
      }}
    >
      {inputEl}
      {clearEl}
    </GlassSurface>
  );
}

export { Input, GEOMETRY as INPUT_GEOMETRY };
