'use client';

// APPLE REFERENCE: macOS tooltip（HIG "help tags"）
//
// ⚠️⚠️ **只有一句话，没有任何图。**
//
//   HIG 里能找到的全部就是：
//   > "the system displays a tooltip after people hover over a button"
//
//   iOS 27 设计资源里**没有 tooltip**（触屏上本来就没有 hover，
//   这是个 macOS / iPadOS 指针场景的东西）。所以：
//
//     · 几何（内边距、圆角、字号、箭头）  **全部 `[推定]`**
//     · 面板材质                        与 Popover 同源 —— 那边的几何有实测
//     · 出现时机（延迟、跟随）           交给 Radix，那是行为不是外观
//
//   下面凡是数字都逐条标注。**一个都不是量出来的。**
//
// 分层：component-inventory 标的是 **B**。本组件用 `elevated` ——
// 那是本库所有**浮层面板**（Popover / Dialog / DropdownMenu）统一用的那一档，
// 与 B 的差别只在底色略深一点点。让浮层之间彼此一致，比对齐清单里那个字母更重要，
// 这是一处**刻意的偏离**，写在这里。
//
// ⚠️ 触屏上 tooltip 是**不可达**的 —— 没有 hover 就永远不会出现。
//   所以：**tooltip 里的信息永远不能是唯一的信息来源**。
//   图标按钮该有 aria-label，破坏性操作该有确认文案，
//   tooltip 只能是「锦上添花」。这一条写进 registry 的 docs 字段了。

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { GlassSurface, transitionFor, useGlassOptional } from '@glass/core';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /** 左右内边距（px）。`[推定]` */
  paddingInline: 10,
  /** 上下内边距（px）。`[推定]` */
  paddingBlock: 6,
  /** 圆角（px）。`[推定]` —— 取圆角阶梯上的 8，浮层里最小的一档 */
  radius: 8,
  /** 字号（px）。`[推定]` —— 取排版阶梯里 footnote 那一档 */
  fontSize: 13,
  /** 与触发元素的距离（px）。`[推定]` */
  sideOffset: 6,
  /** 悬停多久才出现（ms）。`[推定]` */
  delayDuration: 400,
} as const;

/**
 * 必须包在应用（或局部子树）外面。
 *
 * `delayDuration` 提到 Provider 上是 Radix 的设计：同一组 tooltip 之间
 * 有「跳过延迟」的接力行为 —— 刚看过一个之后再指向旁边那个会立刻出现，
 * 而这个行为只有共享 Provider 才有。
 */
function TooltipProvider({
  delayDuration = GEOMETRY.delayDuration,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip(props: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

/**
 * 触发器 —— **它自己就是那个按钮**，不要再往里塞一个 `<Button>`。
 *
 * ⚠️ 这是本库禁用 `asChild` 带来的直接后果，值得说清楚。
 *
 *   shadcn 生态的惯用写法是 `<TooltipTrigger asChild><Button/></TooltipTrigger>`，
 *   而 `asChild` 在本库是被 lint 拦住的：`shadcn add` 在 base-* style 的工程里
 *   会把它改写成 Base UI 的 `render` prop，与 @radix-ui/react-* 不兼容
 *   （2026-09-01 由 Switch 在安装冒烟测试里真的撞出来过，见 STATUS §0.3）。
 *
 *   所以这里走的是本库既有的解法（与 `DialogClose` 同一个思路）：
 *   **把这一层封进来**，Radix 的 Trigger 直接渲染出唯一的那个 `<button>`，
 *   调用方把图标/文字放进去即可 —— 一个按钮，语义干净，键盘只有一个停靠点。
 *
 * ```tsx
 * <Tooltip>
 *   <TooltipTrigger aria-label="复制">⧉</TooltipTrigger>
 *   <TooltipContent>复制到剪贴板</TooltipContent>
 * </Tooltip>
 * ```
 *
 * 已知代价：拿不到本库 `<Button>` 的外观（variant / size 那一套）。
 * Button 没有把它的样式计算导出来，硬抄一份必然漂移 ——
 * 需要按钮外观时请自己传 className。**这是一处如实承认的能力缺口，不是疏忽。**
 */
function TooltipTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      className={cn(
        'inline-flex items-center justify-center rounded-full outline-none',
        // 焦点环必须在玻璃上清晰可见（PROJECT_SPEC §13）
        'focus-visible:ring-2 focus-visible:ring-[var(--lg-ring)]',
        className,
      )}
      {...props}
    />
  );
}

export interface GlassTooltipContentProps
  extends React.ComponentProps<typeof TooltipPrimitive.Content> {}

function TooltipContent({
  className,
  sideOffset = GEOMETRY.sideOffset,
  children,
  ...props
}: GlassTooltipContentProps) {
  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className="z-50 outline-none"
        {...props}
      >
        <motion.div
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          transition={transitionFor('snappy', reducedMotion)}
        >
          <GlassSurface
            layer="elevated"
            radius={GEOMETRY.radius}
            className={cn('max-w-[240px]', className)}
            /*
             * 内边距与字号走内联样式，不用工具类 —— `.lg-surface` 自己声明了
             * border-radius / color，工具类能不能盖住它取决于消费方的 CSS 层顺序。
             * 完整记录见 STATUS §0.63 的更正。
             */
            style={{
              paddingInline: GEOMETRY.paddingInline,
              paddingBlock: GEOMETRY.paddingBlock,
              fontSize: GEOMETRY.fontSize,
              color: 'var(--lg-label-primary)',
            }}
          >
            {children}
          </GlassSurface>
        </motion.div>
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent, GEOMETRY as TOOLTIP_GEOMETRY };
