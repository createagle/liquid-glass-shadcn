'use client';

import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from '@/components/ui/context-menu';

/**
 * 右键（触屏长按）打开。
 *
 * ✅ **面板与 DropdownMenu 是同一块** —— 不是抄的一份数字，是 `import` 来的：
 * iOS Context Menu 与 Edit Menu 两个互不相关的节点量出同样的
 * 250 宽 / 34 圆角 / 218×40 的项。
 *
 * 打开时背景会压暗 `#000000 @ 0.23`（实测，**没有模糊** —— 那个节点的效果是空的）。
 */
export default function ContextMenuDemo() {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div className="flex h-[140px] w-[280px] items-center justify-center rounded-[14px] bg-[var(--lg-fill-tertiary)] text-[15px] text-[var(--lg-label-secondary)]">
          在这里点右键
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>报告.pdf</ContextMenuLabel>
        <ContextMenuItem>打开</ContextMenuItem>
        <ContextMenuItem>重命名</ContextMenuItem>
        <ContextMenuItem>拷贝</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem destructive>删除</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
