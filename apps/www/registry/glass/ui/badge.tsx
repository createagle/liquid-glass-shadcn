'use client';

// APPLE REFERENCE: 无直接对应
//
// ⚠️ **Badge 不是一个 Apple 控件。** iOS 上最接近的两样东西是：
//   · 通知角标（红底白字的数字，贴在 App 图标或 tab 上）
//   · 分组列表行右侧的附件文字（"Not Connected"、"已打开"）—— 那是纯文本，不是徽章
//
// 资源里没有 Badge 组件页，也没有可量的样例。**本组件的几何全部 `[推定]`**，
// 字号沿用排版阶梯（apple-metrics §7.6 的 13pt = SF footnote，那一档是 [实测]）。
//
// ── 分层：内容层，**明确不用玻璃**。理由被实测改写过一次 ─────────────
//
// component-inventory 原本给的理由是「小尺寸玻璃看不出效果」。
// 本库把这句话**量了**（`node scripts/small-glass.mjs`，同尺寸同背景只开关折射），
// 结果**不支持它**：
//
//     徽章尺寸 44×20    条纹背景 meanΔ 19.5/255   渐变背景 meanΔ 2.8/255   差 6.9 倍
//     指示器   229×104  条纹背景 meanΔ 93.9/255   渐变背景 meanΔ 2.8/255   差 33.5 倍
//     尺寸放大作用      条纹 10.3 倍              渐变只有 1.8 倍
//
// 也就是说：**35×16 那么小的一块玻璃压在条纹上照样看得出在扭**。
// 「小」并不等于「看不见」—— 真正的变量是**背景里有没有高频内容**，
// 尺寸只是放大器。
//
// 结论（内容层）没变，但理由换成站得住的那个：
//   1) 徽章通常压在**页面底色或卡片**上，那是平滑的，折射几乎无从发挥（meanΔ 2.8）；
//   2) §5.2 的同屏折射预算只有 8 个（`[推定]`），
//      把名额花在一个大概率看不出差别的地方，收益为负。

import * as React from 'react';
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /** 字号（px）。[实测] 13pt —— SF footnote，与本库其他辅助文字同一档 */
  fontSize: 13,
  /** 左右内边距（px）。`[推定]` */
  paddingInline: 8,
  /** 最小高度（px）。`[推定]` */
  minHeight: 20,
} as const;

/**
 * `count`       通知角标：红底白字，胶囊。这是唯一有 iOS 对应物的一个。
 * `neutral`     中性填充，用在「状态」这类不需要强调的地方。
 * `accent`      主色填充。
 * `outline`     只有描边，压在复杂背景上比填充更轻。
 *
 * ⚠️ 刻意**没有** `glass` 变体，理由见文件头 —— 那个尺寸下它什么也做不到。
 */
export type GlassBadgeVariant = 'count' | 'neutral' | 'accent' | 'outline';

export interface GlassBadgeProps extends React.ComponentProps<'span'> {
  variant?: GlassBadgeVariant;
}

/**
 * 四个变体的配色。全部走 token，一个裸色值都没有（§15.4）。
 *
 * `count` 与 `accent` 的前景用 `--lg-on-*`：那是本库为了让白字压在实色上
 * 也能过 AA 而**推导**出来的一组色（见 legibility.ts 的 deriveOnGlassLabel），
 * 不是随手写的白。
 */
const VARIANTS: Record<GlassBadgeVariant, React.CSSProperties> = {
  count: { background: 'var(--lg-destructive-fill)', color: 'var(--lg-on-destructive)' },
  neutral: { background: 'var(--lg-fill-secondary)', color: 'var(--lg-label-primary)' },
  accent: { background: 'var(--lg-accent-fill)', color: 'var(--lg-on-accent)' },
  outline: {
    background: 'transparent',
    color: 'var(--lg-label-primary)',
    boxShadow: 'inset 0 0 0 1px var(--lg-separator-opaque)',
  },
};

function Badge({ className, variant = 'neutral', style, ...props }: GlassBadgeProps) {
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      className={cn(
        'inline-flex items-center justify-center gap-1 font-semibold whitespace-nowrap',
        // 胶囊：徽章总是比它高的那一半还圆，直接用足够大的半径
        'rounded-full',
        className,
      )}
      style={{
        fontSize: GEOMETRY.fontSize,
        minHeight: GEOMETRY.minHeight,
        paddingInline: GEOMETRY.paddingInline,
        ...VARIANTS[variant],
        ...style,
      }}
      {...props}
    />
  );
}

export { Badge, GEOMETRY as BADGE_GEOMETRY };
