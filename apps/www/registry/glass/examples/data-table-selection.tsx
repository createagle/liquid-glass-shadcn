'use client';

import * as React from 'react';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';

interface Row {
  id: string;
  name: string;
  status: string;
}

const DATA: Row[] = Array.from({ length: 9 }, (_, i) => ({
  id: String(i + 1),
  name: `任务 ${i + 1}`,
  status: i % 3 === 0 ? '进行中' : i % 3 === 1 ? '已完成' : '待开始',
}));

const COLUMNS: DataTableColumn<Row>[] = [
  { id: 'name', header: '名称', cell: (r) => r.name, sortValue: (r) => r.name },
  // 没给 sortValue 的列**不会渲染成按钮** —— 否则读屏会读出一个按不动的按钮
  { id: 'status', header: '状态', cell: (r) => r.status },
];

/**
 * 行选择 + 分页。
 *
 * ⚠️ 分页用的是本库的 `<Pagination>`（iOS Page Control，几何全实测）——
 * 它是**圆点**，不是「上一页 / 下一页 / 页码」那种 Web 分页条。
 * 那种形态 Apple 两份资源里都没有，本库不自造。
 *
 * 全选复选框在「本页部分选中」时是 indeterminate 那一态（横杠 6.5×2，实测）。
 */
export default function DataTableSelection() {
  const [selected, setSelected] = React.useState<string[]>(['2']);
  return (
    <div className="flex w-full flex-col gap-3">
      <DataTable
        columns={COLUMNS}
        data={DATA}
        rowKey={(r) => r.id}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        pageSize={4}
        caption="勾选左侧方框选择行；下方圆点翻页"
      />
      <span className="text-[13px] text-[var(--lg-label-secondary)]">
        已选 {selected.length} 行
      </span>
    </div>
  );
}
