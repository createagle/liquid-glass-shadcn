'use client';

// APPLE REFERENCE: grouped list section
//   （UICollectionLayoutListConfiguration `.insetGrouped` / SwiftUI `List` + `.listStyle(.insetGrouped)`）
//
// PROJECT_SPEC §10 的 P0 清单把 Card 的 Apple 对应物写死为 **grouped list section**，
// 不是「一个圆角盒子」。下面的数值全部量自 iOS 27 资源里的两块 Grouped List：
//
//   节点 12740:33850（4 行 Text Field）  → screenshots/ios27-list-screen.png
//   节点 12740:33923（2 行 Switch）      → screenshots/ios27-grouped-list-rows.png
//
//   区块宽          370 pt      [实测] —— 402 的屏减两侧各 16
//   区块圆角        26 pt       [实测] —— 见下方「圆角是怎么定的」
//   行高            52 pt       [实测] —— 两块列表、三种行类型（文本框 / 开关 / 滑杆）全是 52
//   行内左右内缩    16 pt       [实测] —— 行内容框 x=16 width=338，370−16−338=16，两侧对称
//   分隔线          1 pt        [实测] —— 压在白底上是 #e6e6e6，两侧各内缩 16（宽 338）
//   区块底色        #ffffff     [实测] —— alpha 通道 255，**完全不透明**
//   页面底色        #f2f2f7     [实测] —— 与既有 --lg-gray-6-light 逐位相同
//   行标签          17 pt       [实测] —— 墨迹高 13px，与 Alert 的标题/正文同一字号
//
// ⚠️ 可信度：标 [实测] 而非 [官方]，理由同其他组件 ——
//    (a) 文件是 iOS 27，PROJECT_SPEC 的基准是 iOS 26；(b) 文件标题带 "(Community)"。
//    暗色的三个颜色 token **没有实测**（资源里没找到暗色版），见 semantic.css 的标注。
//
// ── 圆角是怎么定的 ────────────────────────────────────────────────────
//
// 不是目测，也不是从 HIG 抄的（HIG 只说「Sections have an increased corner radius」，
// 没给数）。做法与 Dialog 一样：沿区块左缘按覆盖率求**亚像素**边界，
// 再用 `inset(dy) = r − √(r²−(r−dy)²)` 做最小二乘。
//
//   ios27-list-screen.png        r = 26.27，RMSE 0.12 px（19 个采样点）
//   ios27-grouped-list-rows.png  r = 26.33，RMSE 0.69 px
//
// 两块互不相关的列表落在同一个值上，且 26 的 RMSE(0.215) 明显优于 27(0.384)，
// 故取 **26**。它不在既有圆角阶梯（8/14/22/34）上，所以单独开了
// `--lg-radius-card`，没有硬塞进阶梯。
//
// ── 这个组件为什么没有玻璃 ────────────────────────────────────────────
//
// **这是刻意的，不是没做完。** PROJECT_SPEC §2 的分层速查表里 Card 那一行是：
//
//   | Card / Table / List / Accordion | **两者都不用**（内容层，用不透明或极弱材质） | —— |
//
// 依据是 Apple 的原文 "This material forms a distinct functional layer for
// controls and navigation elements."，以及 §15 的第 9 条明令禁止
// 「在内容型组件（Table、List、Card 正文区）上堆玻璃」。
//
// 所以本组件**没有 `glass` 变体，将来也不该加**。`material` 变体用的是
// Apple 给内容层的另一套东西 —— ultraThin / thin / regular / thick 四档标准材质
// （apple-metrics §2，`[官方]`），只有模糊与不透明度，**没有折射，没有色散**，
// 不经过 GlassSurface。两套材质不是强弱关系，是**不同的体系**。
//
// ── §14 里有两条对本组件不适用 ────────────────────────────────────────
//
// 「材质档位 0/1/2/3」与「Layer B / Layer I 分层」这两条验收项，
// 对内容层组件**在概念上就不适用**：档位滑杆调的是玻璃材质，
// 而这里根本没有玻璃。不适用就写不适用，不假装过关 —— 详见 STATUS.md 的自查。

import * as React from 'react';
import { motion, type MotionStyle } from 'motion/react';
import { transitionFor, useGlassOptional } from '@glass/core';
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /** 行内左右内缩，也是 Header / Content / Footer 的内边距。[实测] */
  inset: 16,
  /** 行的最小高度。带图片或双行文本时会长高，所以是 min 而不是定高。[实测] */
  rowHeight: 52,
  /** 行标签字号。[实测]（墨迹高 13px，对应 SF body 17） */
  labelSize: 17,
  /** 行标签行高。取自 apple-metrics §7.6 的 17/22。[实测] */
  labelLine: 22,
  /**
   * 副标签字号。`[待核实]` —— 社区通行的 iOS subheadline 15pt，
   * apple-metrics §6 明确写了这组字号本项目**没有找到 Apple 出处**。
   * 分组列表的副标签我也没在资源里量到，所以这里是两重不确定，别当实测用。
   */
  subLabelSize: 15,
} as const;

export type GlassCardVariant = 'grouped' | 'material' | 'plain';
/** Apple 内容层的四档标准材质（apple-metrics §2，`[官方]`）。与玻璃档位无关。 */
export type GlassCardMaterial = 'ultrathin' | 'thin' | 'regular' | 'thick';

export interface GlassCardProps extends React.ComponentProps<'div'> {
  /**
   * `grouped`  默认。不透明区块底色，就是 iOS 分组列表那一块白。
   * `material` 内容层标准材质（半透明 + 模糊）。**只在卡片压着照片/渐变时用**，
   *            压在普通页面底色上没有意义，纯粹是徒增一层。
   * `plain`    不画底 —— 只要几何（圆角、内缩、行分隔），底交给调用方。
   */
  variant?: GlassCardVariant;
  /** 仅 `variant="material"` 有效。默认 regular，与 iOS 的默认档一致。 */
  material?: GlassCardMaterial;
}

function Card({
  className,
  variant = 'grouped',
  material = 'regular',
  style,
  ...props
}: GlassCardProps) {
  return (
    <div
      data-slot="card"
      data-variant={variant}
      // `.lg-content` 由 @glass/core 的 theme.css 提供：四档标准材质 +
      // Tier A/B 上的 backdrop-filter + Tier C / reduced-transparency 的降级，
      // 全部已经在那里实现过了，组件不重复一遍。
      {...(variant === 'material' ? { 'data-material': material } : {})}
      className={cn(
        'relative flex flex-col',
        // 圆角必须裁剪：行的按下高亮是整行铺满的，不裁会从圆角处露出直角。
        'overflow-hidden',
        // squircle —— 支持 corner-shape 的浏览器上才生效，其余自然回退
        'lg-continuous',
        variant === 'material' && 'lg-content',
        // 竖直内边距只在「卡片里放的是正文块」时才要。
        // 直接塞 CardRow 的那种（= Apple 的分组列表）行必须贴着区块上下边缘，
        // 所以用 :has 把它去掉 —— 纯 CSS，不用 React 去数子节点。
        'gap-4 py-4',
        'has-[>[data-slot=card-row]]:gap-0 has-[>[data-slot=card-row]]:py-0',
        className,
      )}
      style={{
        borderRadius: 'var(--lg-radius-card)',
        color: 'var(--lg-label-primary)',
        ...(variant === 'grouped' ? { background: 'var(--lg-card-fill)' } : {}),
        ...style,
      }}
      {...props}
    />
  );
}

function CardHeader({ className, style, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        // 与 shadcn 的 Card 保持同一套栅格，CardAction 才能落在右上角
        'grid auto-rows-min items-start',
        'has-data-[slot=card-action]:grid-cols-[1fr_auto]',
        className,
      )}
      style={{ paddingInline: GEOMETRY.inset, ...style }}
      {...props}
    />
  );
}

function CardTitle({ className, style, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('font-semibold', className)}
      style={{
        fontSize: GEOMETRY.labelSize,
        lineHeight: `${GEOMETRY.labelLine}px`,
        ...style,
      }}
      {...props}
    />
  );
}

function CardDescription({ className, style, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={className}
      style={{
        fontSize: GEOMETRY.subLabelSize,
        lineHeight: `${GEOMETRY.labelLine}px`,
        color: 'var(--lg-label-secondary)',
        ...style,
      }}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  );
}

function CardContent({ className, style, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={className}
      style={{ paddingInline: GEOMETRY.inset, ...style }}
      {...props}
    />
  );
}

function CardFooter({ className, style, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center', className)}
      style={{ paddingInline: GEOMETRY.inset, ...style }}
      {...props}
    />
  );
}

/**
 * motion 的手势回调与 React 同名原生事件签名冲突，在 exactOptionalPropertyTypes
 * 下无法共存 —— 与 button.tsx 里同一个处理。
 */
type MotionSafe<T> = Omit<
  T,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
>;

export interface GlassCardRowProps extends MotionSafe<React.ComponentProps<'div'>> {
  /**
   * 可点的行。渲染成真正的 `<button>`（不是 `role="button"` 的 div），
   * 并带 iOS 那样的按下高亮。
   *
   * ⚠️ `CardRow` 必须是 `Card` 的**直接子元素** —— 区块的竖直内边距是靠
   * `:has(> [data-slot=card-row])` 去掉的，套一层 `CardContent` 会让选择器落空，
   * 行就不再贴着区块边缘了。
   */
  interactive?: boolean;
  /** 仅 `interactive` 时有效 */
  disabled?: boolean;
}

function CardRow({
  className,
  children,
  interactive = false,
  disabled,
  style,
  ...props
}: GlassCardRowProps) {
  const [pressed, setPressed] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;

  /** 指针可能在别的元素上松开，按下态必须在 window 上收尾 */
  React.useEffect(() => {
    if (!pressed) return;
    const release = () => setPressed(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [pressed]);

  const rowStyle = {
    minHeight: GEOMETRY.rowHeight,
    paddingInline: GEOMETRY.inset,
    fontSize: GEOMETRY.labelSize,
    lineHeight: `${GEOMETRY.labelLine}px`,
    ...style,
  } as MotionStyle;

  const rowClass = cn(
    'relative flex w-full items-center gap-3 text-left',
    // 第一行不画分隔线 —— 线在每行的**顶边**，首行的那条正好压在区块边缘上。
    // 用 :first-child 交给 CSS 判断，不用把「是不是第一个」当 props 传下去。
    '[&:first-child>[data-slot=card-row-separator]]:hidden',
    interactive && [
      'outline-none select-none',
      'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--lg-ring)]',
      'disabled:pointer-events-none disabled:opacity-40',
    ],
    className,
  );

  const body = (
    <>
      <span
        aria-hidden="true"
        data-slot="card-row-separator"
        className="absolute top-0"
        style={{
          left: GEOMETRY.inset,
          right: GEOMETRY.inset,
          height: 1,
          background: 'var(--lg-list-separator)',
        }}
      />
      {interactive ? (
        <motion.span
          aria-hidden="true"
          data-slot="card-row-highlight"
          className="absolute inset-0"
          style={{ background: 'var(--lg-fill-quaternary)' }}
          initial={false}
          animate={{ opacity: pressed ? 1 : hovered ? 0.5 : 0 }}
          transition={transitionFor('smooth', reducedMotion)}
        />
      ) : null}
      {/* 内容必须是定位元素，否则会被绝对定位的高亮层盖住 */}
      <span className="relative flex w-full items-center gap-3">{children}</span>
    </>
  );

  // motion.button 与 motion.div 的 props 类型不同，共用一个变量会两头都不对，
  // 所以分两个分支 —— 只有外壳不同，内容是同一份 `body`。
  if (interactive) {
    return (
      <motion.button
        type="button"
        data-slot="card-row"
        data-interactive="true"
        data-pressed={pressed ? 'true' : undefined}
        disabled={disabled}
        className={rowClass}
        style={rowStyle}
        onPointerDown={() => setPressed(true)}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        {body}
      </motion.button>
    );
  }

  return (
    <div data-slot="card-row" className={rowClass} style={rowStyle as React.CSSProperties} {...props}>
      {body}
    </div>
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  CardRow,
};
