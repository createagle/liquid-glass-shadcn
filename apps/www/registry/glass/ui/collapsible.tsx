'use client';

// APPLE REFERENCE: macOS Disclosure Control（NSButton 的 disclosure 样式）
//
// 尺寸与配色来源：Apple Design Resources《macOS 27》Figma 文件
// （fileKey dRTOe4ObAK8UGqW9CBoJPM，节点 121:12048「Disclosure Button」，
// 样例区 483:4997 铺了五档尺寸）。记录见 docs/research/apple-metrics.md §11.1。
//
// ⚠️ **和 Checkbox 一样：这里没有玻璃，而且是照着 Apple 做的。**
//   三档状态 × 两个方向 × 明暗，一个模糊 / 折射 / 色散都没有。
//   清单第 29、30 行本来就标的「内容层」，这次实测把它坐实了。
//
// ── 实测值 ────────────────────────────────────────────────────────────
//
//   边长 / 圆角     16→4 · 20→5 · 24→6 · 28→圆 · 36→圆      [实测]
//   字形            SF Symbols chevron.down / .up，SF Pro Bold  [实测]
//   字号            16/20 档是 10；24 起是 13                  [实测]
//   底 · idle       亮 #000000@0.08 / 暗 #ffffff@0.07          [实测]
//   底 · 按下       0.16（明暗相同）                            [实测]
//   底 · 禁用       0.04（明暗相同）                            [实测]
//
// ⚠️⚠️ **圆角不是一个比例函数，是两段。**
//   16 / 20 / 24 三档恰好是「边长 ÷ 4」，28 起直接跳成正圆。
//   用一个比例硬套过去，28 那一档会得到 7 而不是圆 —— 那就不是 Apple 的样子了。
//
// ── 一处刻意的偏离 ────────────────────────────────────────────────────
//
//   **默认尺寸取 28（圆形），不是 macOS 最常见的 16。**
//   16pt 是指针尺寸；本库基准是 iOS，触屏上 16 太小。
//   28 是资源里**有实测**的档位中最小的圆形档，且配合 44×44 的命中区
//   （伪元素外扩，与 Checkbox / Switch 同一手法）看起来不至于突兀。
//   需要 macOS 观感时传 `size={16}`。
//
// ⚠️ 可信度：标 `[实测]` 而非 `[官方]`，前提同 §10 / §11。

import * as React from 'react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { cn } from '@/lib/utils';

/**
 * 五档尺寸 → 圆角。**查表，不是算出来的** —— 见文件头。
 * [实测] macOS 27 样例区 483:4997。
 */
const RADIUS_BY_SIZE: ReadonlyArray<readonly [size: number, radius: number]> = [
  [16, 4],
  [20, 5],
  [24, 6],
  [28, Number.POSITIVE_INFINITY],
  [36, Number.POSITIVE_INFINITY],
];

/** 几何 —— macOS 27 实测值。 */
const GEOMETRY = {
  /** 默认边长（px）。[实测] 28 是资源里最小的圆形档，见文件头的偏离说明 */
  size: 28,
  /** 小档（16/20）的字号（px）。[实测] 10 */
  glyphSizeSmall: 10,
  /** 大档（24 起）的字号（px）。[实测] 13 */
  glyphSizeLarge: 13,
  /** 字号切换的边长阈值（px）。[实测] —— 20 与 24 之间 */
  glyphBreakpoint: 24,
  /** 圆角变成正圆的边长阈值（px）。[实测] —— 24 与 28 之间 */
  circleBreakpoint: 28,
  /** 小档的圆角 / 边长之比。[实测] 4/16 = 5/20 = 6/24 */
  radiusRatio: 0.25,
  /** 最小触控目标（px）。HIG 44×44pt，[官方] */
  minTouch: 44,
  /** 触发器与标题的间距（px）。`[推定]` —— 资源里的样例是孤立控件，没有并排的标题 */
  gap: 8,
} as const;

/**
 * 人字形（chevron）。
 *
 * ⚠️⚠️ **资源里那是 SF Symbols 的 `chevron.down` / `chevron.up`，本库不能照搬。**
 *
 *   Figma 文件里存的是两个私有区码位（U+10018x 一带）。那些码位只有装了
 *   带 SF Symbols 的 SF Pro 才有字形 —— 换句话说在**绝大多数浏览器里是豆腐块**。
 *   一个组件库把自己的展开指示器押在「用户装了 Apple 的字体」上，是不能接受的。
 *
 *   所以这里自己画。**形状是 `[推定]`**：资源里它是文字不是矢量，
 *   没有路径可以逐点取（与 Checkbox 的对勾不同，那边真的有 vectorPaths）。
 *   只有「是个 chevron、朝下 / 朝上、随字号缩放」这几条是有依据的。
 *
 *   线宽 1.8 / 12 是照着 SF Pro Bold 的观感定的 —— **没有量过**。
 */
const CHEVRON = {
  /** 画布边长（px）。`[推定]` —— 只是个坐标系，字形按它缩放到实测的字号 */
  viewBox: 12,
  /** 折线三点，朝下。`[推定]` */
  path: 'M 2.6 4.6 L 6 8 L 9.4 4.6',
  /** 线宽（viewBox 单位）。`[推定]` —— 对应 SF Pro Bold 的观感 */
  strokeWidth: 1.8,
} as const;

/**
 * 求某个边长对应的圆角。
 *
 * ⚠️ 不要改成 `size * 0.25` —— 28 起是正圆，比例算法给不出来。
 */
function disclosureRadius(size: number): number {
  const exact = RADIUS_BY_SIZE.find(([s]) => s === size);
  if (exact) return exact[1];
  return size >= GEOMETRY.circleBreakpoint
    ? Number.POSITIVE_INFINITY
    : size * GEOMETRY.radiusRatio;
}

export interface GlassDisclosureIndicatorProps extends React.ComponentProps<'span'> {
  /** 边长（px）。默认 28。 */
  size?: number;
  /** 展开态 —— 字形从 chevron.down 换成 chevron.up。 */
  open?: boolean;
  /** 变灰。真正的 disabled 请传给外面那个可聚焦元素。 */
  disabled?: boolean;
}

/**
 * 圆形（或圆角方形）的展开指示器。
 *
 * ⚠️ **它自己不是按钮**，只是个 `<span>` —— 因为它总是被包在
 * `CollapsibleTrigger` / `AccordionTrigger` 里面，那两个才是真正的按钮。
 * 让它也成为 button 会得到嵌套按钮（无效 HTML + 键盘多一个停靠点），
 * 与 Tooltip 触发器那一处是同一类问题。
 */
function DisclosureIndicator({
  className,
  size = GEOMETRY.size,
  open = false,
  disabled = false,
  style,
  ...props
}: GlassDisclosureIndicatorProps) {
  const radius = disclosureRadius(size);
  const glyph = size >= GEOMETRY.glyphBreakpoint
    ? GEOMETRY.glyphSizeLarge
    : GEOMETRY.glyphSizeSmall;

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        'transition-colors duration-150',
        disabled
          ? 'bg-[var(--lg-disclosure-fill-disabled)] text-[var(--lg-label-tertiary)]'
          : 'bg-[var(--lg-disclosure-fill)] text-[var(--lg-label-primary)]',
        // 按下态由外层触发器的 :active 驱动 —— 指示器自己不接收指针事件
        !disabled && 'group-active/disclosure:bg-[var(--lg-disclosure-fill-pressed)]',
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: Number.isFinite(radius) ? radius : '9999px',
        ...style,
      }}
      {...props}
      data-slot="disclosure-indicator"
      data-state={open ? 'open' : 'closed'}
    >
      <svg
        width={glyph}
        height={glyph}
        viewBox={`0 0 ${CHEVRON.viewBox} ${CHEVRON.viewBox}`}
        fill="none"
        aria-hidden="true"
        // 展开态就是把朝下的人字翻过来 —— 与资源里换成 chevron.up 等价
        style={open ? { transform: 'rotate(180deg)' } : undefined}
      >
        <path
          d={CHEVRON.path}
          stroke="currentColor"
          strokeWidth={CHEVRON.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function Collapsible(props: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root {...props} data-slot="collapsible" />;
}

export interface GlassCollapsibleTriggerProps
  extends React.ComponentProps<typeof CollapsiblePrimitive.Trigger> {
  /** 指示器边长（px）。默认 28。 */
  indicatorSize?: number;
  /** 指示器放右边（默认放左边，与 macOS 一致）。 */
  indicatorSide?: 'start' | 'end';
}

/**
 * 触发器 —— **它自己就是那个按钮**，把标题放进去即可。
 *
 * ```tsx
 * <Collapsible>
 *   <CollapsibleTrigger>高级选项</CollapsibleTrigger>
 *   <CollapsibleContent>…</CollapsibleContent>
 * </Collapsible>
 * ```
 *
 * ⚠️ 与 Tooltip 触发器同一个理由：本库禁用 `asChild`，
 * 所以不要往里再塞一个 `<Button>` —— 那会得到嵌套按钮。
 */
function CollapsibleTrigger({
  className,
  children,
  indicatorSize = GEOMETRY.size,
  indicatorSide = 'start',
  style,
  ...props
}: GlassCollapsibleTriggerProps) {
  return (
    <CollapsiblePrimitive.Trigger
      className={cn(
        // group/disclosure：指示器靠它读按下态
        'group/disclosure relative inline-flex items-center outline-none',
        indicatorSide === 'end' && 'flex-row-reverse',
        // 标题字号 `[推定]` —— 资源里的 disclosure 是孤立控件，旁边没有标题可量
        'rounded-[8px] text-[17px] text-[var(--lg-label-primary)]',
        'disabled:cursor-default disabled:opacity-45',
        // 焦点环用外圈那条（3.5px，[实测] §10.4）；内圈 1px 会压在标题文字上
        'focus-visible:[box-shadow:0_0_0_3.5px_var(--lg-ring)]',
        // 命中区补到 44 高（指示器只有 28），视觉尺寸不变
        'before:absolute before:inset-x-0 before:top-1/2 before:h-(--lg-hit)',
        'before:-translate-y-1/2 before:content-[""]',
        className,
      )}
      style={{ gap: GEOMETRY.gap, ['--lg-hit' as string]: `${GEOMETRY.minTouch}px`, ...style }}
      {...props}
      data-slot="collapsible-trigger"
    >
      <DisclosureIndicatorSlot size={indicatorSize} disabled={props.disabled === true} />
      {children}
    </CollapsiblePrimitive.Trigger>
  );
}

/**
 * 从 `data-state` 读开合状态，不用再往下传一个 open。
 *
 * Radix 把 `data-state` 放在 Trigger 上，而指示器是 Trigger 的子元素 ——
 * 所以用 CSS 的 `group-data-[state=open]` 读它，比在 React 里同步一份状态可靠：
 * 受控 / 非受控两种用法都不用管。
 */
function DisclosureIndicatorSlot({ size, disabled }: { size: number; disabled: boolean }) {
  return (
    <>
      <DisclosureIndicator
        size={size}
        disabled={disabled}
        className="group-data-[state=open]/disclosure:hidden"
      />
      <DisclosureIndicator
        size={size}
        open
        disabled={disabled}
        className="hidden group-data-[state=open]/disclosure:inline-flex"
      />
    </>
  );
}

/**
 * 内容区。
 *
 * ⚠️ 高度动画走 CSS —— Radix 把内容高度写进 `--radix-collapsible-content-height`，
 * 动画本身定义在 optics.css（`.lg-collapsible-content`）。
 * **不用 motion**：Progress 那次的教训是 rAF 驱动的动画 Playwright 冻不住，
 * 快照会超时；纯 CSS keyframe 才能被 `toHaveScreenshot` 停下来。
 */
function CollapsibleContent({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Content>) {
  return (
    <CollapsiblePrimitive.Content
      className={cn('lg-collapsible-content overflow-hidden', className)}
      {...props}
      data-slot="collapsible-content"
    />
  );
}

export {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  DisclosureIndicator,
  disclosureRadius,
  GEOMETRY as COLLAPSIBLE_GEOMETRY,
};
