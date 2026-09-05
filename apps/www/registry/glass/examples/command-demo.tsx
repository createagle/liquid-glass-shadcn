'use client';

import * as React from 'react';
import { Command, type CommandItem } from '@/components/ui/command';
import { Button } from '@/components/ui/button';

const ITEMS: CommandItem[] = [
  { id: 'new', label: '新建文稿', group: '文件', shortcut: '⌘N', keywords: ['create', 'xinjian'] },
  { id: 'open', label: '打开…', group: '文件', shortcut: '⌘O' },
  { id: 'save', label: '存储', group: '文件', shortcut: '⌘S' },
  { id: 'undo', label: '撤销', group: '编辑', shortcut: '⌘Z' },
  { id: 'redo', label: '重做', group: '编辑', shortcut: '⇧⌘Z', disabled: true },
  { id: 'settings', label: '设置…', group: '应用', shortcut: '⌘,' },
];

/**
 * ⚠️ **Apple 的设计资源里没有命令面板，而且这一次是结构上不可能有：**
 * 它对应的是 **Spotlight**，那是系统级界面，App 画不出来。
 *
 * 唯一有实测依据的一半是搜索框（macOS `Search Field`：胶囊、放大镜在前、
 * 清除在后、光标是蓝的）。面板与列表的几何全部借自菜单面板，逐条标了 `[推定]`。
 */
export default function CommandDemo() {
  const [open, setOpen] = React.useState(false);
  const [last, setLast] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col items-center gap-3">
      <Button onClick={() => setOpen(true)}>打开命令面板</Button>
      <Command
        items={ITEMS}
        open={open}
        onOpenChange={setOpen}
        onSelect={(item) => setLast(item.label)}
        label="命令面板"
        placeholder="搜索命令…"
      />
      <span className="text-[13px] text-[var(--lg-label-secondary)]">
        上次执行：{last ?? '（无）'}
      </span>
    </div>
  );
}
