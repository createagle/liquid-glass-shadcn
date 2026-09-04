'use client';

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

/**
 * 竖向分栏。
 *
 * ⚠️ v4 的方向属性叫 `orientation`（v3 是 `direction`），
 * 而且不再输出 `data-panel-group-direction` —— 本库的样式改读 `aria-orientation`。
 * 注意那个语义是反的：**竖向排列的组里，分隔条自己是 horizontal 的**。
 */
export default function ResizableVertical() {
  return (
    <div className="h-[200px] w-[300px] overflow-hidden rounded-[14px] bg-[var(--lg-fill-quaternary)]">
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel defaultSize={40}>
          <div className="flex h-full items-center justify-center text-[15px]">上</div>
        </ResizablePanel>
        <ResizableHandle withGrip />
        <ResizablePanel defaultSize={60}>
          <div className="flex h-full items-center justify-center text-[15px]">下</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
