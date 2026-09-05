'use client';

import * as React from 'react';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';

interface Row {
  id: string;
  name: string;
  kind: string;
  size: number;
}

const DATA: Row[] = [
  { id: '1', name: 'Keynote.app', kind: '应用程序', size: 812 },
  { id: '2', name: 'Report.pages', kind: '文稿', size: 2 },
  { id: '3', name: 'Budget.numbers', kind: '表格', size: 14 },
  { id: '4', name: 'Photo.heic', kind: '图像', size: 3 },
  { id: '5', name: 'Archive.zip', kind: '归档', size: 156 },
];

const COLUMNS: DataTableColumn<Row>[] = [
  { id: 'name', header: '名称', cell: (r) => r.name, sortValue: (r) => r.name },
  { id: 'kind', header: '种类', cell: (r) => r.kind, sortValue: (r) => r.kind },
  {
    id: 'size',
    header: '大小',
    align: 'end',
    cell: (r) => `${r.size} MB`,
    sortValue: (r) => r.size,
  },
];

/**
 * ⚠️ **这个组件一个新几何常量都没有。**
 *
 * 外观全部来自已经实测过的 `<Table>`（macOS NSTableView）——
 * 列表头、排序指示器、交替行、两档选中都在那边。
 * 这里的增量是**行为**：排序状态机、行选择、分页。
 * 那三件 Apple 的设计资源里本来就不会有，它们是交互不是外观。
 */
export default function DataTableDemo() {
  return (
    <DataTable
      columns={COLUMNS}
      data={DATA}
      rowKey={(r) => r.id}
      defaultSort={{ id: 'name', direction: 'asc' }}
      caption="点表头排序 —— 三态循环：升 → 降 → 回到原始顺序"
    />
  );
}
