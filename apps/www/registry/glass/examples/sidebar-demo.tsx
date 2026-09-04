'use client';

import * as React from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarItem,
} from '@/components/ui/sidebar';

/**
 * 侧栏是全库**唯一**一块 `scale="large"` 的玻璃 ——
 * HIG 那句「Liquid Glass … is more opaque in larger elements like sidebars」
 * 的落点。实测：覆盖层 0.92，而控件层的 Page Control 只有 ≈0.10。
 */
export default function SidebarDemo() {
  const [selected, setSelected] = React.useState('inbox');

  const items = [
    { id: 'inbox', label: '收件箱', detail: '12' },
    { id: 'sent', label: '已发送', detail: null },
    { id: 'drafts', label: '草稿', detail: '3' },
  ] as const;

  return (
    <SidebarProvider className="h-[420px] w-full gap-3 overflow-hidden">
      <Sidebar label="邮箱导航" width={260}>
        <SidebarHeader>
          <SidebarTrigger />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>本机</SidebarGroupLabel>
            {items.map((it) => (
              <SidebarItem
                key={it.id}
                selected={selected === it.id}
                detail={it.detail}
                onClick={() => setSelected(it.id)}
              >
                {it.label}
              </SidebarItem>
            ))}
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>智能邮箱</SidebarGroupLabel>
            <SidebarItem selected={selected === 'flag'} onClick={() => setSelected('flag')}>
              标记
            </SidebarItem>
            {/* 缩进 —— [实测] 每级 20px */}
            <SidebarItem level={1}>红色</SidebarItem>
            <SidebarItem level={1}>橙色</SidebarItem>
            <SidebarItem level={2}>深橙</SidebarItem>
            <SidebarItem disabled>归档（不可用）</SidebarItem>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <div className="min-w-0 flex-1 p-4 text-[15px] text-[var(--lg-label-secondary)]">
        当前：{items.find((i) => i.id === selected)?.label ?? selected}
        <p className="mt-2 text-[13px]">
          点左上角的按钮收起侧栏。紧凑视口下它会变成
          <strong className="font-medium">从前缘滑出的覆盖层</strong> —— 那是 iOS 的{' '}
          <code className="font-mono">.overlay</code> 显示模式，不是 SPEC §9 的底部 Drawer。
        </p>
      </div>
    </SidebarProvider>
  );
}
