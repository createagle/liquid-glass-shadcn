'use client';

// APPLE REFERENCE: UIMenu / SwiftUI `Menu`（弹出式菜单的底板）
//
// 尺寸来源：Apple Design Resources《iOS and iPadOS 27》Figma 文件
// （fileKey ojEQo0rKaQ5ioARo0CO0pf，节点 12740:24185 —— Edit Menu）。
// 参考图 screenshots/ios27-menu.png，完整测量见 apple-metrics.md §7.7。
//
//   面板宽            250 pt      [实测]
//   上下内边距        10 pt       [实测] —— 338 − 66 − 262 = 10，与顶部对称
//   左右内边距        16 pt       [实测] —— 菜单项 x=16 且宽 218（250 − 2×16）
//   菜单项高          40 pt       [实测]（带副标题的 60）
//   分隔区高          21 pt       [实测] —— 其中 1pt 线在区起点 +2，左右各内缩 24
//   Quick Actions 行  56 pt 高    [实测] —— 3 项各 72.67，间距 6
//
// ⚠️ 可信度：标 [实测] 而非 [官方]，理由同其他组件。
//
// ── 圆角：**没量出来，这里是推定值** ──────────────────────────────────
//
// 前几个组件的圆角都是从参考图轮廓拟合出来的（Card 26 / Sheet 34 / Alert 34，
// RMSE 都在 0.1–0.4 px）。菜单这次**失败了**，如实记录：
//
//   圆弧最小二乘        r = 20.5 ~ 25.5，RMSE **1.5 ~ 2.2 px**
//   自由超椭圆（r, n）   RMSE 降到 1.25，但 r 与 n 强烈互换：
//                       n=3 → r=29.4 · n=4 → r=37.6，两者 RMSE 一样
//
// 也就是说**半径不可辨识**。原因是这块面板是半透明玻璃压在中灰背景上，
// 边缘不是干净的两色台阶（外面还有落影、里面还有一道亮描边），
// 我那套「覆盖率求亚像素边界」的前提不成立。
//
// 圆弧拟合的落点集中在 **20–25**，`--lg-radius-lg`（22）正好在这个带里，
// 所以取它，并标 `[推定]`。**不要把它当实测值引用。**
//
// 顺带一个观察（不是结论）：残差呈系统性偏向 —— 小 dy 处实测比圆弧更贴边、
// 大 dy 处又拖得更远，这正是**连续曲率（squircle）**的特征。
// 组件因此开了 `continuous`；Chromium 148+ 会走原生 `corner-shape: squircle`。
//
// ── 分层 ──────────────────────────────────────────────────────────────
// PROJECT_SPEC §2：`| Select / Dropdown / Popover | 弹层面板 | 高亮项(hover/focus) |`
//
// 本组件只做**面板**那一半。`高亮项` 属于 Select / DropdownMenu ——
// Popover 里装的是任意内容，没有「项」这个概念，无处安放 Layer I。
// 那一半在下一批随 Select / DropdownMenu 落地。
//
// ── 移动端 ────────────────────────────────────────────────────────────
// SPEC §9 要求 Popover 这类「从触发点弹出的浮层」在移动端改成底部 Drawer。
// **本组件自己不做这件事** —— 那是 `<ResponsiveOverlay>` 的职责，
// 它会在紧凑视口下换渲染路径。直接用 Popover 就是永远的桌面行为。

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { motion } from 'motion/react';
import { GlassSurface, transitionFor, useGlassOptional } from '@glass/core';
import { cn } from '@/lib/utils';

export const GEOMETRY = {
  /** 面板默认宽。[实测] —— 这是 **Edit Menu** 的宽度，不是「所有浮层」的宽度 */
  width: 250,
  /** 上下内边距。[实测] */
  paddingBlock: 10,
  /** 左右内边距。[实测]（由菜单项的 x=16 / 宽 218 反推） */
  paddingInline: 16,
  /**
   * 圆角。**`[推定]`，不是实测** —— 拟合失败，理由见文件头。
   * 取值等于 `--lg-radius-lg`（22px），因为圆弧拟合的落点集中在 20–25。
   */
  radius: 22,
  /**
   * 与触发器的间距。`[推定]` —— 参考图里菜单与触发它的按钮不在同一帧，量不到。
   */
  sideOffset: 8,
} as const;

export interface GlassPopoverProps extends React.ComponentProps<typeof PopoverPrimitive.Root> {}

const Popover = PopoverPrimitive.Root;

/**
 * 触发器保持 Radix 原样（带好 aria 接线的原生 button）。
 * 与 Dialog / Sheet 同因：本库禁用 asChild，没法把任意元素提升成触发器。
 */
const PopoverTrigger = PopoverPrimitive.Trigger;

/** 需要把浮层锚在触发器以外的元素上时用它（Radix 原样透传）。 */
const PopoverAnchor = PopoverPrimitive.Anchor;

export interface GlassPopoverContentProps
  extends Omit<
    React.ComponentProps<typeof PopoverPrimitive.Content>,
    'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'
  > {
  /** 面板宽度（px）。默认 250 = iOS Edit Menu 的实测宽度。传 `null` 则由内容撑开。 */
  width?: number | null;
}

function PopoverContent({
  className,
  children,
  width = GEOMETRY.width,
  sideOffset = GEOMETRY.sideOffset,
  align = 'start',
  style,
  ...props
}: GlassPopoverContentProps) {
  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        sideOffset={sideOffset}
        align={align}
        className={cn('z-50 outline-none', className)}
        style={{ ...(width === null ? {} : { width }), ...style }}
        {...props}
      >
        <motion.div
          data-slot="popover-panel"
          // 从触发器那一侧「长出来」：Radix 把落位算好后写进
          // --radix-popover-content-transform-origin，这里只把缩放的原点对上它，
          // 不自己算坐标。变量在同一次绘制里就位，不会先播错方向的一帧。
          className="origin-[var(--radix-popover-content-transform-origin)]"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={transitionFor('snappy', reducedMotion)}
        >
          <GlassSurface
            layer="elevated"
            // 圆角是**推定值**，不是实测 —— 见文件头
            radius={GEOMETRY.radius}
            continuous
            style={{
              paddingBlock: GEOMETRY.paddingBlock,
              paddingInline: GEOMETRY.paddingInline,
            }}
          >
            {children}
          </GlassSurface>
        </motion.div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent };
