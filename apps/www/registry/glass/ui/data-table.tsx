'use client';

// APPLE REFERENCE: 与 `<Table>` **同一个** —— macOS NSTableView（节点 121:12606）。
//
// ── ❗ 这个组件**一个新几何常量都没有** ────────────────────────────────
//
//   动手前照例回去把 macOS `207:14499 Lists and Tables` 又翻了一遍，
//   结论是：DataTable 需要的外观**全都已经量过并且已经实现**在 `table.tsx` 里 ——
//   列表头（`121:12610`）、整条表头 600×28（`4356:13469`）、
//   排序指示器（`4356:13719`，Medium 9 / 13×19 / `#000000 @ 0.50`）、
//   数据行与交替行与两档选中（`4356:11854`，20 个变体）。记录见 §11.4 与 §15.1。
//
//   **所以本文件的增量是行为，不是材质，也不是几何**：
//   排序状态机、行选择、分页。这三件 Apple 的设计资源里本来就不会有 ——
//   它们是**交互**，不是外观。
//
//   于是本文件里**没有 GEOMETRY 常量块**，所有尺寸都来自 `TABLE_GEOMETRY`。
//   这不是偷懒，是「量过了，发现没有新的可量」。
//
// ── 为什么不引 TanStack Table ─────────────────────────────────────────
//
//   shadcn 的 Data Table 是 `@tanstack/react-table` 的皮肤。本库不引它：
//
//   1. registry 分发的是**源码**，多一个依赖就是用户工程里多一个依赖 ——
//      而这里用到的只是「排序 + 选择 + 分页」三件事，`useMemo` 就够。
//   2. 它的 headless API 会把行/列渲染接管过去，而本库的行样式是靠
//      `TableRow` / `TableCell` 上那一套 `data-slot` 与相邻选择器拼出来的
//      （行圆角是首尾单元格各圆一边）。两套拼在一起，调用方要同时学两份。
//
//   代价：**没有** 列可见性切换、列宽拖拽、分组、虚拟滚动、多列排序。
//   需要那些就直接用 TanStack + 本库的 `<Table>` 原语，两者不冲突。
//   如实写在这里，别让人以为这是个功能对等的替代品。
//
// ⚠️ 分层：与 `<Table>` 同 —— **内容层，一句玻璃都没有**（PROJECT_SPEC §2 明令）。

import * as React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  type GlassTableProps,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc';

export interface DataTableColumn<Row> {
  /** 列的唯一键。也是排序状态里存的那个值。 */
  id: string;
  header: React.ReactNode;
  /** 单元格内容。 */
  cell: (row: Row) => React.ReactNode;
  /**
   * 排序用的取值。给了才可排序 —— **没给的列点表头不会有反应**，
   * 而且不会渲染成按钮（否则读屏会读出一个按不动的按钮）。
   */
  sortValue?: (row: Row) => string | number;
  /** 单元格对齐。默认 `start`。 */
  align?: 'start' | 'end';
}

export interface GlassDataTableProps<Row> extends Omit<GlassTableProps, 'children'> {
  columns: readonly DataTableColumn<Row>[];
  data: readonly Row[];
  /** 行的稳定键。**必须给** —— 排序会打乱顺序，用下标当 key 会让选中态跟错行。 */
  rowKey: (row: Row) => string;
  /** 受控排序。 */
  sort?: { id: string; direction: SortDirection } | null;
  defaultSort?: { id: string; direction: SortDirection } | null;
  onSortChange?: (sort: { id: string; direction: SortDirection } | null) => void;
  /** 开启行选择（多选）。 */
  selectable?: boolean;
  selected?: readonly string[];
  defaultSelected?: readonly string[];
  onSelectedChange?: (keys: string[]) => void;
  /** 每页行数。不传就不分页。 */
  pageSize?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  /** 表格标题（`<caption>`）。**没有可见标题时至少要给它**，否则表格没有名字。 */
  caption?: React.ReactNode;
  /** 数据为空时显示的内容。 */
  empty?: React.ReactNode;
  /** 全选复选框的无障碍名称。 */
  selectAllLabel?: string;
}

/**
 * 排序：**三态循环** asc → desc → 无。
 *
 * ⚠️ 第三态（回到未排序）是**刻意的**：一旦排过就再也回不到原始顺序，
 * 而原始顺序往往本身有意义（比如后端已经按相关度排好了）。
 * macOS 的表头是两态循环 —— 这一条是本库的偏离，不是还原。
 */
function nextSort(
  current: { id: string; direction: SortDirection } | null,
  id: string,
): { id: string; direction: SortDirection } | null {
  if (!current || current.id !== id) return { id, direction: 'asc' };
  if (current.direction === 'asc') return { id, direction: 'desc' };
  return null;
}

function DataTable<Row>({
  columns,
  data,
  rowKey,
  sort: sortProp,
  defaultSort = null,
  onSortChange,
  selectable = false,
  selected: selectedProp,
  defaultSelected = [],
  onSelectedChange,
  pageSize,
  page: pageProp,
  onPageChange,
  caption,
  empty = '没有数据',
  selectAllLabel = '全选',
  className,
  ...props
}: GlassDataTableProps<Row>) {
  const [selfSort, setSelfSort] = React.useState(defaultSort);
  const sort = sortProp !== undefined ? sortProp : selfSort;

  const [selfSelected, setSelfSelected] = React.useState<readonly string[]>(defaultSelected);
  const selected = selectedProp !== undefined ? selectedProp : selfSelected;

  const [selfPage, setSelfPage] = React.useState(0);
  const page = pageProp ?? selfPage;

  const setSort = (next: { id: string; direction: SortDirection } | null) => {
    if (sortProp === undefined) setSelfSort(next);
    onSortChange?.(next);
  };

  const setSelected = (next: string[]) => {
    if (selectedProp === undefined) setSelfSelected(next);
    onSelectedChange?.(next);
  };

  const setPage = (next: number) => {
    if (pageProp === undefined) setSelfPage(next);
    onPageChange?.(next);
  };

  const sorted = React.useMemo(() => {
    if (!sort) return data;
    const column = columns.find((c) => c.id === sort.id);
    if (!column?.sortValue) return data;
    const get = column.sortValue;
    /*
     * ⚠️ 先复制再排 —— `Array.prototype.sort` 是原地的，
     * 直接排会改掉调用方传进来的数组（而且 React 看不出引用变了，不会重渲染）。
     */
    const copy = [...data];
    copy.sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x === y) return 0;
      const r = x < y ? -1 : 1;
      return sort.direction === 'asc' ? r : -r;
    });
    return copy;
  }, [data, sort, columns]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  /*
   * 数据变少时当前页可能已经越界（筛掉几行就会发生）。
   * 这里在渲染期夹住，而不是用 effect 改 state —— 后者会多渲染一帧空表格。
   */
  const safePage = Math.min(page, pageCount - 1);
  const rows = React.useMemo(
    () => (pageSize ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize) : sorted),
    [sorted, pageSize, safePage],
  );

  const pageKeys = rows.map(rowKey);
  const allOnPageSelected = pageKeys.length > 0 && pageKeys.every((k) => selected.includes(k));
  const someOnPageSelected = pageKeys.some((k) => selected.includes(k));

  const toggleAll = () => {
    if (allOnPageSelected) {
      setSelected(selected.filter((k) => !pageKeys.includes(k)));
    } else {
      setSelected([...new Set([...selected, ...pageKeys])]);
    }
  };

  const toggleRow = (key: string) => {
    setSelected(
      selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key],
    );
  };

  const colCount = columns.length + (selectable ? 1 : 0);

  return (
    <div className={cn('flex flex-col gap-4', className)} data-slot="data-table">
      <Table {...props}>
        {caption ? <TableCaption>{caption}</TableCaption> : null}
        <TableHeader>
          <TableRow>
            {selectable ? (
              <TableHead style={{ width: 1 }} data-select-all-cell="">
                {/*
                  ⚠️ **不要给 Checkbox 传 `data-slot`。** 它在展开 props **之后**
                  设了自己的 `data-slot="checkbox"`，这里再给一个会被静默吃掉 ——
                  测试与样式赖以定位的钩子就断了。
                  本仓库这一族的坑已经踩到**第六次**（SheetClose、ResponsiveOverlay、
                  DropdownMenu、命令面板、GlassSurface 的属性吞掉、以及这里）。
                  解法与前五次一样：**另起一个属性**。
                */}
                <Checkbox
                  checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleAll}
                  aria-label={selectAllLabel}
                  data-select-all=""
                />
              </TableHead>
            ) : null}
            {columns.map((column) => {
              const active = sort?.id === column.id ? sort.direction : undefined;
              /*
               * 不可排序的列**不渲染按钮** —— 渲染了读屏就会读出
               * 一个按不动的按钮，那比没有按钮更糟。
               */
              if (!column.sortValue) {
                return (
                  <TableHead key={column.id} data-column={column.id}>
                    {column.header}
                  </TableHead>
                );
              }
              return (
                <TableHead
                  key={column.id}
                  data-column={column.id}
                  {...(active ? { sorted: active } : {})}
                >
                  <button
                    type="button"
                    onClick={() => setSort(nextSort(sort, column.id))}
                    className={cn(
                      'inline-flex w-full items-center gap-1 text-inherit',
                      'cursor-default rounded-[4px] outline-none',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--lg-ring)]',
                      column.align === 'end' && 'justify-end',
                    )}
                    data-slot="data-table-sort"
                    data-direction={active}
                  >
                    {column.header}
                  </button>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              {/* 同上 —— TableCell 自己拥有 data-slot，这里只能另起一个属性 */}
              <TableCell
                colSpan={colCount}
                className="text-center text-[var(--lg-label-secondary)]"
                data-empty=""
              >
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const key = rowKey(row);
              const isSelected = selected.includes(key);
              return (
                <TableRow key={key} selected={isSelected} data-row={key}>
                  {selectable ? (
                    <TableCell style={{ width: 1 }}>
                      {/* 同上 —— 不能用 data-slot，见表头那处注释 */}
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(key)}
                        aria-label={`选择 ${key}`}
                        data-select-row={key}
                      />
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={column.align === 'end' ? 'text-end' : undefined}
                    >
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {pageSize && pageCount > 1 ? (
        <div className="flex justify-center" data-slot="data-table-pagination">
          {/*
            ⚠️ 复用本库的 `<Pagination>`（iOS Page Control，几何全实测）。
            它是**圆点**，不是「上一页 / 下一页 / 页码」那种 Web 分页条 ——
            那种形态 Apple 两份资源里都没有，本库不自造。
            页数很多时圆点会缩成两档小点，那也是实测的行为。
          */}
          <Pagination total={pageCount} page={safePage} onPageChange={setPage} />
        </div>
      ) : null}
    </div>
  );
}

export { DataTable };
