'use client';

// APPLE REFERENCE: 无
//
// ⚠️ **Apple 没有骨架屏这个东西。** iOS 的加载态是转菊花（UIActivityIndicatorView）
// 或者直接显示占位内容，HIG 里也找不到 skeleton / shimmer 的说法。
// 所以本组件**没有任何 Apple 依据**，几何与动效全部 `[推定]`，
// 它存在的理由只是 shadcn 生态里它很常用。
//
// 分层：**内容层**。骨架屏是「内容还没到」的占位，给它加玻璃在语义上就是错的 ——
// 材质属于控件层（PROJECT_SPEC §2），而这块地方将来要放的是内容，不是控件。
//
// ⚠️ `prefers-reduced-motion` 下**完全静止**。
//   闪烁的骨架屏是前庭不适的经典诱因，而它传达的信息（"这里在加载"）
//   完全可以由静止的灰块 + `aria-busy` 承担，不需要动。

import * as React from 'react';
import { useGlassOptional } from '@createagle/glass-core';
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /** 圆角（px）。`[推定]` —— 取圆角阶梯上最小的一档 */
  radius: 8,
  /** 微光扫过一次的时长（ms）。`[推定]` */
  shimmerDuration: 1600,
} as const;

export interface GlassSkeletonProps extends React.ComponentProps<'div'> {}

function Skeleton({ className, style, ...props }: GlassSkeletonProps) {
  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;

  return (
    <div
      data-slot="skeleton"
      /**
       * `aria-hidden` + 外层容器的 `aria-busy` 才是正确的分工：
       * 骨架块本身对屏幕阅读器是**噪音**（一堆没有内容的方块），
       * 而「正在加载」这件事应该由它所替代的那个区域来报。
       * 所以这里把自己藏起来，并在文档里要求调用方给容器加 aria-busy。
       */
      aria-hidden="true"
      data-animated={reducedMotion ? undefined : 'true'}
      className={cn('relative overflow-hidden', className)}
      style={{
        borderRadius: GEOMETRY.radius,
        background: 'var(--lg-fill-tertiary)',
        ...style,
      }}
      {...props}
    >
      {!reducedMotion ? (
        <span
          aria-hidden="true"
          data-slot="skeleton-shimmer"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, var(--lg-fill-quaternary) 50%, transparent 100%)',
            /*
             * 用 CSS 动画而不是 motion：这是一条**永不停止**的循环，
             * 交给合成器跑比每帧过一次 React/motion 便宜得多，
             * 而骨架屏往往同屏几十个。
             *
             * 关键帧 `lg-skeleton-shimmer` 在 @glass/theme 里（optics.css）。
             * 第一版把它内联成 <style> 写在组件内部，那样每个实例都会在 DOM 里
             * 复制一份同样的关键帧 —— 而组件本来就离不开 theme.css 的 token，
             * 多依赖一个关键帧不增加任何新的耦合。
             */
            animation: `lg-skeleton-shimmer ${GEOMETRY.shimmerDuration}ms linear infinite`,
          }}
        />
      ) : null}
    </div>
  );
}

export { Skeleton, GEOMETRY as SKELETON_GEOMETRY };
