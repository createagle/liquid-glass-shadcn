'use client';

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

/**
 * `responsive={false}` 是 PROJECT_SPEC §9 点名要求提供的**逃生口**：
 * 紧凑视口下也留在桌面的锚定菜单，不换成底部 Drawer。
 * 用在「项极多、Drawer 里反而更难用」这类场景。
 */
export default function DropdownMenuDesktopOnly() {
  return (
    <DropdownMenu responsive={false}>
      <DropdownMenuTrigger>始终是锚定菜单</DropdownMenuTrigger>
      <DropdownMenuContent title="视图">
        <DropdownMenuItem>图标</DropdownMenuItem>
        <DropdownMenuItem>列表</DropdownMenuItem>
        <DropdownMenuItem>分栏</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
