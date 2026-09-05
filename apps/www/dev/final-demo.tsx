/**
 * P2 收尾批（DataTable / Command）的渲染验证台。
 *
 * 这一批的看点几乎全在**行为**上：
 *   DataTable  外观全部来自已实测的 <Table>，本组件**没有新几何**
 *   Command    Apple 资源里结构上不可能有（Spotlight 是系统级的），
 *              只有搜索框那一半有实测依据
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { GlassProvider } from '@glass/core';
import { DataTable, type DataTableColumn } from '../registry/glass/ui/data-table';
import { Command, type CommandItem } from '../registry/glass/ui/command';

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'light') as 'light' | 'dark';
const tier = (params.get('tier') ?? 'a') as 'a' | 'b' | 'c';
const tint = Number(params.get('tint') ?? '0.34');
const only = params.get('only');

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
  // 刻意不给 sortValue —— 用来验证「不可排序的列不渲染按钮」
  { id: 'kind', header: '种类', cell: (r) => r.kind },
  {
    id: 'size',
    header: '大小',
    align: 'end',
    cell: (r) => `${r.size} MB`,
    sortValue: (r) => r.size,
  },
];

function DataTableRow() {
  return (
    <div data-testid="row-data-table" style={{ width: 520 }}>
      <DataTable
        columns={COLUMNS}
        data={DATA}
        rowKey={(r) => r.id}
        caption="文件列表"
        data-testid="dt"
      />
    </div>
  );
}

function DataTableSelectRow() {
  const [selected, setSelected] = React.useState<string[]>([]);
  return (
    <div data-testid="row-data-table-select" style={{ width: 520 }}>
      <DataTable
        columns={COLUMNS}
        data={DATA}
        rowKey={(r) => r.id}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        pageSize={3}
        caption="可选 + 分页"
        data-testid="dt-select"
      />
    </div>
  );
}

function DataTableEmptyRow() {
  return (
    <div data-testid="row-data-table-empty" style={{ width: 520 }}>
      <DataTable columns={COLUMNS} data={[]} rowKey={(r) => r.id} caption="空表" />
    </div>
  );
}

const ITEMS: CommandItem[] = [
  { id: 'new', label: '新建文稿', group: '文件', shortcut: '⌘N', keywords: ['create'] },
  { id: 'open', label: '打开…', group: '文件', shortcut: '⌘O' },
  { id: 'undo', label: '撤销', group: '编辑', shortcut: '⌘Z' },
  { id: 'redo', label: '重做', group: '编辑', shortcut: '⇧⌘Z', disabled: true },
  { id: 'settings', label: '设置…', group: '应用', shortcut: '⌘,' },
];

function CommandRow() {
  const [open, setOpen] = React.useState(false);
  const [last, setLast] = React.useState<string | null>(null);
  return (
    <div data-testid="row-command" className="flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="cmd-open"
        className="rounded-full bg-[var(--lg-fill-tertiary)] px-4 py-2 text-[15px] text-[var(--lg-label-primary)]"
      >
        打开命令面板
      </button>
      <span data-testid="cmd-last" className="text-[13px] text-[var(--lg-label-secondary)]">
        {last ?? '（无）'}
      </span>
      <Command
        items={ITEMS}
        open={open}
        onOpenChange={setOpen}
        onSelect={(i) => setLast(i.label)}
        label="命令面板"
        placeholder="搜索命令…"
      />
    </div>
  );
}

const ROWS: Record<string, React.ReactNode> = {
  'data-table': <DataTableRow />,
  'data-table-select': <DataTableSelectRow />,
  'data-table-empty': <DataTableEmptyRow />,
  command: <CommandRow />,
};

function Demo() {
  const rows = only ? [only] : Object.keys(ROWS);
  return (
    <div className="flex flex-col gap-8">
      {rows.map((k) => (
        <React.Fragment key={k}>{ROWS[k]}</React.Fragment>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <GlassProvider defaultTheme={theme} defaultTint={tint} tier={tier}>
    <Demo />
  </GlassProvider>,
);

queueMicrotask(() => {
  (window as unknown as { __ready?: boolean }).__ready = true;
});
