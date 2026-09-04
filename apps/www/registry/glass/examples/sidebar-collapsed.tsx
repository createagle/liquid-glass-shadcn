'use client';

import * as React from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarContent,
  SidebarItem,
} from '@/components/ui/sidebar';

/**
 * 折叠态。
 *
 * ⚠️ 折叠时侧栏加了 `inert` —— 宽度是 0，但里面的按钮**仍然可以 Tab 到**，
 * 焦点会跑进一块看不见的区域。用 `hidden` 又会让宽度动画没有东西可过渡。
 */
export default function SidebarCollapsed() {
  return (
    <SidebarProvider defaultOpen={false} className="h-[260px] w-full gap-3 overflow-hidden">
      <Sidebar label="折叠示例" width={240}>
        <SidebarContent>
          <SidebarItem selected>全部项目</SidebarItem>
          <SidebarItem>最近</SidebarItem>
          <SidebarItem>共享</SidebarItem>
        </SidebarContent>
      </Sidebar>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3 p-4">
        <SidebarTrigger />
        <span className="text-[13px] text-[var(--lg-label-secondary)]">
          触发器带 aria-expanded / aria-controls，收起后侧栏整块 inert。
        </span>
      </div>
    </SidebarProvider>
  );
}
