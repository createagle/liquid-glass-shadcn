'use client';

// APPLE REFERENCE: macOS NSTableView（节点 121:12606「List」，1110×1600）
// 记录见 docs/research/apple-metrics.md §11.4。
//
// ⚠️⚠️ **PROJECT_SPEC §2 明令禁止在表格上堆玻璃。**
//   这里一句 `GlassSurface` 都没有，测试里也钉着「.lg-surface 计数为 0」。
//   材质属于控件层；表格是内容，而且是**信息密度最高**的那种内容 ——
//   任何一点模糊或折射都会直接伤到可读性。
//
// ── 为什么参考是 macOS 而不是 iOS ─────────────────────────────────────
//
//   清单第 32 行写的是「UITableView / lists-and-tables」。但这两个是**两样东西**：
//
//     · iOS 的 UITableView ≈ **分组列表** —— 本库已经有了，就是 `Card` + `CardRow`
//       （行高 52、区块圆角 26、不透明白，全部实测）；
//     · 带列、可排序表头、交替行的**数据表格**，iOS 上根本没有。
//
//   所以这个组件的参考只能是 macOS，与 Checkbox / Radio 同一个情况。
//   **需要 iOS 那种列表时请用 `Card`，不要用 `Table`。**
//
// ── 实测值 ────────────────────────────────────────────────────────────
//
//   数据行高          20                              [实测]
//   表头行高          19                              [实测]
//   行背景左右内缩    10                              [实测]
//   行背景圆角        8                               [实测]
//   首列内容左内缩    16                              [实测]
//   层级缩进          15 / 级                          [实测]
//   次列内边距        左 8 / 右 8（最右列右 16）        [实测]
//   行文字            SF Pro Medium 13                [实测]
//   表头文字          Medium 11；排序列 **Bold 11**    [实测]
//   选中行            #0165e2，文字全白                [实测]
//   选中 · 窗口失焦    #000000 @ 0.14                  [实测]
//   交替行            #000000 @ 0.05                  [实测]
//
// ── 两处刻意的偏离 ────────────────────────────────────────────────────
//
//  1. **默认行高不是 20，是 32。**
//     20pt 是 macOS 的指针密度。本库基准是 iOS，20pt 的行在触屏上既点不准
//     也读不舒服。默认给 32，`density="compact"` 才回到实测的 20。
//     **32 是 `[推定]`**，20 才是实测值 —— 别把默认值当成 Apple 的数。
//
//  2. **`Active=False`（窗口失焦）那一维没有实现。**
//     Web 没有窗口焦点概念。资源里的 `Selected + Inactive` 因此改用在
//     「表格自己失去焦点」上 —— 语义相近但**不是同一件事**，如实记着。
//
// ⚠️ 暗色**全部 `[推定]`**：List 页搜不到任何 Dark 节点。

import * as React from 'react';
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /** 数据行高 · compact（px）。[实测] 20 —— macOS 的指针密度 */
  rowHeightCompact: 20,
  /** 数据行高 · 默认（px）。`[推定]` —— 见文件头第 1 条偏离 */
  rowHeight: 32,
  /** 表头行高（px）。[实测] 19 */
  headHeightCompact: 19,
  /** 表头行高 · 默认（px）。`[推定]` —— 与行高同比例放大 */
  headHeight: 30,
  /** 行背景左右内缩（px）。[实测] 10 */
  rowInset: 10,
  /** 行背景圆角（px）。[实测] 8 */
  rowRadius: 8,
  /** 首列内容左内缩（px）。[实测] 16 */
  firstCellInset: 16,
  /** 每一级层级的缩进（px）。[实测] 15 */
  levelIndent: 15,
  /** 次列左右内边距（px）。[实测] 8 */
  cellInset: 8,
  /** 行文字字号（px）。[实测] 13 */
  fontSize: 13,
  /** 表头字号（px）。[实测] 11 */
  headFontSize: 11,
} as const;

export type GlassTableDensity = 'default' | 'compact';

const DensityContext = React.createContext<GlassTableDensity>('default');

export interface GlassTableProps extends React.ComponentProps<'table'> {
  /**
   * `default` 行高 32（`[推定]`，为触屏放宽）；
   * `compact` 行高 20（[实测]，macOS 原始密度）。
   */
  density?: GlassTableDensity;
}

/**
 * 数据表格。
 *
 * ```tsx
 * <Table>
 *   <TableHeader>
 *     <TableRow>
 *       <TableHead sorted="asc">名称</TableHead>
 *       <TableHead>大小</TableHead>
 *     </TableRow>
 *   </TableHeader>
 *   <TableBody>
 *     <TableRow><TableCell>报告.pdf</TableCell><TableCell>2.4 MB</TableCell></TableRow>
 *   </TableBody>
 * </Table>
 * ```
 *
 * ⚠️ 外面**不要**再套 `ScrollArea` 以外的滚动容器 ——
 * 表头要吸顶的话请用 `TableHeader sticky`。
 */
function Table({ className, density = 'default', style, ...props }: GlassTableProps) {
  return (
    <DensityContext.Provider value={density}>
      <table
        /*
         * group/table：选中行要靠 `group-focus-within/table` 判断
         * 「表格自己有没有焦点」，从而在两档选中色之间切换。
         */
        /*
         * ⚠️ `border-separate` + `border-spacing: 0`，**不是** `border-collapse`。
         *
         * 实测的行背景是「左右各内缩 10、圆角 8」。而 `<tr>` 上的
         * border-radius 在 collapse 模式下根本不生效 —— 圆角只能落在单元格上，
         * 由首尾两个单元格各圆一边拼出来（见 TableRow）。
         * collapse 模式下单元格边框会被合并，圆角同样失效，所以必须 separate。
         */
        className={cn('group/table w-full border-separate text-left', className)}
        style={{
          fontSize: GEOMETRY.fontSize,
          borderSpacing: 0,
          // 行背景左右各内缩 10。[实测] —— 表格自己让出这段，行背景才不贴边
          paddingInline: GEOMETRY.rowInset,
          ...style,
        }}
        {...props}
        data-slot="table"
        data-density={density}
      />
    </DensityContext.Provider>
  );
}

export interface GlassTableHeaderProps extends React.ComponentProps<'thead'> {
  /** 表头吸顶。滚动时留在原地。 */
  sticky?: boolean;
}

function TableHeader({ className, sticky = false, style, ...props }: GlassTableHeaderProps) {
  return (
    <thead
      className={cn(
        sticky && 'sticky top-0 z-10 bg-[var(--lg-grouped-bg)]',
        // 表头与数据之间一条分隔线。`[推定]` —— 资源里表头下面没画线
        'border-b border-[var(--lg-list-separator)]',
        className,
      )}
      style={style}
      {...props}
      data-slot="table-header"
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      className={cn(
        /*
         * 交替行色。[实测] #000000 @ 0.05。
         *
         * ⚠️ 用 `:nth-child(even)` 而不是在 React 里按下标加 class ——
         * 行被过滤 / 排序之后下标会变，而条纹要跟着**渲染顺序**走，不是数据顺序。
         *
         * ⚠️ 必须排除掉选中行。这条规则的选择器是
         * `.tbody > tr:nth-child(even)`（0,1,2），比选中行自己那条工具类
         * （0,1,0）优先级更高 —— 不排除的话，偶数位的选中行会被条纹盖回去。
         */
        '[&>tr:nth-child(even):not([data-selected])>td]:bg-[var(--lg-table-row-alt)]',
        className,
      )}
      {...props}
      data-slot="table-body"
    />
  );
}

export interface GlassTableRowProps extends React.ComponentProps<'tr'> {
  /** 选中。表格失焦时会自动换成较淡的那一档。 */
  selected?: boolean;
  /** 层级缩进（0 起）。[实测] 每级 15px。 */
  level?: number;
}

function TableRow({ className, selected = false, level = 0, style, ...props }: GlassTableRowProps) {
  return (
    <tr
      className={cn(
        'transition-colors duration-100',
        /*
         * 行背景圆角 8（[实测]）由首尾两个单元格各圆一边拼出来 ——
         * `<tr>` 自己的 border-radius 在表格里不生效，见 Table 那处注释。
         */
        '[&>td:first-child]:rounded-l-(--lg-table-row-radius)',
        '[&>td:last-child]:rounded-r-(--lg-table-row-radius)',
        selected && [
          /*
           * 两档选中色。
           *
           * **默认是较淡的那一档**，表格拿到焦点才升到实心蓝 ——
           * 顺序不能反：`group-focus-within` 要在后面才盖得住前面那条。
           *
           * ⚠️ 资源里这两档叫 `Selected + Active` / `Selected + Inactive`，
           * 指的是**窗口**是否激活。Web 没有那个概念，这里改用
           * 「表格自己有没有焦点」—— 语义相近，但**不是同一件事**。
           */
          // 落在单元格上，与交替行同一层 —— 否则圆角拼不出来
          '[&>td]:bg-[var(--lg-selection-fill-inactive)]',
          'group-focus-within/table:[&>td]:bg-[var(--lg-selection-fill)]',
          /*
           * 文字压白只在实心蓝那一档才成立 ——
           * 淡档（0.14 的黑）上压白字会掉出 AA。
           * [实测] 实心蓝那一档连次列文字也是纯白，不是半透明。
           */
          'group-focus-within/table:[&_td]:text-[var(--lg-on-selection)]',
        ],
        className,
      )}
      style={{
        ['--lg-row-indent' as string]: `${level * GEOMETRY.levelIndent}px`,
        ['--lg-table-row-radius' as string]: `${GEOMETRY.rowRadius}px`,
        ...style,
      }}
      {...props}
      data-slot="table-row"
      data-selected={selected ? 'true' : undefined}
      data-level={level > 0 ? level : undefined}
      aria-selected={selected ? true : undefined}
    />
  );
}

export interface GlassTableHeadProps extends React.ComponentProps<'th'> {
  /**
   * 这一列的排序方向。传了就变粗体并画出指示器 ——
   * [实测] 排序列是 **Bold 11 + 0.85 不透明度**，非排序列是 Medium 11 + 0.50。
   */
  sorted?: 'asc' | 'desc';
}

function TableHead({ className, sorted, children, style, ...props }: GlassTableHeadProps) {
  const density = React.useContext(DensityContext);
  const h = density === 'compact' ? GEOMETRY.headHeightCompact : GEOMETRY.headHeight;
  return (
    <th
      scope="col"
      className={cn(
        'font-normal whitespace-nowrap',
        sorted
          ? 'font-bold text-[var(--lg-label-primary)]'
          : 'text-[var(--lg-label-secondary)]',
        'first:pl-(--lg-table-first-inset) [&:not(:first-child)]:pl-(--lg-table-cell-inset)',
        'pr-(--lg-table-cell-inset) last:pr-4',
        className,
      )}
      style={{
        height: h,
        fontSize: GEOMETRY.headFontSize,
        ['--lg-table-first-inset' as string]: `${GEOMETRY.firstCellInset}px`,
        ['--lg-table-cell-inset' as string]: `${GEOMETRY.cellInset}px`,
        ...style,
      }}
      {...props}
      data-slot="table-head"
      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sorted ? <SortIndicator direction={sorted} /> : null}
      </span>
    </th>
  );
}

/**
 * 排序指示器。
 *
 * ⚠️ 与 Collapsible 的人字形同一个问题：资源里是 SF Symbols 的字形
 * （私有区码位，网页上多数会是豆腐块），所以自己画。
 * **形状 `[推定]`**，只有「13×19 的槽、字号 9、`#000000@0.50`」是实测的。
 */
function SortIndicator({ direction }: { direction: 'asc' | 'desc' }) {
  return (
    <svg
      width={9}
      height={9}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="text-[var(--lg-label-secondary)]"
      style={direction === 'asc' ? { transform: 'rotate(180deg)' } : undefined}
    >
      <path
        d="M 2.6 4.6 L 6 8 L 9.4 4.6"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TableCell({ className, style, ...props }: React.ComponentProps<'td'>) {
  const density = React.useContext(DensityContext);
  const h = density === 'compact' ? GEOMETRY.rowHeightCompact : GEOMETRY.rowHeight;
  return (
    <td
      className={cn(
        'align-middle',
        // 首列：基础内缩 + 层级缩进（--lg-row-indent 由 TableRow 写）
        'first:pl-[calc(var(--lg-table-first-inset)+var(--lg-row-indent,0px))]',
        '[&:not(:first-child)]:pl-(--lg-table-cell-inset) [&:not(:first-child)]:text-[var(--lg-label-secondary)]',
        'first:text-[var(--lg-label-primary)]',
        'pr-(--lg-table-cell-inset) last:pr-4',
        className,
      )}
      style={{
        height: h,
        ['--lg-table-first-inset' as string]: `${GEOMETRY.firstCellInset}px`,
        ['--lg-table-cell-inset' as string]: `${GEOMETRY.cellInset}px`,
        ...style,
      }}
      {...props}
      data-slot="table-cell"
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      // caption 默认在表格**上面**，这里挪到下面（与 shadcn 的 Table 一致）
      className={cn('caption-bottom mt-2 text-[13px] text-[var(--lg-label-secondary)]', className)}
      {...props}
      data-slot="table-caption"
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  GEOMETRY as TABLE_GEOMETRY,
};
