'use client';

// APPLE REFERENCE: UIPageControl（iOS 27「Page Controls」页）
//
// 尺寸与配色来源：Apple Design Resources《iOS and iPadOS 27》Figma 文件
// （fileKey ojEQo0rKaQ5ioARo0CO0pf，节点 10520:3448 Page Control /
// 10520:3260 _Page Indicator）。记录见 docs/research/apple-metrics.md §12.1。
//
// ⚠️ **这个组件是玻璃的**，与前两批那些内容层不同 ——
//   资源里的容器材质写得很清楚：`#ffffff@0.070` + `#ffffff@0.030` COLOR_DODGE，
//   `BACKGROUND_BLUR r100`，也就是**内容层四档里的 Ultrathin**。
//   清单第 34 行标的 **B**，这次实测坐实了。
//
// ── 实测值 ────────────────────────────────────────────────────────────
//
//   容器高          24                          [实测]
//   容器圆角        胶囊                        [实测]
//   容器内边距      上下 8 / 左右 12             [实测]
//   容器材质        Ultrathin + 背景模糊         [实测]
//   圆点直径        8                           [实测]
//   点间距          8                           [实测]（见下方那条不一致）
//   未选中点        #3c3c43 @ 0.30              [实测] = `--lg-label-tertiary`
//   选中点          #000000                     [实测] = `--lg-label-primary`
//
// ✅ **两个点色正好落在既有 token 上**，所以这个组件**没有新增任何颜色 token**。
//   `#3c3c43` 就是 iOS 的 label 基色，0.30 就是 tertiary 那一档 —— 与 §9 的推导对上了。
//
// ── 三档点尺寸（溢出时用）────────────────────────────────────────────
//
//   Default   槽 8 / 点 8      常规位置
//   Adjacent  槽 8 / 点 **6**   紧邻溢出区的那一个
//   Overflow  槽 **6** / 点 4   溢出区最外侧
//
// ── 资源里的一处不一致，本库不跟 ──────────────────────────────────────
//
//   点间距在「1–6 页」与「8+ 页」两个变体里都是 **8**，
//   唯独「7 页」那个变体是 **10**。三个变体的总宽都能对上，所以不是笔误，
//   是那一档单独画的。**本库一律取 8** —— 没有任何理由认为恰好 7 页时该更疏。
//
// ── 一处刻意的偏离：默认不可点 ────────────────────────────────────────
//
//   UIPageControl 是可点的（点左右半边翻页），但**点不中单个圆点** ——
//   8pt 的点、16pt 的节距，远小于 44pt 触控下限，Apple 自己也是把整条控件
//   当成一个左右分区来处理的。
//
//   本库默认渲染成**纯指示器**（`role="group"` + `aria-current`，不可聚焦），
//   传了 `onPageChange` 才把每个点变成按钮。那时命中区**只在竖直方向**撑到 44，
//   水平方向仍是节距 16 —— 撑到 44 会让相邻两点的命中区重叠，那比点不中更糟。
//   这是取舍，不是还原，如实写在这里。

import * as React from 'react';
import { GlassSurface } from '@createagle/glass-core';
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /** 容器高（px）。[实测] 24 */
  height: 24,
  /** 容器左右内边距（px）。[实测] 12 */
  paddingInline: 12,
  /** 圆点直径（px）。[实测] 8 */
  dot: 8,
  /** 紧邻溢出区那一档的点直径（px）。[实测] 6 */
  dotAdjacent: 6,
  /** 溢出区最外侧的点直径（px）。[实测] 4 */
  dotOverflow: 4,
  /** 溢出区最外侧的**槽**宽（px）。[实测] 6 —— 槽比点大 1 圈 */
  slotOverflow: 6,
  /** 点间距（px）。[实测] 8 —— 资源里 7 页那一档画成 10，本库不跟，见文件头 */
  gap: 8,
  /** 不再全尺寸显示的页数阈值。[实测] 资源里 8 页起出现溢出点 */
  overflowAfter: 7,
  /** 最小触控目标（px）。HIG 44×44pt，[官方] */
  minTouch: 44,
} as const;

/** 某个点相对当前页的距离 → 它该用哪一档尺寸 */
type DotTier = 'default' | 'adjacent' | 'overflow';

/**
 * 算出每个点的档位。
 *
 * 规则来自资源里 8+ 页那个变体的排布：中间一段是 Default，
 * 两端各一个 Adjacent，再往外是 Overflow。
 * **页数不超过阈值时全部是 Default** —— 那两档只在溢出时出现。
 */
function tierFor(index: number, current: number, total: number): DotTier {
  if (total <= GEOMETRY.overflowAfter) return 'default';
  const d = Math.abs(index - current);
  if (d <= 2) return 'default';
  if (d === 3) return 'adjacent';
  return 'overflow';
}

const DOT_SIZE: Record<DotTier, number> = {
  default: GEOMETRY.dot,
  adjacent: GEOMETRY.dotAdjacent,
  overflow: GEOMETRY.dotOverflow,
};
const SLOT_SIZE: Record<DotTier, number> = {
  default: GEOMETRY.dot,
  adjacent: GEOMETRY.dot,
  overflow: GEOMETRY.slotOverflow,
};

export interface GlassPaginationProps
  extends Omit<React.ComponentProps<'nav'>, 'onChange'> {
  /** 总页数。 */
  total: number;
  /** 当前页（0 起）。 */
  page: number;
  /**
   * 传了才可点。不传就是纯指示器 —— 见文件头最后一条。
   *
   * ⚠️ 可点时命中区只在**竖直**方向撑到 44；水平方向仍是节距 16，
   * 撑满会让相邻两点的命中区重叠。
   */
  onPageChange?: (page: number) => void;
  /** 无障碍名。不传就用「第 N 页，共 M 页」。 */
  label?: string;
}

/**
 * 页码指示器（iOS 的 UIPageControl）。
 *
 * ```tsx
 * <Pagination total={5} page={2} />
 * <Pagination total={12} page={p} onPageChange={setP} />
 * ```
 */
function Pagination({
  className,
  total,
  page,
  onPageChange,
  label,
  ...props
}: GlassPaginationProps) {
  const interactive = typeof onPageChange === 'function';
  const clamped = Math.min(Math.max(page, 0), Math.max(0, total - 1));

  const dots = Array.from({ length: Math.max(0, total) }, (_, i) => {
    const tier = tierFor(i, clamped, total);
    const active = i === clamped;
    const slot = SLOT_SIZE[tier];
    const size = active ? GEOMETRY.dot : DOT_SIZE[tier];

    const dot = (
      <span
        aria-hidden="true"
        className={cn(
          'block rounded-full transition-[width,height,background-color] duration-150',
          active ? 'bg-[var(--lg-label-primary)]' : 'bg-[var(--lg-label-tertiary)]',
        )}
        style={{ width: size, height: size }}
      />
    );

    const slotStyle: React.CSSProperties = {
      width: slot,
      height: GEOMETRY.dot,
    };

    if (!interactive) {
      return (
        <span
          key={i}
          data-slot="pagination-dot"
          data-active={active ? 'true' : undefined}
          className="flex items-center justify-center"
          style={slotStyle}
        >
          {dot}
        </span>
      );
    }

    return (
      <button
        key={i}
        type="button"
        data-slot="pagination-dot"
        data-active={active ? 'true' : undefined}
        aria-label={`第 ${i + 1} 页`}
        aria-current={active ? 'true' : undefined}
        onClick={() => onPageChange(i)}
        className={cn(
          'relative flex items-center justify-center outline-none',
          'focus-visible:[box-shadow:0_0_0_3.5px_var(--lg-ring)] focus-visible:rounded-full',
          /*
           * 命中区**只往竖直方向**撑到 44。
           * 水平撑满会让相邻两点重叠（节距只有 16），比点不中更糟。
           */
          'before:absolute before:top-1/2 before:left-0 before:h-(--lg-hit) before:w-full',
          'before:-translate-y-1/2 before:content-[""]',
        )}
        style={{ ...slotStyle, ['--lg-hit' as string]: `${GEOMETRY.minTouch}px` }}
      >
        {dot}
      </button>
    );
  });

  return (
    <nav
      aria-label={label ?? `第 ${clamped + 1} 页，共 ${total} 页`}
      className={cn('inline-flex', className)}
      {...props}
      data-slot="pagination"
    >
      <GlassSurface
        layer="base"
        /*
         * 胶囊。用高度的一半而不是一个魔法数 ——
         * 资源里 r=50 于 24 高，就是胶囊。
         */
        radius={GEOMETRY.height / 2}
        className="flex items-center"
        style={{
          height: GEOMETRY.height,
          paddingInline: GEOMETRY.paddingInline,
          gap: GEOMETRY.gap,
        }}
        data-slot="pagination-track"
      >
        {dots}
      </GlassSurface>
    </nav>
  );
}

export { Pagination, GEOMETRY as PAGINATION_GEOMETRY, tierFor as paginationTierFor };
