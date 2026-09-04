'use client';

import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '@/components/ui/context-menu';

/**
 * 关掉背景压暗。
 *
 * ⚠️ **唯一正当的理由**是「这个菜单开在一个已经有遮罩的浮层里」
 * （比如 Dialog 或 Sheet 内部）—— 两层压暗会叠成一片黑。
 * 除此之外不要关：压暗是 iOS 上下文菜单的一部分，不是装饰。
 */
export default function ContextMenuNoScrim() {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div className="flex h-[120px] w-[260px] items-center justify-center rounded-[14px] bg-[var(--lg-fill-tertiary)] text-[15px] text-[var(--lg-label-secondary)]">
          不压暗背景
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent scrim={false}>
        <ContextMenuItem>标记</ContextMenuItem>
        <ContextMenuItem>移动到…</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
