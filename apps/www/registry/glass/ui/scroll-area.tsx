'use client';

// APPLE REFERENCE: macOS 27 Scrollbar（节点 497:6481 竖 / 497:6567 横）
//                  + iOS 的滚动边缘效果（PROJECT_SPEC §13）
//
// 滚动条几何全部实测，记录见 docs/research/apple-metrics.md §11.2。
//
//   滑块厚度      6                     [实测]
//   滑块圆角      全圆（胶囊）           [实测]
//   滑块颜色      #000000 @ 0.50        [实测]
//   轨道槽宽      12（滑块两侧各内缩 3） [实测]
//   滑块最短      约 8                  [实测]（从三档样例反推，推理写在 §11.2）
//
// ⚠️ **没有暗色样例。** Scrollbar 页搜不到任何 Dark 节点，
//   所以暗色滑块颜色是 `[推定]`（把黑换成白、alpha 照搬）。
//
// ── 这个组件干两件事，别混起来看 ──────────────────────────────────────
//
//  1. **自定义滚动条**（上面那些实测值）—— 纯外观。
//  2. **滚动边缘效果**（§13 的硬性要求）—— 内容滚到栏下面时，
//     把**背景内容**模糊压暗，而不是把栏自己变实。
//     这一层直接复用 `@glass/core` 的 `useScrollEdge` / `GlassScrollEdge`，
//     那是 Phase 6 的 Hero 那批做的，不是这里新写的。
//
//   第 2 件默认**关着**（`edges={false}`）：它只有在「内容会滑到某条栏底下」
//   的场景里才有意义，普通的滚动容器加上去只是白白压暗两条边。
//
// ⚠️ 分层：**内容层。** 滚动条是覆盖在内容上的一层薄胶囊，
//   Apple 没给它任何材质；边缘效果那一层才有模糊，而那是 core 的事。

import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { GlassScrollEdge, useScrollEdge } from '@glass/core';
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /** 滑块厚度（px）。[实测] 6 */
  thumbSize: 6,
  /** 滑块两侧内缩（px）。[实测] 3 —— 槽宽 12 = 6 + 3×2 */
  inset: 3,
  /** 滑块最短长度（px）。[实测] 约 8，反推过程见 apple-metrics.md §11.2 */
  minThumbLength: 8,
  /** 边缘带的渐变距离（px）。`[推定]` —— 沿用 useScrollEdge 的默认值 */
  edgeDistance: 24,
  /** 边缘带高度（px）。`[推定]` —— core 的 72 是给整屏栏用的，容器里太厚 */
  edgeHeight: 40,
} as const;

export interface GlassScrollAreaProps
  extends React.ComponentProps<typeof ScrollAreaPrimitive.Root> {
  /** 横向也要滚动条。默认只有竖向。 */
  orientation?: 'vertical' | 'horizontal' | 'both';
  /**
   * 打开滚动边缘效果（PROJECT_SPEC §13）。默认 `false`。
   *
   * ⚠️ 只在「内容会滑到某条栏（工具栏 / 标签栏）底下」时才该打开。
   * 普通滚动容器打开它，只会白白把上下两条边压暗。
   */
  edges?: boolean;
  /**
   * 边缘带的高度（px）。默认 **40**。
   *
   * ⚠️ `GlassScrollEdge` 自己的默认是 72 —— 那是给**整屏**的栏用的。
   * 放进一个几百 px 高的滚动容器里，72 会盖掉快一半的可视区域
   * （实测：160px 高的容器里盖了 45%）。所以这里另给一个更小的默认值。
   * **40 是 `[推定]`**，与 core 那个 72 一样没有实测依据。
   */
  edgeHeight?: number;
}

/**
 * 滚动容器。
 *
 * ```tsx
 * <ScrollArea style={{ height: 200 }}>
 *   <div>很长的内容…</div>
 * </ScrollArea>
 * ```
 */
function ScrollArea({
  className,
  children,
  orientation = 'vertical',
  edges = false,
  edgeHeight = GEOMETRY.edgeHeight,
  /*
   * ⚠️ **默认改成 `scroll`，不是 Radix 的 `hover`。**
   *
   * macOS 的系统默认是「滚动时显示滚动条」（系统设置里那一项就叫这个），
   * `scroll` 才对得上。`hover` 是「指针进到区域里就显示」——
   * 触屏上根本没有 hover，那一档等于永远不显示。
   *
   * 顺带一提这也是可测性问题：`hover` 下滚动条**根本不进 DOM**，
   * 程序化滚动看不到它，写不了回归。
   */
  type = 'scroll',
  ...props
}: GlassScrollAreaProps) {
  /*
   * ⚠️ `scrollRef` 是 **callback ref**，不能改成 RefObject ——
   * 理由写在 @glass/core 的 scroll-edge.tsx 里（容器可能被整个换掉，
   * RefObject 的赋值不触发任何 effect，监听会留在已经离开文档的旧元素上）。
   */
  const { scrollRef, topRef, bottomRef } = useScrollEdge<HTMLDivElement>({
    distance: GEOMETRY.edgeDistance,
    disabled: !edges,
  });

  return (
    <ScrollAreaPrimitive.Root
      type={type}
      className={cn('relative overflow-hidden', className)}
      {...props}
      data-slot="scroll-area"
    >
      <ScrollAreaPrimitive.Viewport
        ref={scrollRef}
        className="size-full rounded-[inherit] outline-none focus-visible:[box-shadow:0_0_0_3.5px_var(--lg-ring)]"
        data-slot="scroll-area-viewport"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>

      {(orientation === 'vertical' || orientation === 'both') && (
        <ScrollBar orientation="vertical" />
      )}
      {(orientation === 'horizontal' || orientation === 'both') && (
        <ScrollBar orientation="horizontal" />
      )}
      <ScrollAreaPrimitive.Corner />

      {/*
       * 边缘带压在滚动条**上面**没有意义（滚动条本来就在最上层），
       * 但它必须压在内容上面 —— 所以放在 Viewport 之后、且 pointer-events: none
       * （GlassScrollEdge 自己就是不可点、不进无障碍树的）。
       */}
      {edges ? (
        <>
          <GlassScrollEdge ref={topRef} edge="top" height={edgeHeight} />
          <GlassScrollEdge ref={bottomRef} edge="bottom" height={edgeHeight} />
        </>
      ) : null}
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  const vertical = orientation === 'vertical';
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      orientation={orientation}
      className={cn(
        'flex touch-none select-none',
        // Radix 只在滚动/悬停时显示，淡入淡出交给它
        'transition-opacity duration-150',
        /*
         * ⚠️⚠️ **主轴方向不能搞反，搞反了滑块会被撑满整条轨道。**
         *
         * Radix 用内联样式给滑块设**次轴**上的尺寸
         * （竖向条设 height，横向条设 width），主轴那一维交给 `flex-1` 撑满。
         *
         *   竖向条 → 主轴**横向**（默认 flex-row）：flex-1 撑宽度，height 生效
         *   横向条 → 主轴**竖向**（flex-col）：      flex-1 撑高度，width 生效
         *
         * 第一版两个都写了 flex-col，结果竖向滑块的 `flex: 1 1 0%` 把
         * 内联 height 覆盖掉了 —— 量出来滑块高 154，正好是整条轨道，
         * 看上去就像「滚动条不会动」。
         */
        vertical ? 'h-full flex-row' : 'w-full flex-col',
        className,
      )}
      style={{
        // 槽宽 12 = 滑块 6 + 两侧各 3。[实测]
        [vertical ? 'width' : 'height']: GEOMETRY.thumbSize + GEOMETRY.inset * 2,
        padding: GEOMETRY.inset,
      }}
      {...props}
      data-slot="scroll-area-scrollbar"
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        className="relative flex-1 rounded-full bg-[var(--lg-scrollbar-thumb)]"
        style={{
          /*
           * Radix 的滑块长度由它自己算（按内容比例），这里只钉住**最短**。
           * [实测] 约 8 —— 再短就不成胶囊了（厚度就是 6）。
           */
          [vertical ? 'minHeight' : 'minWidth']: GEOMETRY.minThumbLength,
        }}
        data-slot="scroll-area-thumb"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar, GEOMETRY as SCROLL_AREA_GEOMETRY };
