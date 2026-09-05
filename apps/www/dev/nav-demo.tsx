/**
 * P2 第二批（Pagination / Breadcrumb / ContextMenu / Resizable）的渲染验证台。
 *
 * 这一批**两有两无**：
 *   Pagination / ContextMenu  几何实测，且都是玻璃 —— 断言可以钉得很死
 *   Breadcrumb / Resizable    资源里根本没有，全部推定 —— 只断言行为与语义
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { GlassProvider } from '@createagle/glass-core';
import { Pagination } from '../registry/glass/ui/pagination';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from '../registry/glass/ui/breadcrumb';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from '../registry/glass/ui/context-menu';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '../registry/glass/ui/resizable';

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'light') as 'light' | 'dark';
const tier = (params.get('tier') ?? 'a') as 'a' | 'b' | 'c';
const tint = Number(params.get('tint') ?? '0.34');
const only = params.get('only');

function PaginationRow() {
  const [p, setP] = React.useState(2);
  return (
    <div data-testid="row-pagination" className="flex flex-col items-start gap-4">
      {/* 纯指示器（默认）—— 不可聚焦 */}
      <Pagination total={5} page={2} data-testid="pg-static" />
      {/* 可点的 */}
      <Pagination total={5} page={p} onPageChange={setP} data-testid="pg-live" />
      {/* 溢出：12 页，会出现 adjacent / overflow 两档小点 */}
      <Pagination total={12} page={5} data-testid="pg-overflow" />
      {/* 边界：1 页 */}
      <Pagination total={1} page={0} data-testid="pg-single" />
    </div>
  );
}

function BreadcrumbRow() {
  return (
    <div data-testid="row-breadcrumb">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#" data-testid="bc-home">
              资料库
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbEllipsis data-testid="bc-ellipsis" />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="#">2026</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage data-testid="bc-current">九月</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

function ContextMenuRow() {
  return (
    <div data-testid="row-context-menu">
      <ContextMenu>
        <ContextMenuTrigger data-testid="cm-trigger">
          <div className="flex h-[120px] w-[260px] items-center justify-center rounded-[14px] bg-[var(--lg-fill-tertiary)] text-[15px]">
            在这里点右键
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent data-testid="cm-content">
          <ContextMenuLabel>报告.pdf</ContextMenuLabel>
          <ContextMenuItem data-testid="cm-open">打开</ContextMenuItem>
          <ContextMenuItem>重命名</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem destructive data-testid="cm-delete">
            删除
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

function ResizableRow() {
  return (
    <div data-testid="row-resizable" style={{ width: 360, height: 160 }}>
      {/*
       * ⚠️ 这里**刻意不传 data-testid** —— react-resizable-panels v4
       * 会用自己的内部 id 覆盖掉它（见 resizable.tsx 的说明）。
       * 测试一律靠 data-slot 选中。
       */}
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

function Demo() {
  if (only === 'pagination') return <PaginationRow />;
  if (only === 'breadcrumb') return <BreadcrumbRow />;
  if (only === 'context-menu') return <ContextMenuRow />;
  if (only === 'resizable') return <ResizableRow />;
  return (
    <div className="flex flex-col gap-8">
      <PaginationRow />
      <BreadcrumbRow />
      <ContextMenuRow />
      <ResizableRow />
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
