'use client';

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

/**
 * ⚠️ **分隔条的每一个数字都是 `[推定]`** —— macOS 资源里那张 Split View
 * 只有布局（左栏 210 宽），中间**没有任何分隔条元素**。
 *
 * 命中区只有 8pt，够不到 HIG 的 44 —— 一条 44pt 宽的分隔条会吃掉两侧内容。
 * 代偿是**键盘路径始终可用**：Tab 到分隔条，方向键调整。试试看。
 */
export default function ResizableDemo() {
  return (
    <div className="h-[180px] w-[360px] overflow-hidden rounded-[14px] bg-[var(--lg-fill-quaternary)]">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={35} minSize={15}>
          <div className="flex h-full items-center justify-center text-[15px]">侧栏</div>
        </ResizablePanel>
        <ResizableHandle withGrip />
        <ResizablePanel defaultSize={65}>
          <div className="flex h-full items-center justify-center text-[15px]">内容</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
