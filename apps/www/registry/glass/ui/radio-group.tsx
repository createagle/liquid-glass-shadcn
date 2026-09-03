'use client';

// APPLE REFERENCE: macOS NSButton radio（Liquid Glass 一代）
//
// 尺寸与配色来源：Apple Design Resources《macOS 27》Figma 文件
// （fileKey dRTOe4ObAK8UGqW9CBoJPM，节点 121:12141「Toggles - Radio Buttons」）。
// 18 个变体全部导出，记录见 docs/research/apple-metrics.md §10.2 / §10.3。
//
// ⚠️ **与 Checkbox 是同一份实测数据，除了形状与字形，其余逐条相同** ——
//   方框 16×16、间距 3、标签 SF Pro Medium 13/16、三档底色 0.10/0.19/0.05、
//   选中态实心强调色、禁用选中降到 45%。所以那边文件头里
//   「没有玻璃」「命中区撑到 44」「按下态明暗不对称」「强调色用 token」
//   四条**同样适用**，不在这里重复，去看 checkbox.tsx。
//
// ── 只属于 Radio 的两条 ───────────────────────────────────────────────
//
//   圆点        4.8 × 4.8 @ (5.6, 5.6)   [实测]（= 控件边长的 30%，正中）
//   组内行距    30（16 + 14）             [实测]（取自样例区的排布，不是规格）
//
// ── 一处**没有实现**的资源内容 ────────────────────────────────────────
//
//   资源里的 Radio 也有 `Selection=Mixed` 变体（画的是和 Checkbox 一样的横杠）。
//   **本库不实现。** 单选按钮不存在「部分选中」——
//   那是这份 kit 复用同一套变体矩阵的产物，不是 macOS 的真实状态。
//   如实记在 apple-metrics.md §10.2。
//
// ⚠️ 可信度：标 `[实测]` 而非 `[官方]`，前提同 checkbox.tsx。

import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { cn } from '@/lib/utils';

/** 几何 —— macOS 27 实测值，按控件边长成比例缩放。 */
const GEOMETRY = {
  /** 控件边长（px）。[实测] 16 */
  size: 16,
  /** 圆点直径 / 控件边长之比。[实测] 4.8 / 16 */
  dotRatio: 4.8 / 16,
  /** 控件与标签的间距（px）。[实测] 3 */
  gap: 3,
  /** 组内相邻两项的间距（px）。[实测] 14（样例区行距 30 − 控件 16） */
  itemGap: 14,
  /** 标签字号（px）。[实测] 13 */
  labelSize: 13,
  /** 标签行高（px）。[实测] 16 */
  labelLineHeight: 16,
  /** 最小触控目标（px）。HIG 44×44pt，[官方] */
  minTouch: 44,
  /** 焦点环：形状内的实边宽（px）。[实测] macOS INNER_SHADOW spread 1 */
  focusInner: 1,
  /** 焦点环：形状外的实边宽（px）。[实测] macOS DROP_SHADOW spread 3.5 */
  focusOuter: 3.5,
} as const;

export interface GlassRadioGroupProps
  extends React.ComponentProps<typeof RadioGroupPrimitive.Root> {
  /** 相邻两项的间距（px）。默认 14。 */
  itemGap?: number;
}

/**
 * 单选组。
 *
 * ```tsx
 * <RadioGroup defaultValue="a" aria-label="配送方式">
 *   <RadioGroupItem value="a">标准配送</RadioGroupItem>
 *   <RadioGroupItem value="b">次日达</RadioGroupItem>
 * </RadioGroup>
 * ```
 *
 * ⚠️ 组本身**必须**有名字（`aria-label` / `aria-labelledby`）——
 * Radix 渲染的是 `role="radiogroup"`，没有名字时屏幕阅读器只会读出「单选组」。
 */
/** 方向键 —— 与 Radix 的 RovingFocusGroup 认的是同一组 */
const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

function RadioGroup({
  className,
  itemGap = GEOMETRY.itemGap,
  style,
  onKeyDown,
  onFocus,
  onPointerDown,
  ...props
}: GlassRadioGroupProps) {
  /**
   * ⚠️⚠️ **补 Radix 的一个缺口：方向键移动焦点之后没有选中。**
   *
   * ARIA APG 对 radiogroup 的要求是「选中状态随焦点移动」。
   * Radix 也是这么设计的 —— `RadioGroupItemTrigger` 的 `onFocus` 里写着
   * `if (isArrowKeyPressedRef.current) ref.current?.click()`。
   *
   * 但在本工程里（@radix-ui/react-radio-group 1.4.7 + React 19）**它不生效**。
   * 实测（2026-09-03，Playwright + Chromium）：
   *
   *   ArrowDown → 焦点确实移到了下一项（roving tabindex 也跟着变），
   *               但 aria-checked **一个都没变**，且那一项完全没收到 click。
   *
   * 排查过程记着，免得下次有人重走：
   *   · 事件顺序不是原因 —— 打点看到 `document` 的 keydown **早于** focusin，
   *     也就是 Radix 那个标志位在 onFocus 跑的时候确实已经是 true；
   *   · 不是本库这层 `<label>` 包裹的锅 —— 专门加了一组**无标签**的对照
   *     （验证台里的 `rg-bare`），表现完全一样。
   *
   * 所以这是上游在这个版本组合下的行为，不是本库引入的。
   * 但「键盘用户选不中」是实打实的无障碍缺陷，不能以「行为归 Radix 管」为由放着。
   *
   * 补法用的正是 Radix 自己想做的那件事：**点一下刚拿到焦点的那一项**。
   * 走 click 而不是自己改 value，是为了对受控 / 非受控两种用法都成立。
   *
   * ── 两处试错，都记着，免得下次重走 ──────────────────────────────────
   *
   * 1. 第一版在 keydown 里写了 `if (event.defaultPrevented) return`，整段成了死代码。
   *    插桩量出来：进到本处理器时 `defaultPrevented` **已经是 true** ——
   *    Radix 的 Slot 合并顺序是「先 slot 后 child」，RovingFocusGroup 的
   *    keydown 排在前面，而它对方向键一律 preventDefault（挡页面滚动）。
   *    在这个位置上那个标志位恒为 true，不携带任何信息。
   *
   * 2. 第二版改成 keydown 里 `requestAnimationFrame` 之后读 `document.activeElement`。
   *    也不行：量出来那一帧焦点**还停在原来那一项**上 ——
   *    RovingFocusGroup 移动焦点比一帧更晚。
   *
   * 所以最终不猜时机，**改成监听焦点事件本身**：方向键按下时置一个标志位，
   * 焦点真正落到某一项上时再消费它。这也正是 Radix 原本的结构，
   * 只是标志位由本组件在对的时刻置位。
   *
   * 幂等性：只在那一项 `aria-checked === "false"` 时才点。
   * 将来上游修好了，这里会因为已经是 checked 而自动不动手，不会双触发。
   */
  const arrowPressed = React.useRef(false);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      arrowPressed.current = ARROW_KEYS.includes(event.key);
    },
    [onKeyDown],
  );

  /** 指针操作绝不该触发「移动即选中」—— 点哪儿是哪儿，交给 click 本身 */
  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      onPointerDown?.(event);
      arrowPressed.current = false;
    },
    [onPointerDown],
  );

  const handleFocus = React.useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      onFocus?.(event);
      if (!arrowPressed.current) return;
      arrowPressed.current = false; // 一次按键只补一次
      const item = event.target;
      if (!(item instanceof HTMLElement)) return;
      if (item.dataset.slot !== 'radio-group-item') return;
      if (item.getAttribute('aria-checked') !== 'false') return;
      if (item.hasAttribute('disabled')) return;
      item.click();
    },
    [onFocus],
  );

  return (
    <RadioGroupPrimitive.Root
      className={cn('flex flex-col', className)}
      style={{ gap: itemGap, ...style }}
      {...props}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onPointerDown={handlePointerDown}
      // ⚠️ 写在 {...props} 之后 —— 理由见 checkbox.tsx 同一处注释
      data-slot="radio-group"
    />
  );
}

export interface GlassRadioGroupItemProps
  extends Omit<React.ComponentProps<typeof RadioGroupPrimitive.Item>, 'children'> {
  /** 控件边长（px）。默认 16。 */
  size?: number;
  /**
   * 标签。传了就把控件包进 `<label>` —— 点标签也能选中。
   *
   * ⚠️ 不传标签时**必须**自己给 `aria-label` 或 `aria-labelledby`，
   * 理由与 Checkbox 相同：根节点是个没有文字内容的 `<button role="radio">`。
   */
  children?: React.ReactNode;
}

function RadioGroupItem({
  className,
  size = GEOMETRY.size,
  children,
  ...props
}: GlassRadioGroupItemProps) {
  const k = size / GEOMETRY.size;
  const hit = Math.max(GEOMETRY.minTouch, size);
  const disabled = props.disabled === true;

  // 与 Checkbox 同因：<button> 不从包着它的 <label> 取无障碍名
  const labelId = React.useId();
  const hasOwnName = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined;
  const nameProps = children !== undefined && !hasOwnName ? { 'aria-labelledby': labelId } : {};

  const dot = (
    <RadioGroupPrimitive.Item
      className={cn(
        'group relative inline-flex shrink-0 items-center justify-center rounded-full outline-none',
        'transition-[background-color,box-shadow] duration-150',
        'bg-[var(--lg-toggle-fill)]',
        'data-[state=unchecked]:active:not-disabled:bg-[var(--lg-toggle-fill-pressed)]',
        'data-[state=unchecked]:disabled:bg-[var(--lg-toggle-fill-disabled)]',
        'data-[state=checked]:bg-[var(--lg-accent-fill)]',
        'data-[state=checked]:active:not-disabled:bg-[color-mix(in_srgb,var(--lg-accent-fill),black_18%)]',
        // 只有选中态整体降 45%；未选中的禁用是换底色，见 checkbox.tsx
        'data-[state=checked]:disabled:opacity-45',
        'disabled:cursor-default',
        'focus-visible:[box-shadow:var(--lg-radio-ring)]',
        'before:absolute before:top-1/2 before:left-1/2 before:size-(--lg-hit)',
        'before:-translate-x-1/2 before:-translate-y-1/2 before:content-[""]',
        className,
      )}
      style={{
        width: size,
        height: size,
        ['--lg-hit' as string]: `${hit}px`,
        ['--lg-radio-ring' as string]:
          `inset 0 0 0 ${GEOMETRY.focusInner}px var(--lg-ring), 0 0 0 ${GEOMETRY.focusOuter}px var(--lg-ring)`,
      }}
      {...props}
      {...nameProps}
      // ⚠️ 写在 {...props} 之后 —— 理由见 checkbox.tsx
      data-slot="radio-group-item"
    >
      {/* forceMount：圆点常驻，只切换不透明度，避免状态切换时重排 */}
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        forceMount
        className={cn(
          'block rounded-full bg-[var(--lg-on-accent)]',
          'opacity-0 transition-opacity duration-100 group-data-[state=checked]:opacity-100',
        )}
        style={{ width: size * GEOMETRY.dotRatio, height: size * GEOMETRY.dotRatio }}
      />
    </RadioGroupPrimitive.Item>
  );

  if (children === undefined) return dot;

  return (
    <label
      data-slot="radio-group-label"
      data-disabled={disabled ? 'true' : undefined}
      className={cn('inline-flex items-start', disabled ? 'cursor-default' : 'cursor-pointer')}
      style={{ gap: GEOMETRY.gap * k }}
    >
      {dot}
      <span
        id={labelId}
        className={cn(
          'select-none',
          // [实测] 禁用标签 #000000@0.25；token 阶梯上最近的是 tertiary（0.3）
          disabled ? 'text-[var(--lg-label-tertiary)]' : 'text-[var(--lg-label-primary)]',
        )}
        style={{
          fontSize: GEOMETRY.labelSize * k,
          lineHeight: `${GEOMETRY.labelLineHeight * k}px`,
        }}
      >
        {children}
      </span>
    </label>
  );
}

export { RadioGroup, RadioGroupItem, GEOMETRY as RADIO_GROUP_GEOMETRY };
